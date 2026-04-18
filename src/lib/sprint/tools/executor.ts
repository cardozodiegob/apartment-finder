/**
 * Tool_Executor — the guard that sits between agents and side-effects.
 *
 * Pipeline for every call (see design §"Tool_Executor" and Property 6):
 *   1. Compute a deterministic `parameterDigest` over the raw params.
 *   2. Look up the tool in the frozen registry. Unknown → reject.
 *   3. Check the tool is in the agent's frozen per-role allow-list.
 *      Not allowed → reject. The allow-list is loaded once at sprint start
 *      and frozen in memory for the sprint's lifetime; a modified manifest
 *      on disk cannot expand a running agent's powers.
 *   4. Validate `parameters` against the tool's Zod schema. Invalid → reject.
 *   5. Invoke `tool.run(parsed, ctx)`. Throw → `execution_error`.
 *
 * Every branch writes EXACTLY ONE `sprintActionLog` entry — this is the
 * core invariant enforced by Property 6. `rawParameters` / `rawResponse`
 * are only included in the entry when `verboseLogs === true`
 * (i.e. `SPRINT_VERBOSE_LOGS=true`).
 *
 * Requirements: 2.7, 13.1, 13.2, 13.3, 13.4, 13.6
 */

import { createHash } from "node:crypto";
import { Types } from "mongoose";
import type { z } from "zod";

import dbConnect from "@/lib/db/connection";
import SprintActionLog, {
  type SprintActionLogOutcome,
} from "@/lib/db/models/SprintActionLog";
import type { AgentRole, ToolCall, ToolResult } from "@/lib/sprint/types";

// ---------------------------------------------------------------------------
// Tool registry contract — the shape every concrete tool impl under
// src/lib/sprint/tools/impl/*.ts will export.
// ---------------------------------------------------------------------------

export interface ToolRunContext {
  /** 24-char hex Mongo ObjectId of the current sprint. */
  readonly sprintId: string;
  readonly agentRole: AgentRole;
}

export interface ToolDefinition<TParams = unknown, TOutput = unknown> {
  /** Dotted tool name, e.g. `workspace.append`. Must match the manifest. */
  readonly name: string;
  /** Zod schema the executor validates `parameters` against. */
  readonly schema: z.ZodType<TParams>;
  /** The side-effectful implementation. Throws `Error` or returns `TOutput`. */
  run(params: TParams, ctx: ToolRunContext): Promise<TOutput>;
}

// ---------------------------------------------------------------------------
// Public executor API
// ---------------------------------------------------------------------------

export interface ExecuteInput {
  readonly sprintId: string;
  readonly agentRole: AgentRole;
  readonly call: ToolCall;
}

export interface ToolExecutor {
  /** Executes one call through the allow-list guard + schema validator + impl. */
  execute(input: ExecuteInput): Promise<ToolResult>;
  /** Test hook to list what the executor thinks an agent is allowed to call. */
  getAllowList(role: AgentRole): readonly string[];
}

export interface CreateToolExecutorOptions {
  /**
   * Frozen allow-lists per role. Loaded once at sprint start from
   * `src/lib/sprint/tools/<role>.json` and frozen — a modified file on disk
   * cannot expand a running agent's powers. The factory defensively freezes
   * its own copy even if the caller didn't.
   */
  readonly allowedToolsByRole: Readonly<
    Partial<Record<AgentRole, readonly string[]>>
  >;
  /** Registry of all known tool impls keyed by tool name. */
  readonly tools: Readonly<Record<string, ToolDefinition>>;
  /**
   * When true, include raw parameters/response in the action-log entry.
   * Maps to `SPRINT_VERBOSE_LOGS`. Defaults to false.
   */
  readonly verboseLogs?: boolean;
  /**
   * Optional override for the audit-log writer. Defaults to
   * {@link defaultActionLogWriter} which writes to the `sprintActionLog`
   * Mongo collection via `dbConnect()`.
   */
  readonly actionLogWriter?: ActionLogWriter;
}

// ---------------------------------------------------------------------------
// Action log writer
// ---------------------------------------------------------------------------

export interface ActionLogEntry {
  readonly sprintId: string;
  readonly agentRole: AgentRole;
  readonly toolName: string;
  /** sha256 hex over `JSON.stringify(parameters ?? null)`. */
  readonly parameterDigest: string;
  readonly outcome: SprintActionLogOutcome;
  readonly errorMessage?: string;
  /** Only present when `verboseLogs === true`. */
  readonly rawParameters?: unknown;
  /** Only present when `verboseLogs === true`. */
  readonly rawResponse?: unknown;
}

export interface ActionLogWriter {
  write(entry: ActionLogEntry): Promise<void>;
}

/**
 * Default writer that persists to the `sprintActionLog` collection.
 *
 * DB-layer errors are swallowed + warned so a dead DB doesn't cascade into
 * a dead sprint. The executor's job is to enforce the invariants, not to
 * be the retry layer for Mongo.
 */
export const defaultActionLogWriter: ActionLogWriter = {
  async write(entry: ActionLogEntry): Promise<void> {
    try {
      await dbConnect();
      const doc: Record<string, unknown> = {
        timestamp: new Date(),
        sprintId: new Types.ObjectId(entry.sprintId),
        agentRole: entry.agentRole,
        toolName: entry.toolName,
        parameterDigest: entry.parameterDigest,
        outcome: entry.outcome,
      };
      if (entry.errorMessage !== undefined) {
        doc.errorMessage = entry.errorMessage;
      }
      if ("rawParameters" in entry) {
        doc.rawParameters = entry.rawParameters;
      }
      if ("rawResponse" in entry) {
        doc.rawResponse = entry.rawResponse;
      }
      await SprintActionLog.create(doc);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        "[sprint-tool-executor] failed to write sprintActionLog entry",
        { toolName: entry.toolName, outcome: entry.outcome, err },
      );
    }
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Stable SHA-256 of the JSON serialization of `parameters ?? null`. */
function computeParameterDigest(parameters: unknown): string {
  const serialized = JSON.stringify(parameters ?? null);
  return createHash("sha256").update(serialized ?? "null").digest("hex");
}

/** Truncate an error message for safe persistence. */
function safeErrorMessage(err: unknown, max = 2000): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : (() => {
            try {
              return JSON.stringify(err);
            } catch {
              return String(err);
            }
          })();
  return raw.length > max ? `${raw.slice(0, max)}…` : raw;
}

/** Freeze a per-role allow-list map defensively. */
function freezeAllowLists(
  input: Readonly<Partial<Record<AgentRole, readonly string[]>>>,
): Readonly<Partial<Record<AgentRole, readonly string[]>>> {
  const out: Partial<Record<AgentRole, readonly string[]>> = {};
  for (const [role, list] of Object.entries(input) as Array<
    [AgentRole, readonly string[] | undefined]
  >) {
    if (list === undefined) continue;
    out[role] = Object.freeze([...list]);
  }
  return Object.freeze(out);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build a {@link ToolExecutor} bound to a frozen per-role allow-list.
 *
 * The returned executor is safe to share across all agents for the sprint's
 * lifetime. The allow-list is defensively frozen inside the factory; the
 * caller does NOT need to pre-freeze.
 */
export function createToolExecutor(
  options: CreateToolExecutorOptions,
): ToolExecutor {
  const allowedToolsByRole = freezeAllowLists(options.allowedToolsByRole);
  const tools = options.tools;
  const verbose = options.verboseLogs === true;
  const writer = options.actionLogWriter ?? defaultActionLogWriter;

  const emptyAllowList: readonly string[] = Object.freeze([]);

  async function logAndReturn(
    input: ExecuteInput,
    parameterDigest: string,
    outcome: SprintActionLogOutcome,
    errorMessage: string | undefined,
    rawResponse: unknown,
    result: ToolResult,
  ): Promise<ToolResult> {
    const entry: ActionLogEntry = {
      sprintId: input.sprintId,
      agentRole: input.agentRole,
      toolName: input.call.tool,
      parameterDigest,
      outcome,
      ...(errorMessage !== undefined ? { errorMessage } : {}),
      ...(verbose ? { rawParameters: input.call.parameters } : {}),
      ...(verbose && rawResponse !== undefined
        ? { rawResponse }
        : {}),
    };
    await writer.write(entry);
    return result;
  }

  return {
    getAllowList(role: AgentRole): readonly string[] {
      return allowedToolsByRole[role] ?? emptyAllowList;
    },

    async execute(input: ExecuteInput): Promise<ToolResult> {
      const { call, agentRole } = input;
      const parameterDigest = computeParameterDigest(call.parameters);

      // 1. Tool registered?
      const tool = tools[call.tool];
      if (!tool) {
        const errorMessage = `tool "${call.tool}" is not registered`;
        return logAndReturn(
          input,
          parameterDigest,
          "rejected_unknown_tool",
          errorMessage,
          undefined,
          { ok: false, errorCode: "UNKNOWN_TOOL", errorMessage },
        );
      }

      // 2. Allow-listed for this role?
      const allowList = allowedToolsByRole[agentRole] ?? emptyAllowList;
      if (!allowList.includes(call.tool)) {
        const errorMessage = `tool "${call.tool}" is not allowed for role "${agentRole}"`;
        return logAndReturn(
          input,
          parameterDigest,
          "rejected_not_allowed",
          errorMessage,
          undefined,
          { ok: false, errorCode: "NOT_ALLOWED", errorMessage },
        );
      }

      // 3. Params valid?
      const parsed = tool.schema.safeParse(call.parameters);
      if (!parsed.success) {
        const errorMessage = JSON.stringify(parsed.error.issues);
        return logAndReturn(
          input,
          parameterDigest,
          "rejected_invalid_params",
          errorMessage,
          undefined,
          { ok: false, errorCode: "INVALID_PARAMS", errorMessage },
        );
      }

      // 4. Invoke.
      try {
        const output = await tool.run(parsed.data, {
          sprintId: input.sprintId,
          agentRole,
        });
        return logAndReturn(
          input,
          parameterDigest,
          "ok",
          undefined,
          output,
          { ok: true, output },
        );
      } catch (err) {
        const errorMessage = safeErrorMessage(err);
        return logAndReturn(
          input,
          parameterDigest,
          "execution_error",
          errorMessage,
          undefined,
          { ok: false, errorCode: "EXECUTION_ERROR", errorMessage },
        );
      }
    },
  };
}
