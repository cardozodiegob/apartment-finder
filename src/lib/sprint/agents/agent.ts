/**
 * Agent abstraction.
 *
 * An `Agent` wraps a role prompt, a shared `LlmClient`, and a single
 * `step(ctx)` method. The Sprint_Runner's scheduler calls `step()` once
 * per slice; the agent issues one LLM request, parses the response, and
 * returns a normalized {@link AgentStepResult}. The Tool_Executor is
 * invoked by the runner, not by the agent — this keeps the agent free
 * of side-effects so the scheduler can rate-limit, inspect, or even
 * replay a step in isolation.
 *
 * Parser-to-result mapping:
 *   - parser `tool_call`        → `{ kind: "tool_call", tool, parameters }`
 *   - parser `noop`             → `{ kind: "noop", note? }`
 *   - parser `corrective_prompt`→ `{ kind: "error", message }`
 *
 * Requirements: 2.3, 2.4
 */

import type { AgentRole } from "@/lib/sprint/types";
import type { LlmClient } from "@/lib/sprint/llm/client";
import { parseAgentResponse } from "@/lib/sprint/llm/parser";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Per-step context the runner hands each agent. Kept intentionally small
 * so the user prompt stays within token budgets — the heavy behavioural
 * guidance lives in the role prompt.
 */
export interface AgentStepContext {
  readonly sprintId: string;
  /** Latest `plan.md` snapshot (concatenated across rotated parts). */
  readonly planMd: string;
  /** Tail of `log.md` visible to this role (most recent ~30 entries). */
  readonly recentLog: readonly string[];
  /** Ticket ids currently assigned to this agent. */
  readonly assignedTickets: readonly string[];
  /** Remaining tokens in the per-sprint budget (may be 0). */
  readonly tokenBudgetRemaining: number;
}

/** Result of a single `Agent.step()` call. */
export type AgentStepResult =
  | {
      readonly kind: "tool_call";
      readonly tool: string;
      readonly parameters: unknown;
    }
  | {
      readonly kind: "noop";
      readonly note?: string;
    }
  | {
      readonly kind: "error";
      readonly message: string;
    };

export interface Agent {
  readonly role: AgentRole;
  readonly sprintId: string;
  step(ctx: AgentStepContext): Promise<AgentStepResult>;
}

export interface CreateAgentOptions {
  readonly role: AgentRole;
  readonly sprintId: string;
  /** Contents of `src/lib/sprint/prompts/<role>.md`, loaded at sprint start. */
  readonly rolePrompt: string;
  /** Shared LLM client — one instance is reused by every agent in the pool. */
  readonly llm: LlmClient;
}

// ---------------------------------------------------------------------------
// User-prompt rendering
// ---------------------------------------------------------------------------

/** Max chars of `planMd` splice included in each user prompt. */
const PLAN_EXCERPT_CHARS = 4_000;

/** Max log entries included in each user prompt (tail). */
const LOG_TAIL_ENTRIES = 30;

function buildUserPrompt(ctx: AgentStepContext, role: AgentRole): string {
  const planExcerpt =
    ctx.planMd.length <= PLAN_EXCERPT_CHARS
      ? ctx.planMd
      : `…[truncated ${ctx.planMd.length - PLAN_EXCERPT_CHARS} chars]…\n\n` +
        ctx.planMd.slice(-PLAN_EXCERPT_CHARS);

  const logTail = ctx.recentLog.slice(-LOG_TAIL_ENTRIES).join("");
  const assigned =
    ctx.assignedTickets.length === 0
      ? "(none)"
      : ctx.assignedTickets.map((t) => `- ${t}`).join("\n");

  return [
    `You are the \`${role}\` agent in sprint ${ctx.sprintId}.`,
    `Token budget remaining: ${ctx.tokenBudgetRemaining}.`,
    "",
    "## plan.md (latest)",
    "",
    planExcerpt.trim() === "" ? "(empty)" : planExcerpt,
    "",
    "## log.md tail (most recent entries)",
    "",
    logTail.trim() === "" ? "(empty)" : logTail,
    "",
    "## Tickets assigned to you",
    "",
    assigned,
    "",
    "## Your turn",
    "",
    "Pick the single most useful action. Respond with exactly one JSON",
    'object of shape `{ "tool": "<name>", "parameters": <object> }`.',
    "Emit `llm.think` when there is nothing actionable.",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build an Agent for a single `{sprintId, role}` pairing.
 *
 * The returned agent is stateless across steps — every `step()` call
 * issues a fresh LLM request with the role prompt as the system prompt
 * and the rendered context as the user prompt. This is deliberate: the
 * shared markdown workspace IS the conversation memory, so keeping
 * per-step state on the agent would duplicate (and risk diverging from)
 * the canonical state on disk.
 */
export function createAgent(options: CreateAgentOptions): Agent {
  const { role, sprintId, rolePrompt, llm } = options;

  async function step(ctx: AgentStepContext): Promise<AgentStepResult> {
    // Fast-path: if the budget is exhausted, don't even call the LLM —
    // the runner handles the budget-exhausted transition.
    if (ctx.tokenBudgetRemaining <= 0) {
      return {
        kind: "noop",
        note: "token budget exhausted",
      };
    }

    const userPrompt = buildUserPrompt(ctx, role);

    let rawText: string;
    try {
      const response = await llm.generate({
        systemPrompt: rolePrompt,
        userPrompt,
      });
      rawText = response.text;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { kind: "error", message };
    }

    const parsed = parseAgentResponse(rawText);
    switch (parsed.kind) {
      case "tool_call":
        return {
          kind: "tool_call",
          tool: parsed.tool,
          parameters: parsed.parameters,
        };
      case "noop":
        return parsed.note === undefined
          ? { kind: "noop" }
          : { kind: "noop", note: parsed.note };
      case "corrective_prompt":
        return {
          kind: "error",
          message: `agent response rejected: ${parsed.reason}`,
        };
    }
  }

  return { role, sprintId, step };
}
