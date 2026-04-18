/**
 * `workspace.read` tool implementation.
 *
 * Reads a logical markdown doc from the sprint workspace at
 * `.kiro/sprints/<sprintId>/`. Delegates to the workspace writer which
 * concatenates all rotated parts transparently.
 *
 * Requirements: 3.5, 3.7
 */

import { z } from "zod";

import { createWorkspaceWriter } from "@/lib/sprint/workspace";

import type { ToolDefinition } from "../executor";

const paramsSchema = z.object({
  /**
   * Logical doc name under the sprint workspace, e.g. `plan.md` or
   * `tickets/foo.md`. Must end in `.md` and use a restricted charset.
   * The workspace writer re-validates this on every call.
   */
  path: z
    .string()
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.md$/,
      "path must be a valid markdown filename",
    ),
});

export type WorkspaceReadParams = z.infer<typeof paramsSchema>;

export interface WorkspaceReadOutput {
  path: string;
  content: string;
}

export const workspaceReadToolDef: ToolDefinition<
  WorkspaceReadParams,
  WorkspaceReadOutput
> = {
  name: "workspace.read",
  schema: paramsSchema,
  async run({ path }, { sprintId }): Promise<WorkspaceReadOutput> {
    const writer = createWorkspaceWriter(sprintId);
    const content = await writer.read(path);
    return { path, content };
  },
};
