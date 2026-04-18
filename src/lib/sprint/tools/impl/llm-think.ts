/**
 * `llm.think` tool implementation.
 *
 * Structured reasoning tool with NO side-effects beyond the single
 * action-log entry that the Tool_Executor writes for every invocation.
 * The caller (the coordinator) is free to splice the returned `note`
 * into the agent's ephemeral scratchpad.
 *
 * Requirements: 13.2, 13.3
 */

import { z } from "zod";

import type { ToolDefinition } from "../executor";

const paramsSchema = z.object({
  note: z
    .string()
    .min(1, "note must be a non-empty string")
    .max(2000, "note must be ≤ 2000 characters"),
});

export type LlmThinkParams = z.infer<typeof paramsSchema>;

export interface LlmThinkOutput {
  note: string;
}

export const llmThinkToolDef: ToolDefinition<LlmThinkParams, LlmThinkOutput> = {
  name: "llm.think",
  schema: paramsSchema,
  async run({ note }): Promise<LlmThinkOutput> {
    // Pure echo — no DB, no filesystem. The executor's action-log entry
    // is the only durable record of this call.
    return { note };
  },
};
