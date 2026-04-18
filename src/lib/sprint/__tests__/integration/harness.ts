/**
 * Integration test harness for the Virtual Team Sprint Runner.
 *
 * The harness wires up the three heavy dependencies that make sprint
 * integration tests awkward to write one-off:
 *
 *   1. An isolated, sprint-owned MongoDB database — created via
 *      `createTestDatabase` and torn down via `dropTestDatabase`.
 *   2. An isolated child Next.js test instance bound to `SPRINT_TEST_PORT`
 *      with `MONGODB_URI` pointed at the sprint DB.
 *   3. A deterministic LLM client that replays a caller-supplied script
 *      of tool-call responses, so tests never hit a real provider.
 *
 * All integration test files in `src/lib/sprint/__tests__/integration/**`
 * MUST gate their `describe` block on `SPRINT_INTEGRATION === "true"` —
 * the `describeIntegration` helper exported below is the canonical way
 * to do that. When `SPRINT_INTEGRATION` is unset, `setupIntegrationHarness`
 * throws with a clear error so any accidental call without the gate
 * surfaces immediately rather than silently running a real build.
 *
 * Follow-ups 17.2–17.5 (the actual integration tests) import from this
 * module — they do not ship here.
 *
 * Requirements: 12.1, 12.2, 12.3
 */

import { describe } from "vitest";
import { Types } from "mongoose";

import { loadSprintEnv } from "@/lib/sprint/env";
import {
  buildTestDbName,
  buildTestMongoUri,
  createTestDatabase,
  dropTestDatabase,
} from "@/lib/sprint/test-db";
import { createTestInstance, type TestInstance } from "@/lib/sprint/test-instance";
import { seedTestDatabase } from "@/lib/sprint/fixtures";
import type {
  LlmClient,
  LlmRequest,
  LlmResponse,
} from "@/lib/sprint/llm/client";
import type { LlmProvider } from "@/lib/sprint/types";

// ---------------------------------------------------------------------------
// Integration-gate helper
// ---------------------------------------------------------------------------

/**
 * True when the current process is opted in to sprint integration tests.
 * Every test file that depends on this harness must gate its top-level
 * `describe` behind this flag, typically via {@link describeIntegration}.
 */
export function isIntegrationEnabled(): boolean {
  return process.env.SPRINT_INTEGRATION === "true";
}

/**
 * Thin wrapper around `describe.skipIf(!SPRINT_INTEGRATION)`. Prefer this
 * helper at the top of every integration test file so the gate is
 * declarative and impossible to forget.
 *
 * ```ts
 * describeIntegration("sprint happy path", () => {
 *   let harness: IntegrationHarness;
 *   beforeAll(async () => { harness = await setupIntegrationHarness({ llmScript: [...] }); });
 *   afterAll(async () => { await harness.teardown(); });
 *   it("runs", async () => { ... });
 * });
 * ```
 */
export function describeIntegration(
  name: string,
  fn: () => void,
): void {
  describe.skipIf(!isIntegrationEnabled())(name, fn);
}

// ---------------------------------------------------------------------------
// Scripted LLM client
// ---------------------------------------------------------------------------

/**
 * A single step in a deterministic LLM script.
 *
 * Steps are consumed in declaration order. When `matches` is set, the step
 * is only eligible for a request whose `userPrompt` contains the matcher
 * (substring or regex). Steps without a `matches` are unconstrained.
 */
export interface ScriptedLlmStep {
  /**
   * Optional matcher. When set, this step only fires for requests whose
   * `userPrompt` contains the substring or matches the regex. Useful for
   * routing different responses to different agent roles in the same
   * script.
   */
  readonly matches?: string | RegExp;
  /**
   * Raw text the LLM would return. Must be parseable by
   * `parseAgentResponse` (i.e. a JSON `{tool, parameters}` payload or
   * text wrapping one).
   */
  readonly text: string;
  /** Optional usage override; zeroes are used when omitted. */
  readonly usage?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
  };
}

export interface CreateScriptedLlmClientOptions {
  readonly provider?: LlmProvider;
  readonly model?: string;
}

/**
 * Fallback text returned once the script is exhausted. Uses the safe
 * `llm.think` tool so downstream parsers / tool executors never trip on
 * an unexpected shape.
 */
const EXHAUSTED_FALLBACK_TEXT =
  '{"tool":"llm.think","parameters":{"note":"(scripted client exhausted)"}}';

/**
 * Build a deterministic {@link LlmClient} that replays a fixed script of
 * responses. Each `generate()` call picks the next unused step whose
 * matcher is satisfied by the request's `userPrompt` (in declaration
 * order). When no matching step remains, a safe `llm.think` fallback is
 * returned. The client never throws.
 */
export function createScriptedLlmClient(
  script: readonly ScriptedLlmStep[],
  options: CreateScriptedLlmClientOptions = {},
): LlmClient {
  const provider: LlmProvider = options.provider ?? "anthropic";
  const model = options.model ?? "scripted-test-model";

  // Track consumed steps by index so the ordering is stable regardless of
  // which steps a given request ends up matching.
  const consumed = new Array<boolean>(script.length).fill(false);

  function stepMatches(step: ScriptedLlmStep, prompt: string): boolean {
    if (step.matches === undefined) return true;
    if (typeof step.matches === "string") return prompt.includes(step.matches);
    return step.matches.test(prompt);
  }

  function nextStep(userPrompt: string): ScriptedLlmStep | undefined {
    for (let i = 0; i < script.length; i++) {
      if (consumed[i]) continue;
      if (stepMatches(script[i], userPrompt)) {
        consumed[i] = true;
        return script[i];
      }
    }
    return undefined;
  }

  return {
    provider,
    model,
    async generate(req: LlmRequest): Promise<LlmResponse> {
      const step = nextStep(req.userPrompt);
      if (step === undefined) {
        return {
          text: EXHAUSTED_FALLBACK_TEXT,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          model,
          provider,
        };
      }
      const inputTokens = step.usage?.inputTokens ?? 0;
      const outputTokens = step.usage?.outputTokens ?? 0;
      return {
        text: step.text,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        model,
        provider,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Integration harness
// ---------------------------------------------------------------------------

export interface IntegrationHarness {
  /** The sprint id allocated on setup. Also used to name the test DB. */
  readonly sprintId: string;
  /** Port the child test instance is bound to. */
  readonly testPort: number;
  /** `http://localhost:<testPort>` — convenience for fetches. */
  readonly baseUrl: string;
  /** MongoDB URI for the sprint-owned test DB. */
  readonly testMongoUri: string;
  /**
   * Stop the test instance, drop the DB, and release resources. Safe to
   * call multiple times; errors from individual teardown steps are
   * swallowed after being logged to stderr so a partial teardown never
   * masks the original test failure.
   */
  teardown(): Promise<void>;
  /** Tail of the child test instance's stdout/stderr (~8 KB). */
  getTestInstanceLogs(): string;
  /** The scripted LLM client. Pass this to a harness-aware AgentPool. */
  readonly llm: LlmClient;
}

export interface HarnessSetupOptions {
  /** Scripted LLM steps returned in order. Required. */
  readonly llmScript: readonly ScriptedLlmStep[];
  /**
   * Skip spawning the child test instance. Useful for tests that only
   * exercise DB + LLM layers (e.g. the rule layer against a seeded DB).
   */
  readonly skipTestInstance?: boolean;
  /** Skip seeding the test DB. */
  readonly skipSeed?: boolean;
  /**
   * Override the sprintId. When omitted, a fresh `ObjectId` is allocated.
   * Useful for reproducible DB paths across repeat runs of the same test.
   */
  readonly sprintId?: string;
}

/**
 * Spin up the full sprint integration environment: DB, seed data, and
 * child test instance. Returns an {@link IntegrationHarness} whose
 * `teardown()` tears the whole thing down again.
 *
 * v1 seeding compromise: `seedTestDatabase()` uses the shared global
 * mongoose connection under the hood. To seed the sprint-owned DB
 * without permanently swapping the app's `MONGODB_URI`, the harness
 * temporarily overrides `process.env.MONGODB_URI` around the seed call
 * and restores it afterwards. This mirrors the `TODO(sprint v2)` noted
 * in `runner.ts` — it's acceptable here because the harness owns the
 * whole process environment for the duration of the test.
 */
export async function setupIntegrationHarness(
  options: HarnessSetupOptions,
): Promise<IntegrationHarness> {
  if (!isIntegrationEnabled()) {
    throw new Error(
      "setupIntegrationHarness: SPRINT_INTEGRATION !== \"true\". " +
        "Integration tests must be gated behind describeIntegration() / " +
        "describe.skipIf(!process.env.SPRINT_INTEGRATION).",
    );
  }

  if (!Array.isArray(options.llmScript)) {
    throw new Error("setupIntegrationHarness: llmScript is required");
  }

  // Validate env before we touch any side-effecting resource.
  const env = loadSprintEnv();

  const sprintId =
    options.sprintId !== undefined && options.sprintId !== ""
      ? options.sprintId
      : new Types.ObjectId().toHexString();

  const testMongoUri = buildTestMongoUri(env.MONGODB_URI, sprintId);
  const testPort = env.SPRINT_TEST_PORT;
  const baseUrl = `http://localhost:${testPort}`;

  // --- Stand up the isolated test DB ----------------------------------------
  await createTestDatabase(sprintId, env.MONGODB_URI);

  // --- Seed (if requested) --------------------------------------------------
  // `seedTestDatabase` uses the default mongoose connection, which is
  // driven by `process.env.MONGODB_URI`. Temporarily point it at the
  // sprint-owned DB for the duration of the seed call, then restore.
  if (!options.skipSeed) {
    const priorMongoUri = process.env.MONGODB_URI;
    process.env.MONGODB_URI = testMongoUri;
    try {
      await seedTestDatabase();
    } finally {
      if (priorMongoUri === undefined) {
        delete process.env.MONGODB_URI;
      } else {
        process.env.MONGODB_URI = priorMongoUri;
      }
    }
  }

  // --- Spawn the child test instance (if requested) -------------------------
  let testInstance: TestInstance | undefined;
  let testInstanceLogBuffer = "";
  if (!options.skipTestInstance) {
    testInstance = createTestInstance({ sprintId, port: testPort });
    testInstance.onUnexpectedExit((reason) => {
      testInstanceLogBuffer +=
        `\n[harness] test instance exited unexpectedly: ${reason}\n`;
    });
    try {
      await testInstance.start();
    } catch (err) {
      // Best-effort cleanup so a failed start doesn't leak a DB.
      await dropTestDatabase(sprintId, env.MONGODB_URI).catch(() => undefined);
      throw err;
    }
  }

  // --- Scripted LLM ---------------------------------------------------------
  const llm = createScriptedLlmClient(options.llmScript);

  // --- Teardown (idempotent) -----------------------------------------------
  let torn = false;
  async function teardown(): Promise<void> {
    if (torn) return;
    torn = true;

    if (testInstance !== undefined) {
      try {
        await testInstance.stop();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[harness] testInstance.stop failed", err);
      }
    }

    try {
      await dropTestDatabase(sprintId, env.MONGODB_URI);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[harness] dropTestDatabase failed", err);
    }
  }

  function getTestInstanceLogs(): string {
    const base = testInstance?.getRecentLogs() ?? "";
    return base + testInstanceLogBuffer;
  }

  return {
    sprintId,
    testPort,
    baseUrl,
    testMongoUri,
    teardown,
    getTestInstanceLogs,
    llm,
  };
}

// ---------------------------------------------------------------------------
// Re-exports — keep the harness a one-stop import for 17.2-17.5.
// ---------------------------------------------------------------------------

export { buildTestDbName, buildTestMongoUri };
