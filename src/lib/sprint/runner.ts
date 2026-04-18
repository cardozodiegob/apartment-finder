/**
 * Sprint_Runner — the coordinator that ties the whole sprint runner
 * together.
 *
 * Responsibilities (per design §Sprint_Runner and tasks 12.2):
 *   - `create(input)` — validate the request, enforce the single-running
 *     invariant, persist a Sprint record in `pending` status, and init
 *     the shared markdown workspace.
 *   - `start(sprintId)` — transition pending→running via `state-guard`,
 *     spawn the isolated test instance, seed the test DB (see v1 note
 *     below), freeze the agent manifests, and begin the tick scheduler.
 *   - `abort(sprintId, reason?)` — stop agents within 30 s, transition
 *     running|closing→aborted, drop the test DB, terminate the child
 *     process. Artifacts are preserved on disk.
 *   - `getStatus(sprintId)` — snapshot view for the admin UI.
 *   - `_rehydrate()` — process-restart recovery: force-abort stale
 *     `running`/`closing` sprints with reason `process_restart`.
 *
 * Scheduler: agents step round-robin, staggered 500 ms apart. Duration
 * elapsed OR token budget exhausted → `closing`. 150 % duration OR
 * admin abort → `aborted`. Every transition goes through `nextState`.
 *
 * v1 test-DB seeding: `createTestDatabase` creates an empty sprint-owned
 * DB; `seedTestDatabase()` relies on the global mongoose connection, so
 * seeding from within this process would swap the runner's own Mongo
 * URI. Rather than risk that, the child Next.js test instance is
 * expected to run its own seed at boot (see Requirement 12.2). A
 * dedicated-connection seeder is a follow-up.
 *
 * // TODO(sprint v2): wire seedTestDatabase through a dedicated connection
 * //                  so the coordinator can seed without swapping the
 * //                  default mongoose URI mid-sprint.
 *
 * Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 8.7, 12.1, 12.3, 12.6
 */

import { Types } from "mongoose";

import dbConnect from "@/lib/db/connection";
import Finding from "@/lib/db/models/Finding";
import Sprint, { type ISprint } from "@/lib/db/models/Sprint";

import { createAgentPool, type AgentPool } from "./agents/pool";
import { loadSprintEnv, type SprintEnv } from "./env";
import {
  canStart,
  isTerminal,
  nextState,
  type SprintStateEvent,
} from "./state-guard";
import {
  buildTestDbName,
  createTestDatabase,
  dropTestDatabase,
} from "./test-db";
import { createTestInstance, type TestInstance } from "./test-instance";
import {
  createToolExecutor,
  defaultActionLogWriter,
  type ToolExecutor,
} from "./tools/executor";
import { getToolRegistry } from "./tools/registry";
import type {
  AgentRole,
  CustomerPersona,
  FindingSeverity,
  SprintResult,
  SprintStatus,
  ToolCall,
  ToolResult,
} from "./types";
import { createWorkspaceWriter } from "./workspace";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CreateSprintInput {
  readonly roles: readonly AgentRole[];
  readonly personas: readonly CustomerPersona[];
  readonly durationMinutes: number;
  readonly goals: readonly string[];
  /** Admin user id (ObjectId hex). */
  readonly createdBy: string;
  /** User's currently-checked-out branch, captured before start. */
  readonly currentBranchAtStart: string;
}

export interface SprintStatusView {
  readonly sprintId: string;
  readonly status: SprintStatus;
  readonly result?: SprintResult;
  readonly durationMinutes: number;
  readonly startedAt?: Date;
  readonly goals: readonly string[];
  readonly activeAgents: readonly AgentRole[];
  readonly findingCounts: {
    readonly total: number;
    readonly bySeverity: Readonly<Record<FindingSeverity, number>>;
  };
  readonly elapsedMs: number;
  readonly tokensUsed: number;
  readonly tokenBudget: number;
  readonly hasCriticalFinding: boolean;
  readonly recentLogEntries: readonly string[];
}

export class SprintRunnerError extends Error {
  public readonly code:
    | "VALIDATION"
    | "ENV_MISSING"
    | "CONCURRENT_SPRINT"
    | "NOT_FOUND"
    | "ILLEGAL_TRANSITION"
    | "START_GUARD";

  constructor(
    code: SprintRunnerError["code"],
    message: string,
  ) {
    super(message);
    this.name = "SprintRunnerError";
    this.code = code;
  }
}

export interface SprintRunner {
  create(input: CreateSprintInput): Promise<string>;
  start(sprintId: string): Promise<void>;
  abort(sprintId: string, reason?: string): Promise<void>;
  getStatus(sprintId: string): Promise<SprintStatusView>;
  /** Test hook: force-abort stale sprints left over from a previous process. */
  _rehydrate(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Gap between agent steps. */
const TICK_INTERVAL_MS = 500;

/** Time to wait for in-flight ticks to settle on abort (Requirement 1.8). */
const ABORT_GRACE_MS = 30_000;

/** Min / max sprint duration (minutes). Mirrors Sprint schema bounds. */
const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 240;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateCreateInput(input: CreateSprintInput): void {
  if (!input.roles || input.roles.length === 0) {
    throw new SprintRunnerError("VALIDATION", "roles must not be empty");
  }
  if (!input.roles.includes("tech_lead")) {
    throw new SprintRunnerError(
      "VALIDATION",
      "roles must include tech_lead",
    );
  }
  const rolesSet = new Set(input.roles);
  if (rolesSet.size !== input.roles.length) {
    throw new SprintRunnerError("VALIDATION", "roles contains duplicates");
  }
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < MIN_DURATION_MINUTES ||
    input.durationMinutes > MAX_DURATION_MINUTES
  ) {
    throw new SprintRunnerError(
      "VALIDATION",
      `durationMinutes must be an integer in [${MIN_DURATION_MINUTES}, ${MAX_DURATION_MINUTES}]`,
    );
  }
  if (!input.goals || input.goals.length === 0) {
    throw new SprintRunnerError(
      "VALIDATION",
      "goals must contain at least one entry",
    );
  }
  if (!Types.ObjectId.isValid(input.createdBy)) {
    throw new SprintRunnerError(
      "VALIDATION",
      "createdBy must be a valid ObjectId",
    );
  }
  if (!input.currentBranchAtStart || input.currentBranchAtStart.trim() === "") {
    throw new SprintRunnerError(
      "VALIDATION",
      "currentBranchAtStart must be a non-empty branch name",
    );
  }
}

// ---------------------------------------------------------------------------
// In-memory running state
// ---------------------------------------------------------------------------

/** Running-sprint state kept only in this process. */
interface RunningSprintState {
  readonly sprintId: string;
  readonly pool: AgentPool;
  readonly executor: ToolExecutor;
  readonly testInstance: TestInstance;
  readonly durationMs: number;
  readonly tokenBudget: number;
  readonly startMs: number;
  aborted: boolean;
  closing: boolean;
  /** Tokens consumed across all agents. Drives the `closing` trigger. */
  tokensUsed: number;
  /** Current round-robin pointer into the agents map. */
  nextAgentIdx: number;
  /** True while a tick is mid-flight. */
  inFlight: boolean;
  /** Handle for the scheduled next tick. */
  timer?: NodeJS.Timeout;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSprintRunner(): SprintRunner {
  const states = new Map<string, RunningSprintState>();

  // ------------------------- helpers ---------------------------------------

  async function loadSprint(sprintId: string): Promise<ISprint> {
    if (!Types.ObjectId.isValid(sprintId)) {
      throw new SprintRunnerError("NOT_FOUND", "invalid sprint id");
    }
    await dbConnect();
    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
      throw new SprintRunnerError("NOT_FOUND", `sprint ${sprintId} not found`);
    }
    return sprint;
  }

  async function anotherSprintRunning(excludeId?: string): Promise<boolean> {
    await dbConnect();
    const query: Record<string, unknown> = {
      status: { $in: ["running", "closing"] },
    };
    if (excludeId !== undefined && Types.ObjectId.isValid(excludeId)) {
      query._id = { $ne: new Types.ObjectId(excludeId) };
    }
    const count = await Sprint.countDocuments(query);
    return count > 0;
  }

  // ------------------------- create ----------------------------------------

  async function create(input: CreateSprintInput): Promise<string> {
    validateCreateInput(input);

    // Env must be loadable before we persist anything.
    let env: SprintEnv;
    try {
      env = loadSprintEnv();
    } catch (err) {
      throw new SprintRunnerError(
        "ENV_MISSING",
        err instanceof Error ? err.message : String(err),
      );
    }

    // Single-running-sprint guard: reject if any sprint is in-flight.
    if (await anotherSprintRunning()) {
      throw new SprintRunnerError(
        "CONCURRENT_SPRINT",
        "another sprint is currently running or closing",
      );
    }

    const sprintObjectId = new Types.ObjectId();
    const sprintId = sprintObjectId.toHexString();

    await Sprint.create({
      _id: sprintObjectId,
      status: "pending",
      goals: [...input.goals],
      durationMinutes: input.durationMinutes,
      roles: [...input.roles],
      personas: [...input.personas],
      agents: [],
      createdBy: new Types.ObjectId(input.createdBy),
      testDbName: buildTestDbName(sprintId),
      testPort: env.SPRINT_TEST_PORT,
      tokenBudget: env.SPRINT_TOKEN_BUDGET,
      tokensUsed: 0,
      hasCriticalFinding: false,
      currentBranchAtStart: input.currentBranchAtStart,
    });

    // Initialize the shared workspace and seed plan.md with the goals.
    const workspace = createWorkspaceWriter(sprintId);
    await workspace.init(sprintId);
    const goalsBlock =
      "## Sprint Goals (from creation request)\n\n" +
      input.goals.map((g, i) => `${i + 1}. ${g}`).join("\n") +
      "\n\n";
    await workspace.append("plan.md", goalsBlock, {
      actor: "sprint_runner",
      toolName: "sprint.create",
    });

    return sprintId;
  }

  // ------------------------- start -----------------------------------------

  async function start(sprintId: string): Promise<void> {
    const sprint = await loadSprint(sprintId);

    // In-memory guard: if a state already exists, this process thinks
    // the sprint is running. Reject re-start.
    if (states.has(sprintId)) {
      throw new SprintRunnerError(
        "ILLEGAL_TRANSITION",
        `sprint ${sprintId} is already running in this process`,
      );
    }

    const env = loadSprintEnv();
    const guard = canStart(sprint, {
      anotherSprintRunning: await anotherSprintRunning(sprintId),
      envLoaded: true,
    });
    if (!guard.ok) {
      throw new SprintRunnerError("START_GUARD", guard.message);
    }

    const transition = nextState(sprint, {
      type: "start",
      ctx: {
        anotherSprintRunning: false,
        envLoaded: true,
      },
    });
    if (!transition.ok) {
      throw new SprintRunnerError(
        "ILLEGAL_TRANSITION",
        transition.message ?? "start transition rejected",
      );
    }

    // 1. Create the isolated test DB. NOTE: not seeded from this process;
    //    the child Next.js instance is expected to seed at boot. See the
    //    module-level TODO(sprint v2) comment.
    await createTestDatabase(sprintId, env.MONGODB_URI);

    // 2. Spawn the test instance. If the child exits unexpectedly we
    //    fire-and-forget an abort.
    const testInstance = createTestInstance({ sprintId });
    testInstance.onUnexpectedExit((reason) => {
      // Fire-and-forget: if abort itself fails the in-memory state is
      // gone either way. Log to stderr so operators see it.
      abort(sprintId, `test_instance_crashed:${reason}`).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn(
          "[sprint-runner] abort after test instance crash failed",
          err,
        );
      });
    });

    try {
      await testInstance.start();
    } catch (err) {
      await dropTestDatabase(sprintId, env.MONGODB_URI).catch(() => undefined);
      throw err;
    }

    // 3. Freeze the agent manifests for the sprint's lifetime.
    const pool = await createAgentPool({
      sprintId,
      roles: sprint.roles,
      provider: env.SPRINT_LLM_PROVIDER,
      model: env.SPRINT_LLM_MODEL,
    });

    // 4. Persist the agent roster on the sprint record.
    sprint.agents = pool.agentInstances.map((a) => ({
      role: a.role,
      provider: a.provider,
      model: a.model,
      allowedTools: [...a.allowedTools],
      tokensUsed: 0,
    }));

    // 5. Build the executor bound to the frozen allow-list.
    const executor = createToolExecutor({
      allowedToolsByRole: pool.allowedToolsByRole,
      tools: getToolRegistry(),
      verboseLogs: env.SPRINT_VERBOSE_LOGS,
      actionLogWriter: defaultActionLogWriter,
    });

    // 6. Move the sprint to running and persist.
    sprint.status = "running";
    sprint.startedAt = new Date();
    await sprint.save();

    // 7. Register in-memory state and kick off the scheduler.
    const state: RunningSprintState = {
      sprintId,
      pool,
      executor,
      testInstance,
      durationMs: sprint.durationMinutes * 60_000,
      tokenBudget: sprint.tokenBudget,
      startMs: Date.now(),
      aborted: false,
      closing: false,
      tokensUsed: 0,
      nextAgentIdx: 0,
      inFlight: false,
    };
    states.set(sprintId, state);

    scheduleNextTick(state);
  }

  // ------------------------- scheduler / tick ------------------------------

  function scheduleNextTick(state: RunningSprintState): void {
    if (state.aborted) return;
    state.timer = setTimeout(() => {
      tick(state.sprintId).catch((err) => {
        // Errors inside tick are isolated — the sprint keeps running.
        // eslint-disable-next-line no-console
        console.warn("[sprint-runner] tick failed", err);
      });
    }, TICK_INTERVAL_MS);
    state.timer.unref?.();
  }

  async function tick(sprintId: string): Promise<void> {
    const state = states.get(sprintId);
    if (!state) return; // sprint was aborted/completed while scheduled
    if (state.aborted) return;

    state.inFlight = true;
    try {
      const elapsed = Date.now() - state.startMs;

      // 150 % duration → hard abort with reason "timeout" (Requirement 1.6).
      if (elapsed >= state.durationMs * 1.5) {
        state.inFlight = false;
        await forceAbortWithEvent(state, "duration_timeout_150pct", "timeout");
        return;
      }

      // Duration elapsed OR token budget exhausted → closing (Req 1.5, 8.7).
      if (!state.closing) {
        if (elapsed >= state.durationMs) {
          await transitionToClosing(state, "duration_elapsed");
        } else if (state.tokensUsed >= state.tokenBudget) {
          await transitionToClosing(state, "token_budget_exhausted");
        }
      }

      // Pick the next agent in round-robin order and let it step.
      await runOneAgentStep(state);
    } finally {
      state.inFlight = false;
    }

    if (!state.aborted) {
      scheduleNextTick(state);
    }
  }

  async function runOneAgentStep(state: RunningSprintState): Promise<void> {
    const agentsArray = [...state.pool.agents.values()];
    if (agentsArray.length === 0) return;

    const idx = state.nextAgentIdx % agentsArray.length;
    state.nextAgentIdx = (idx + 1) % agentsArray.length;
    const agent = agentsArray[idx];

    // Load a lightweight context for this step. Failures here are
    // isolated: a broken workspace read shouldn't crash the scheduler.
    let planMd = "";
    let recentLog: string[] = [];
    try {
      const workspace = createWorkspaceWriter(state.sprintId);
      planMd = await workspace.read("plan.md");
      const logMd = await workspace.read("log.md");
      recentLog = logMd.split("\n").slice(-30);
    } catch {
      // Workspace may be torn down mid-flight; fall through with empties.
    }

    const tokenBudgetRemaining = Math.max(
      0,
      state.tokenBudget - state.tokensUsed,
    );

    const result = await agent.step({
      sprintId: state.sprintId,
      planMd,
      recentLog,
      assignedTickets: [],
      tokenBudgetRemaining,
    });

    if (result.kind === "tool_call") {
      const call: ToolCall = {
        kind: "tool_call",
        tool: result.tool,
        parameters: result.parameters,
      };
      const execResult: ToolResult = await state.executor.execute({
        sprintId: state.sprintId,
        agentRole: agent.role,
        call,
      });
      // `execute` never throws — errors are returned as `ok: false`.
      // The action log has already captured the outcome.
      void execResult;
    }
    // `noop` and `error` results are already logged by the executor (for
    // tool calls) or are inherently side-effect-free. Nothing more to do.
  }

  async function transitionToClosing(
    state: RunningSprintState,
    eventType: "duration_elapsed" | "token_budget_exhausted",
  ): Promise<void> {
    try {
      const sprint = await Sprint.findById(state.sprintId);
      if (!sprint || isTerminal(sprint.status)) return;

      const transition = nextState(sprint, {
        type: eventType,
      } as SprintStateEvent);
      if (!transition.ok) return;

      sprint.status = transition.next;
      sprint.closingAt = new Date();
      await sprint.save();
      state.closing = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[sprint-runner] transitionToClosing failed", err);
    }
  }

  async function forceAbortWithEvent(
    state: RunningSprintState,
    eventType:
      | "duration_timeout_150pct"
      | "process_restart"
      | "abort",
    reason: string,
  ): Promise<void> {
    try {
      const sprint = await Sprint.findById(state.sprintId);
      if (!sprint || isTerminal(sprint.status)) {
        await teardownState(state);
        return;
      }
      const transition = nextState(sprint, {
        type: eventType,
      } as SprintStateEvent);
      if (!transition.ok) {
        await teardownState(state);
        return;
      }
      sprint.status = transition.next;
      sprint.abortedAt = new Date();
      sprint.abortReason = reason;
      await sprint.save();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[sprint-runner] forceAbortWithEvent failed", err);
    } finally {
      await teardownState(state);
    }
  }

  // ------------------------- abort -----------------------------------------

  async function abort(sprintId: string, reason?: string): Promise<void> {
    const state = states.get(sprintId);

    // The admin "abort" event transitions via `nextState` regardless of
    // whether this process still holds in-memory state (the sprint may
    // have rehydrated from a previous process).
    if (!state) {
      await dbConnect();
      const sprint = await Sprint.findById(sprintId);
      if (!sprint) {
        throw new SprintRunnerError("NOT_FOUND", `sprint ${sprintId} not found`);
      }
      if (isTerminal(sprint.status)) return;

      const transition = nextState(sprint, { type: "abort" });
      if (!transition.ok) {
        throw new SprintRunnerError(
          "ILLEGAL_TRANSITION",
          transition.message ?? "abort rejected",
        );
      }
      sprint.status = transition.next;
      sprint.abortedAt = new Date();
      sprint.abortReason = reason ?? "admin";
      await sprint.save();
      return;
    }

    // In-process path: flag the scheduler, wait up to 30 s for the
    // current tick to settle, then teardown.
    state.aborted = true;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }

    await waitForQuiescence(state, ABORT_GRACE_MS);

    try {
      const sprint = await Sprint.findById(sprintId);
      if (sprint && !isTerminal(sprint.status)) {
        const transition = nextState(sprint, { type: "abort" });
        if (transition.ok) {
          sprint.status = transition.next;
          sprint.abortedAt = new Date();
          sprint.abortReason = reason ?? "admin";
          await sprint.save();
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[sprint-runner] abort persistence failed", err);
    } finally {
      await teardownState(state);
    }
  }

  async function waitForQuiescence(
    state: RunningSprintState,
    graceMs: number,
  ): Promise<void> {
    const deadline = Date.now() + graceMs;
    while (state.inFlight && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  async function teardownState(state: RunningSprintState): Promise<void> {
    states.delete(state.sprintId);
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }
    try {
      await state.testInstance.stop();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[sprint-runner] testInstance.stop failed", err);
    }
    try {
      const env = loadSprintEnv();
      await dropTestDatabase(state.sprintId, env.MONGODB_URI);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[sprint-runner] dropTestDatabase failed", err);
    }
  }

  // ------------------------- getStatus -------------------------------------

  async function getStatus(sprintId: string): Promise<SprintStatusView> {
    const sprint = await loadSprint(sprintId);

    // Count findings by severity in a single aggregation.
    const severityCounts = await Finding.aggregate<{
      _id: FindingSeverity;
      count: number;
    }>([
      { $match: { sprintId: sprint._id } },
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]);
    const bySeverity: Record<FindingSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    let total = 0;
    for (const row of severityCounts) {
      bySeverity[row._id] = row.count;
      total += row.count;
    }

    // Read the tail of log.md. If the workspace doesn't exist yet
    // (early `pending` state) return an empty list.
    let recentLogEntries: string[] = [];
    try {
      const workspace = createWorkspaceWriter(sprintId);
      const logMd = await workspace.read("log.md");
      recentLogEntries = logMd
        .split("\n")
        .filter((l) => l.length > 0)
        .slice(-30);
    } catch {
      // not initialized yet
    }

    const elapsedMs = sprint.startedAt
      ? Date.now() - sprint.startedAt.getTime()
      : 0;

    return {
      sprintId,
      status: sprint.status,
      result: sprint.result,
      durationMinutes: sprint.durationMinutes,
      startedAt: sprint.startedAt,
      goals: [...sprint.goals],
      activeAgents: sprint.agents.map((a) => a.role),
      findingCounts: {
        total,
        bySeverity,
      },
      elapsedMs,
      tokensUsed: sprint.tokensUsed,
      tokenBudget: sprint.tokenBudget,
      hasCriticalFinding: sprint.hasCriticalFinding,
      recentLogEntries,
    };
  }

  // ------------------------- rehydrate -------------------------------------

  async function _rehydrate(): Promise<void> {
    await dbConnect();
    const stale = await Sprint.find({
      status: { $in: ["running", "closing"] },
    });
    for (const sprint of stale) {
      // We can't resume a sprint across process boundaries (test
      // instance + in-memory state are both gone). Transition to
      // aborted with reason=process_restart.
      const transition = nextState(sprint, { type: "process_restart" });
      if (!transition.ok) continue;
      sprint.status = transition.next;
      sprint.abortedAt = new Date();
      sprint.abortReason = "process_restart";
      try {
        await sprint.save();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[sprint-runner] rehydrate persist failed", err);
      }
    }
  }

  return {
    create,
    start,
    abort,
    getStatus,
    _rehydrate,
  };
}

// ---------------------------------------------------------------------------
// Process-wide singleton
// ---------------------------------------------------------------------------

let sharedRunner: SprintRunner | undefined;
let rehydrated = false;

/**
 * Lazily construct the per-process SprintRunner and trigger one-time
 * rehydration on first use. Subsequent calls return the cached instance.
 */
export function getSharedSprintRunner(): SprintRunner {
  if (sharedRunner === undefined) {
    sharedRunner = createSprintRunner();
  }
  if (!rehydrated) {
    rehydrated = true;
    // Fire-and-forget: rehydrate runs once and is idempotent.
    sharedRunner._rehydrate().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[sprint-runner] initial rehydrate failed", err);
    });
  }
  return sharedRunner;
}

/** Test hook: reset the singleton so each test starts clean. */
export function _resetSharedSprintRunnerForTests(): void {
  sharedRunner = undefined;
  rehydrated = false;
}
