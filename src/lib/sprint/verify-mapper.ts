/**
 * Pure verification-pipeline mapper.
 *
 * Given the injected outcomes of the four verification steps (`vitest`,
 * `next-lint`, `tsc`, optionally `playwright`) plus the categories of the
 * findings linked to the FixProposal, decide:
 *
 *   1. Was Playwright required? (any linked finding in
 *      {accessibility, ux, i18n}) — Requirement 6.4
 *   2. Did the pipeline exceed the 600 s wall-clock cap? If so, every
 *      not-yet-run step is marked `timeout` and `overall = failed`. —
 *      Requirement 6.11
 *   3. Otherwise, `overall = passed` iff every executed step is `pass`
 *      (and Playwright is present when required). — Requirements 6.3,
 *      6.5, 6.6
 *
 * This module is deliberately side-effect-free: the caller orchestrates
 * the actual process spawns and feeds the outcomes in here so that the
 * mapping logic is cheap to exercise in property tests.
 *
 * Requirements: 6.3, 6.4, 6.5, 6.6, 6.11
 */

import type {
  FindingCategory,
  VerificationOverallStatus,
  VerificationReport,
  VerificationStep,
  VerificationStepName,
  VerificationStepStatus,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Global wall-clock cap for a single Verification_Gate invocation (10 min). */
export const VERIFICATION_WALL_CLOCK_CAP_MS = 600_000;

/** Categories that require the Playwright critical-flow suite to run. */
const PLAYWRIGHT_TRIGGER_CATEGORIES: ReadonlySet<FindingCategory> = new Set([
  "accessibility",
  "ux",
  "i18n",
]);

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface StepOutcomeInput {
  readonly name: VerificationStepName;
  readonly status: VerificationStepStatus;
  readonly durationMs: number;
  /** Captured stdout+stderr, already truncated by the caller. */
  readonly output?: string;
}

export interface ComputeVerificationInput {
  readonly fixProposalId: string;
  readonly stepOutcomes: readonly StepOutcomeInput[];
  readonly linkedFindingCategories: readonly FindingCategory[];
  /** Total pipeline wall-clock elapsed — used to enforce the 600 s cap. */
  readonly wallClockMs: number;
  readonly startedAt: Date;
  readonly completedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers (exported for reuse in tests and by the runner retry orchestration)
// ---------------------------------------------------------------------------

/**
 * Requirement 6.4: Playwright runs if and only if any linked Finding has
 * category in {accessibility, ux, i18n}.
 */
export function shouldRunPlaywright(
  linkedFindingCategories: readonly FindingCategory[],
): boolean {
  for (const c of linkedFindingCategories) {
    if (PLAYWRIGHT_TRIGGER_CATEGORIES.has(c)) return true;
  }
  return false;
}

/** Deterministic order of steps in a VerificationReport. */
const STEP_ORDER: readonly VerificationStepName[] = [
  "vitest",
  "next-lint",
  "tsc",
  "playwright",
];

// ---------------------------------------------------------------------------
// computeVerificationReport
// ---------------------------------------------------------------------------

/**
 * Map step outcomes + linked findings + wall-clock elapsed to a final
 * {@link VerificationReport}.
 */
export function computeVerificationReport(
  input: ComputeVerificationInput,
): VerificationReport {
  const playwrightRequired = shouldRunPlaywright(input.linkedFindingCategories);

  // Index the provided outcomes by name so we can look them up cheaply and
  // detect "not yet run" steps (i.e. steps absent from the input).
  const outcomeByName = new Map<VerificationStepName, StepOutcomeInput>();
  for (const o of input.stepOutcomes) {
    outcomeByName.set(o.name, o);
  }

  const capExceeded = input.wallClockMs > VERIFICATION_WALL_CLOCK_CAP_MS;

  // Build the deterministic step list. `vitest`, `next-lint`, `tsc` are
  // always expected; `playwright` is only included when required OR when
  // an outcome was explicitly supplied (so a caller can still record a
  // skipped/timeout status for it).
  const emittedNames: VerificationStepName[] = [];
  for (const name of STEP_ORDER) {
    if (name === "playwright") {
      if (playwrightRequired || outcomeByName.has(name)) {
        emittedNames.push(name);
      }
    } else {
      emittedNames.push(name);
    }
  }

  const steps: VerificationStep[] = emittedNames.map((name) => {
    const outcome = outcomeByName.get(name);

    if (outcome === undefined) {
      // Step not yet run.
      //   - If the cap has been exceeded, mark it `timeout` so the caller
      //     can report "we ran out of wall clock before reaching this step".
      //   - If playwright is NOT required and was not supplied, mark it
      //     `skipped` (Requirement 6.4: skipped when not triggered).
      //   - Otherwise mark it `skipped` — the step was expected but the
      //     caller elected not to run it (for example, a test-only input
      //     for the mapper).
      if (capExceeded) {
        return {
          name,
          status: "timeout",
          durationMs: 0,
          output: "timeout: verification wall-clock cap exceeded",
        };
      }
      if (name === "playwright" && !playwrightRequired) {
        return {
          name,
          status: "skipped",
          durationMs: 0,
          output: "skipped: no linked finding in accessibility/ux/i18n",
        };
      }
      return {
        name,
        status: "skipped",
        durationMs: 0,
        output: "skipped: step not executed",
      };
    }

    // If the cap is exceeded, any outcome that isn't a definitive
    // pass/fail/skipped result gets re-tagged as `timeout` per
    // Requirement 6.11.
    if (capExceeded && outcome.status !== "pass" && outcome.status !== "fail" && outcome.status !== "skipped") {
      return {
        name,
        status: "timeout",
        durationMs: outcome.durationMs,
        output:
          outcome.output ?? "timeout: verification wall-clock cap exceeded",
      };
    }

    return {
      name,
      status: outcome.status,
      durationMs: outcome.durationMs,
      output: outcome.output ?? "",
    };
  });

  // Decide the overall verdict.
  const overall: VerificationOverallStatus = computeOverall(
    steps,
    playwrightRequired,
    capExceeded,
    outcomeByName,
  );

  return {
    fixProposalId: input.fixProposalId,
    overall,
    steps,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
}

function computeOverall(
  steps: readonly VerificationStep[],
  playwrightRequired: boolean,
  capExceeded: boolean,
  outcomeByName: ReadonlyMap<VerificationStepName, StepOutcomeInput>,
): VerificationOverallStatus {
  // 1. Wall-clock cap ⇒ failed (Requirement 6.11).
  if (capExceeded) return "failed";

  // 2. Any fail or timeout on any executed step ⇒ failed.
  for (const s of steps) {
    if (s.status === "fail" || s.status === "timeout") return "failed";
  }

  // 3. Playwright required but not present in the outcomes ⇒ failed —
  //    we cannot certify pass when a required step never ran.
  if (playwrightRequired && !outcomeByName.has("playwright")) {
    return "failed";
  }

  // 4. We need at least one step to have actually passed; a report whose
  //    only non-skipped content is "skipped" is not a verified pass.
  const hasPassedStep = steps.some((s) => s.status === "pass");
  if (!hasPassedStep) return "failed";

  // 5. Otherwise every executed step is pass/skipped and Playwright is
  //    present when required ⇒ passed.
  return "passed";
}
