/**
 * `workspace.create_ticket` tool implementation.
 *
 * Creates `.kiro/sprints/<sprintId>/tickets/<ticketId>.md` exactly once
 * (duplicates are rejected by the writer) and appends a reference line
 * to `plan.md`. The reference-line append triggers the usual log entry.
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
  ticketId: z
    .string()
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/,
      "ticketId must match [A-Za-z0-9][A-Za-z0-9._-]{0,63}",
    ),
  body: z.string().min(1, "body must be a non-empty string"),
});

export type WorkspaceCreateTicketParams = z.infer<typeof paramsSchema>;

export type WorkspaceCreateTicketOutput = AppendResult;

export const workspaceCreateTicketToolDef: ToolDefinition<
  WorkspaceCreateTicketParams,
  WorkspaceCreateTicketOutput
> = {
  name: "workspace.create_ticket",
  schema: paramsSchema,
  async run(
    { ticketId, body },
    { sprintId, agentRole },
  ): Promise<AppendResult> {
    const writer = createWorkspaceWriter(sprintId);
    return writer.createTicket(ticketId, body, {
      actor: agentRole,
      toolName: "workspace.create_ticket",
    });
  },
};
