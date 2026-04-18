/**
 * `workspace.append` tool implementation.
 *
 * Appends a block to a logical markdown doc in the sprint workspace.
 * The writer serializes appends, enforces the 2 MB per-part ceiling,
 * updates the cumulative hash, and auto-writes a matching log entry
 * (except when the target doc IS `log.md`).
 *
 * Requirements: 3.5, 3.7, 3.9
 */

import { z } from "zod";

import {
  createWorkspaceWriter,
  type AppendResult,
} from "@/lib/sprint/workspace";

import type { ToolDefinition } from "../executor";

const paramsSchema = z.object({
  path: z
    .string()
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.md$/,
      "path must be a valid markdown filename",
    ),
  block: z.string().min(1, "block must be a non-empty string"),
});

export type WorkspaceAppendParams = z.infer<typeof paramsSchema>;

export type WorkspaceAppendOutput = AppendResult;

export const workspaceAppendToolDef: ToolDefinition<
  WorkspaceAppendParams,
  WorkspaceAppendOutput
> = {
  name: "workspace.append",
  schema: paramsSchema,
  async run({ path, block }, { sprintId, agentRole }): Promise<AppendResult> {
    const writer = createWorkspaceWriter(sprintId);
    return writer.append(path, block, {
      actor: agentRole,
      toolName: "workspace.append",
    });
  },
};
