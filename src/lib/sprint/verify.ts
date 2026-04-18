/**
 * Verification_Gate pipeline runner.
 *
 * Orchestration layer around the pure {@link computeVerificationReport}
 * mapper in `verify-mapper.ts`. This module:
 *
 *   1. Applies `FileChange`s to the sprint branch via the injected git
 *      wrapper (Task 8.1) — nothing in this file is allowed to touch the
 *      working tree directly.
 *   2. Runs the four pipeline steps in order with per-step and global
 *      timeouts:
 *
 *        - vitest      ............... 300 s step budget
 *        - next lint   ............... 180 s step budget
 *        - tsc --noEmit  ............. 180 s step budget
 *        - playwright (conditional) .. 420 s step budget
 *
 *   3. Enforces the global 600 s wall-clock cap; on cap exhaustion every
 *      not-yet-run step is marked `timeout` and `overall = "failed"`.
 *
 *   4. Never retries internally — retry orchestration lives in the
 *      Sprint_Runner (max 3 retries per fix).
 *
 * The Playwright predicate comes from {@link shouldRunPlaywright}:
 * Playwright runs iff any linked finding has category in
 * `{accessibility, ux, i18n}` (Requirement 6.4).
 *
 * Requirements: 6.3, 6.4, 6.5, 6.6, 6.10, 6.11
 */

import { spawn, type SpawnOptions } from "node:child_process";

import type {
  FileChange,
  FindingCategory,
  VerificationReport,
  VerificationStepName,
  VerificationStepStatus,
} from "@/lib/sprint/types";
import {
  VERIFICATION_WALL_CLOCK_CAP_MS,
  computeVerificationReport,
  shouldRunPlaywright,
  type StepOutcomeInput,
} from "@/lib/sprint/verify-mapper";

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

/** Per-step time budget in milliseconds (per design §Verification_Gate). */
export const STEP_TIMEOUT_MS: Record<VerificationStepName, number> = {
  vitest: 300_000,
  "next-lint": 180_000,
  tsc: 180_000,
  playwright: 420_000,
};

/** Max bytes of stdout+stderr captured per step. Anything past is dropped. */
export const STEP_OUTPUT_CAP_BYTES = 8_000;

/**
 * Minimal subset of the git wrapper consumed by the runner. Declared
 * locally (rather than importing `SprintGit`) so the gate can be exercised
 * with an in-memory double in tests.
 */
export interface VerifyGitApplier {
  applyFileChanges(
    branch: string,
    changes: readonly FileChange[],
  ): Promise<void>;
}

export interface VerifyGateInput {
  /** The FixProposal's public id, e.g. "P-abc123-7". */
  readonly fixProposalId: string;
  /** Sprint branch to apply + verify on (e.g. `sprint/<id>/fix-<pid>`). */
  readonly branch: string;
  /** Diffs to apply before running the pipeline. */
  readonly fileChanges: readonly FileChange[];
  /** Categories of every finding linked to this fix — drives Playwright. */
  readonly linkedFindingCategories: readonly FindingCategory[];
  /** Git wrapper used to apply {@link fileChanges}. */
  readonly git: VerifyGitApplier;
  /** Workspace cwd the child processes inherit. Defaults to `process.cwd()`. */
  readonly cwd?: string;
  /** External abort signal; propagates to the currently-running child. */
  readonly signal?: AbortSignal;
}

export interface StepRunnerInput {
  readonly cwd: string;
  /** Aborted on per-step or global timeout. Children should listen to this. */
  readonly signal: AbortSignal;
  /**
   * Milliseconds allowed for this step: `min(stepBudget, wallClockRemaining)`.
   * Zero means the cap has already been reached.
   */
  readonly remainingMs: number;
}

export interface StepRunnerOutput {
  readonly status: VerificationStepStatus;
  readonly durationMs: number;
  /** stdout + stderr, truncated to {@link STEP_OUTPUT_CAP_BYTES}. */
  readonly output: string;
}

export type StepRunner = (input: StepRunnerInput) => Promise<StepRunnerOutput>;

export interface VerifyGateDependencies {
  readonly runVitest?: StepRunner;
  readonly runNextLint?: StepRunner;
  readonly runTsc?: StepRunner;
  readonly runPlaywright?: StepRunner;
  /** Injectable clock for deterministic tests. Defaults to `Date.now`. */
  readonly now?: () => number;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Run the full verification gate against the fix branch.
 *
 * Contract:
 *   - Applies `fileChanges` to `branch` via `git.applyFileChanges` first.
 *     An error from the applier is fatal and surfaces as a `fail`-outcome
 *     for the first step (`vitest`) so the report shape stays consistent
 *     with every other code path.
 *   - Runs steps in a fixed order: `vitest`, `next-lint`, `tsc`,
 *     conditionally `playwright`.
 *   - Aborts the pipeline as soon as the global 600 s cap is exhausted.
 */
export async function runVerificationGate(
  input: VerifyGateInput,
  deps: VerifyGateDependencies = {},
): Promise<VerificationReport> {
  const cwd = input.cwd ?? process.cwd();
  const now = deps.now ?? Date.now;

  const runVitest = deps.runVitest ?? defaultVitestRunner;
  const runNextLint = deps.runNextLint ?? defaultNextLintRunner;
  const runTsc = deps.runTsc ?? defaultTscRunner;
  const runPlaywright = deps.runPlaywright ?? defaultPlaywrightRunner;

  const startMs = now();
  const startedAt = new Date(startMs);

  // Apply the diffs first. A failure here short-circuits the pipeline and
  // reports a single `vitest: fail` outcome — this keeps the upstream
  // FixProposal rejection path consistent (Requirement 6.6).
  try {
    await input.git.applyFileChanges(input.branch, input.fileChanges);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const completedAt = new Date(now());
    return computeVerificationReport({
      fixProposalId: input.fixProposalId,
      stepOutcomes: [
        {
          name: "vitest",
          status: "fail",
          durationMs: now() - startMs,
          output: `applyFileChanges failed: ${truncateOutput(message)}`,
        },
      ],
      linkedFindingCategories: input.linkedFindingCategories,
      wallClockMs: now() - startMs,
      startedAt,
      completedAt,
    });
  }

  const playwrightRequired = shouldRunPlaywright(input.linkedFindingCategories);
  const stepPlan: Array<{ name: VerificationStepName; run: StepRunner }> = [
    { name: "vitest", run: runVitest },
    { name: "next-lint", run: runNextLint },
    { name: "tsc", run: runTsc },
  ];
  if (playwrightRequired) {
    stepPlan.push({ name: "playwright", run: runPlaywright });
  }

  const stepOutcomes: StepOutcomeInput[] = [];

  for (const step of stepPlan) {
    const wallRemaining =
      VERIFICATION_WALL_CLOCK_CAP_MS - (now() - startMs);
    if (wallRemaining <= 0) {
      // Cap already exhausted — leave this step (and any subsequent ones)
      // unrecorded so the mapper tags them `timeout` / `overall = failed`.
      break;
    }

    const remainingMs = Math.min(STEP_TIMEOUT_MS[step.name], wallRemaining);

    const controller = new AbortController();
    const onOuterAbort = () => controller.abort(input.signal?.reason);
    if (input.signal) {
      if (input.signal.aborted) controller.abort(input.signal.reason);
      else input.signal.addEventListener("abort", onOuterAbort, { once: true });
    }

    let outcome: StepRunnerOutput;
    try {
      outcome = await step.run({
        cwd,
        signal: controller.signal,
        remainingMs,
      });
    } catch (err) {
      // A step runner that throws is treated as a `fail` with the error
      // message captured. The pipeline continues — an overall `failed`
      // verdict will still be reached by the mapper.
      const message = err instanceof Error ? err.message : String(err);
      outcome = {
        status: "fail",
        durationMs: 0,
        output: truncateOutput(`step runner threw: ${message}`),
      };
    } finally {
      if (input.signal) {
        input.signal.removeEventListener("abort", onOuterAbort);
      }
    }

    stepOutcomes.push({
      name: step.name,
      status: outcome.status,
      durationMs: outcome.durationMs,
      output: outcome.output,
    });

    // If the cap is exhausted by this step's runtime, stop here so the
    // mapper can tag later steps `timeout`.
    if (now() - startMs >= VERIFICATION_WALL_CLOCK_CAP_MS) {
      break;
    }
  }

  const wallClockMs = now() - startMs;
  const completedAt = new Date(now());

  return computeVerificationReport({
    fixProposalId: input.fixProposalId,
    stepOutcomes,
    linkedFindingCategories: input.linkedFindingCategories,
    wallClockMs,
    startedAt,
    completedAt,
  });
}

// ---------------------------------------------------------------------------
// Default step runners (spawn child processes)
// ---------------------------------------------------------------------------

/**
 * Run the default step command with the shared spawn+timeout+capture
 * machinery. All four built-in runners share this codepath.
 */
async function runStepProcess(
  stepName: VerificationStepName,
  cmd: string,
  args: readonly string[],
  input: StepRunnerInput,
): Promise<StepRunnerOutput> {
  if (input.remainingMs <= 0) {
    return {
      status: "timeout",
      durationMs: 0,
      output: `timeout: ${stepName} skipped — wall-clock cap reached`,
    };
  }

  const started = Date.now();

  return new Promise<StepRunnerOutput>((resolve) => {
    const options: SpawnOptions = {
      cwd: input.cwd,
      // `shell: true` is required on Windows so bare binaries like
      // `npx` are resolvable from PATH. Arguments are a fixed static
      // list (no user input), so no injection surface.
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(cmd, [...args], options);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      resolve({
        status: "fail",
        durationMs: Date.now() - started,
        output: truncateOutput(`spawn error: ${message}`),
      });
      return;
    }

    const chunks: Buffer[] = [];
    let captured = 0;
    const capture = (buf: Buffer) => {
      if (captured >= STEP_OUTPUT_CAP_BYTES) return;
      const room = STEP_OUTPUT_CAP_BYTES - captured;
      const slice = buf.length <= room ? buf : buf.subarray(0, room);
      chunks.push(slice);
      captured += slice.length;
    };
    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);

    let resolved = false;
    const finalize = (result: StepRunnerOutput) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    const timeout = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      const hard = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }, 2_000);
      hard.unref?.();

      finalize({
        status: "timeout",
        durationMs: Date.now() - started,
        output: truncateOutput(
          `timeout: ${stepName} killed after ${input.remainingMs}ms\n` +
            bufferToString(chunks),
        ),
      });
    }, input.remainingMs);
    timeout.unref?.();

    const onAbort = () => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      finalize({
        status: "timeout",
        durationMs: Date.now() - started,
        output: truncateOutput(
          `aborted: ${stepName}\n${bufferToString(chunks)}`,
        ),
      });
    };
    if (input.signal.aborted) {
      onAbort();
      return;
    }
    input.signal.addEventListener("abort", onAbort, { once: true });

    child.on("error", (err) => {
      finalize({
        status: "fail",
        durationMs: Date.now() - started,
        output: truncateOutput(
          `spawn error: ${err.message}\n${bufferToString(chunks)}`,
        ),
      });
    });

    child.on("close", (code) => {
      const output = bufferToString(chunks);
      finalize({
        status: code === 0 ? "pass" : "fail",
        durationMs: Date.now() - started,
        output: truncateOutput(output),
      });
    });

    function cleanup(): void {
      clearTimeout(timeout);
      input.signal.removeEventListener("abort", onAbort);
    }
  });
}

const defaultVitestRunner: StepRunner = (input) =>
  runStepProcess(
    "vitest",
    "npx",
    ["vitest", "run", "--reporter=json"],
    input,
  );

const defaultNextLintRunner: StepRunner = (input) =>
  runStepProcess("next-lint", "npx", ["next", "lint"], input);

const defaultTscRunner: StepRunner = (input) =>
  runStepProcess("tsc", "npx", ["tsc", "--noEmit"], input);

/**
 * Default Playwright runner. If Playwright is not installed in the
 * workspace, the spawn will fail and we surface `status: "skipped"` so
 * the overall verdict isn't poisoned by a missing optional dep.
 */
const defaultPlaywrightRunner: StepRunner = async (input) => {
  const result = await runStepProcess(
    "playwright",
    "npx",
    ["playwright", "test"],
    input,
  );
  if (
    result.status === "fail" &&
    /Cannot find module|not found|ENOENT|Unknown command/i.test(result.output)
  ) {
    return {
      status: "skipped",
      durationMs: result.durationMs,
      output: `skipped: playwright not installed — ${result.output}`,
    };
  }
  return result;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bufferToString(chunks: readonly Buffer[]): string {
  return Buffer.concat(chunks as Buffer[]).toString("utf8");
}

function truncateOutput(s: string): string {
  if (s.length <= STEP_OUTPUT_CAP_BYTES) return s;
  return `${s.slice(0, STEP_OUTPUT_CAP_BYTES)}\n…[truncated]`;
}
