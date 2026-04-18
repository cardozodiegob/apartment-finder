/**
 * Pure sprint state guard.
 *
 * Encodes the transition table from the design's state machine section as a
 * single `nextState(sprint, event)` function plus the helpers `canStart` and
 * `isTerminal`. This module is deliberately free of side-effects (no fs, db,
 * or network): the coordinator calls it to decide whether a transition is
 * legal, and is solely responsible for executing the resulting side-effects.
 *
 * State machine (from design.md):
 *
 *   pending  -- start               --> running   (guarded by canStart)
 *   pending  -- abort               --> aborted
 *   running  -- duration_elapsed    --> closing
 *   running  -- token_budget_exhaus --> closing
 *   running  -- abort               --> aborted
 *   running  -- duration_timeout_150pct --> aborted  (reason=timeout)
 *   running  -- process_restart     --> aborted  (reason=process_restart)
 *   closing  -- close_all_complete  --> completed  (guarded: retro + no pending work)
 *   closing  -- abort               --> aborted
 *   closing  -- process_restart     --> aborted  (reason=process_restart)
 *   completed | aborted -- *        --> rejected (ILLEGAL_TRANSITION)
 *
 * Requirements: 1.3, 1.5, 1.6, 1.7, 1.8, 6.10, 8.7, 12.3, 12.6
 */

import type { AgentRole, SprintStatus } from "./types";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Minimal sprint shape this module needs. Kept intentionally narrow so
 * it can be constructed from either the Mongoose document or a plain
 * test fixture without depending on the full `ISprint` interface.
 */
export interface SprintStateInput {
  readonly status: SprintStatus;
  /**
   * Role list from the sprint record. Used by `canStart` to enforce that
   * a `tech_lead` participates (Requirement 2.5).
   */
  readonly roles?: readonly AgentRole[];
}

/**
 * Context passed alongside the `start` event. Kept separate from the
 * sprint record because these facts are evaluated live at start time
 * rather than persisted on the sprint.
 */
export interface StartContext {
  /** True when another sprint is already in status `running`. */
  readonly anotherSprintRunning: boolean;
  /** True when `.env.sprint` loaded and all required keys passed validation. */
  readonly envLoaded: boolean;
}

/** Every event recognised by `nextState`. */
export type SprintStateEvent =
  | { readonly type: "start"; readonly ctx: StartContext }
  | { readonly type: "abort" }
  | { readonly type: "duration_elapsed" }
  | { readonly type: "token_budget_exhausted" }
  | { readonly type: "duration_timeout_150pct" }
  | { readonly type: "process_restart" }
  | { readonly type: "agents_finished_closing" }
  | { readonly type: "retrospective_written" }
  | { readonly type: "close_all_complete" };

/** All event type discriminants, re-exported for test generators. */
export const SPRINT_STATE_EVENT_TYPES = [
  "start",
  "abort",
  "duration_elapsed",
  "token_budget_exhausted",
  "duration_timeout_150pct",
  "process_restart",
  "agents_finished_closing",
  "retrospective_written",
  "close_all_complete",
] as const;

export type SprintStateEventType = (typeof SPRINT_STATE_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/** Structured reason tag carried on some aborted transitions. */
export type AbortReason = "admin" | "timeout" | "process_restart";

/** Successful transition. */
export interface NextStateOk {
  readonly ok: true;
  readonly next: SprintStatus;
  readonly reason?: AbortReason;
}

/** Rejected transition — guard failed or event is illegal for `from`. */
export interface NextStateErr {
  readonly ok: false;
  readonly code:
    | "ILLEGAL_TRANSITION"
    | "CONCURRENT_SPRINT"
    | "VALIDATION"
    | "ENV_MISSING";
  readonly from: SprintStatus;
  readonly event: SprintStateEventType;
  readonly message?: string;
}

export type NextStateResult = NextStateOk | NextStateErr;

/** Result of {@link canStart}. */
export type CanStartResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: "CONCURRENT_SPRINT" | "VALIDATION" | "ENV_MISSING";
      readonly message: string;
    };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The two absorbing states. */
const TERMINAL_STATUSES = new Set<SprintStatus>(["completed", "aborted"]);

/** True when `status` is an absorbing terminal state. */
export function isTerminal(status: SprintStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Evaluate the start-time guards:
 *   (a) sprint roster includes `tech_lead` (Requirement 2.5)
 *   (b) no other sprint is in status `running` (Requirement 12.6)
 *   (c) `.env.sprint` loaded with required keys (Requirement 12.5)
 *
 * The caller (Sprint_Runner) computes `ctx.anotherSprintRunning` from the
 * `sprints` collection and `ctx.envLoaded` from `loadSprintEnv()`.
 */
export function canStart(
  sprint: SprintStateInput,
  ctx: StartContext,
): CanStartResult {
  if (!sprint.roles || !sprint.roles.includes("tech_lead")) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Sprint must include the tech_lead role to start",
    };
  }
  if (ctx.anotherSprintRunning) {
    return {
      ok: false,
      code: "CONCURRENT_SPRINT",
      message: "Another sprint is already in status running",
    };
  }
  if (!ctx.envLoaded) {
    return {
      ok: false,
      code: "ENV_MISSING",
      message: ".env.sprint is missing or invalid",
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Transition table
// ---------------------------------------------------------------------------

function illegal(
  sprint: SprintStateInput,
  event: SprintStateEventType,
): NextStateErr {
  return {
    ok: false,
    code: "ILLEGAL_TRANSITION",
    from: sprint.status,
    event,
    message: `Event "${event}" is not legal from status "${sprint.status}"`,
  };
}

/**
 * Evaluate a single transition. Returns `{ok: true, next, reason?}` on
 * success or a structured error on rejection. Does not mutate any state.
 */
export function nextState(
  sprint: SprintStateInput,
  event: SprintStateEvent,
): NextStateResult {
  // Terminal states absorb every event — this invariant is what property
  // test 1 verifies.
  if (isTerminal(sprint.status)) {
    return illegal(sprint, event.type);
  }

  switch (sprint.status) {
    case "pending": {
      switch (event.type) {
        case "start": {
          const guard = canStart(sprint, event.ctx);
          if (!guard.ok) {
            return {
              ok: false,
              code: guard.code,
              from: sprint.status,
              event: event.type,
              message: guard.message,
            };
          }
          return { ok: true, next: "running" };
        }
        case "abort":
          return { ok: true, next: "aborted", reason: "admin" };
        default:
          return illegal(sprint, event.type);
      }
    }

    case "running": {
      switch (event.type) {
        case "duration_elapsed":
        case "token_budget_exhausted":
          return { ok: true, next: "closing" };
        case "abort":
          return { ok: true, next: "aborted", reason: "admin" };
        case "duration_timeout_150pct":
          return { ok: true, next: "aborted", reason: "timeout" };
        case "process_restart":
          return { ok: true, next: "aborted", reason: "process_restart" };
        default:
          return illegal(sprint, event.type);
      }
    }

    case "closing": {
      switch (event.type) {
        case "close_all_complete":
          return { ok: true, next: "completed" };
        case "abort":
          return { ok: true, next: "aborted", reason: "admin" };
        case "process_restart":
          return { ok: true, next: "aborted", reason: "process_restart" };
        default:
          return illegal(sprint, event.type);
      }
    }

    // Exhaustiveness guard: TypeScript narrows `sprint.status` to `never`
    // here once all non-terminal branches are handled, but we keep a
    // defensive runtime fallback in case a future SprintStatus is added.
    default:
      return illegal(sprint, event.type);
  }
}
