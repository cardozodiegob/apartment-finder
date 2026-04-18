/**
 * Structured-response parser for LLM agent output.
 *
 * Agents are instructed to emit a single JSON object of shape
 * `{ tool: string, parameters: unknown }` per step. The Tool_Executor
 * never touches raw LLM output — it consumes the validated result of
 * {@link parseAgentResponse} below.
 *
 * Failure modes produce a `corrective_prompt` payload that the caller
 * can feed back to the agent instead of a tool execution. This keeps
 * malformed output from reaching any side-effecting code path.
 *
 * Requirements: 2.3, 13.2
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for a tool call. Parameters are validated downstream by the
 * tool's own schema inside the executor; here we only enforce the outer
 * envelope (non-empty tool name + presence of a `parameters` field).
 */
export const toolCallSchema = z.object({
  tool: z.string().trim().min(1, "tool must be a non-empty string"),
  parameters: z.unknown(),
});

export type ToolCallEnvelope = z.infer<typeof toolCallSchema>;

// ---------------------------------------------------------------------------
// Parsed response union
// ---------------------------------------------------------------------------

/** The no-op sentinel tool name. Agents use this to "think" without side-effects. */
export const NOOP_TOOL_NAME = "llm.think";

export type ParsedAgentResponse =
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
      readonly kind: "corrective_prompt";
      readonly reason: "malformed_json" | "schema_mismatch";
      readonly originalText: string;
      readonly issues?: unknown;
    };

// ---------------------------------------------------------------------------
// Fence stripping
// ---------------------------------------------------------------------------

/**
 * Strip a leading/trailing markdown code fence if present. Agents are told
 * to emit raw JSON, but many models wrap their output in ```json ... ```
 * despite instructions to the contrary. We accept both fenced and unfenced
 * input so one stray fence doesn't cause a `malformed_json` round-trip.
 */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  // Match an opening fence (```json, ```JSON, ``` etc) and a closing ```.
  const match = trimmed.match(/^```(?:[A-Za-z0-9_-]+)?\s*\n([\s\S]*?)\n?```$/);
  if (match) return match[1].trim();
  return trimmed;
}

// ---------------------------------------------------------------------------
// No-op detection
// ---------------------------------------------------------------------------

function isNoopToolCall(
  parsed: unknown,
): parsed is { tool: string; parameters?: { note?: unknown } } {
  if (typeof parsed !== "object" || parsed === null) return false;
  const record = parsed as Record<string, unknown>;
  return record.tool === NOOP_TOOL_NAME;
}

function extractNoopNote(parameters: unknown): string | undefined {
  if (typeof parameters !== "object" || parameters === null) return undefined;
  const record = parameters as Record<string, unknown>;
  const note = record.note;
  return typeof note === "string" ? note : undefined;
}

// ---------------------------------------------------------------------------
// parseAgentResponse
// ---------------------------------------------------------------------------

/**
 * Parse a raw agent response into a structured {@link ParsedAgentResponse}.
 *
 * Behavior (in order):
 *   1. Strip a surrounding markdown code fence if present.
 *   2. `JSON.parse` the payload. On failure -> `corrective_prompt` with
 *      reason `malformed_json`.
 *   3. If the parsed object's `tool` is `llm.think` -> `noop` (with an
 *      optional `note` lifted from `parameters.note`).
 *   4. Otherwise validate against {@link toolCallSchema}. On success ->
 *      `tool_call`. On failure -> `corrective_prompt` with reason
 *      `schema_mismatch` and the raw Zod issues array attached.
 */
export function parseAgentResponse(raw: string): ParsedAgentResponse {
  const stripped = stripCodeFence(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return {
      kind: "corrective_prompt",
      reason: "malformed_json",
      originalText: raw,
    };
  }

  if (isNoopToolCall(parsed)) {
    const note = extractNoopNote(
      (parsed as { parameters?: unknown }).parameters,
    );
    return note === undefined ? { kind: "noop" } : { kind: "noop", note };
  }

  const result = toolCallSchema.safeParse(parsed);
  if (!result.success) {
    return {
      kind: "corrective_prompt",
      reason: "schema_mismatch",
      originalText: raw,
      issues: result.error.issues,
    };
  }

  return {
    kind: "tool_call",
    tool: result.data.tool,
    parameters: result.data.parameters,
  };
}
