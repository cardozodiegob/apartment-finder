/**
 * `fix.propose` tool implementation.
 *
 * Validates an agent-proposed fix and persists it to MongoDB as a
 * {@link FixProposal} in `draft` status. The tool is deliberately small:
 * verification, commit, and spec-emission all live in separate tools
 * (`fix.verify`, `fix.commit`) so the flow can be paused for retries
 * between phases.
 *
 * Pipeline:
 *   1. Validate every `findingIds[i]` refers to a Finding in the current
 *      sprint; reject the whole proposal if any id is unknown.
 *   2. Allocate the next per-sprint sequence number and build the
 *      human-facing id `P-<sprint_short>-<sequence>`.
 *   3. Create the FixProposal with `status="draft"`, `verificationAttempts=0`,
 *      and `authorAgentRole = ctx.agentRole`.
 *
 * Requirements: 6.1, 6.2
 */

import { Types } from "mongoose";
import { z } from "zod";

import dbConnect from "@/lib/db/connection";
import Finding from "@/lib/db/models/Finding";
import FixProposal from "@/lib/db/models/FixProposal";
import {
  FILE_CHANGE_OPERATIONS,
  type FixStatus,
} from "@/lib/sprint/types";

import type { ToolDefinition } from "../executor";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const FINDING_ID_RE = /^F-[a-z0-9]{6}-\d+$/;

const paramsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  findingIds: z
    .array(z.string().regex(FINDING_ID_RE, "findingId must match F-<6-alnum>-<n>"))
    .min(1, "at least one findingId is required"),
  fileChanges: z
    .array(
      z.object({
        path: z.string().min(1),
        operation: z.enum(FILE_CHANGE_OPERATIONS),
        addedLines: z.number().int().min(0),
        removedLines: z.number().int().min(0),
        diff: z.string(),
      }),
    )
    .min(1, "at least one fileChange is required"),
  testPlan: z.string().default(""),
});

export type FixProposeParams = z.infer<typeof paramsSchema>;

export interface FixProposeOutput {
  id: string;
  status: FixStatus;
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const fixProposeToolDef: ToolDefinition<
  FixProposeParams,
  FixProposeOutput
> = {
  name: "fix.propose",
  schema: paramsSchema,
  async run(params, ctx): Promise<FixProposeOutput> {
    await dbConnect();

    const sprintObjectId = new Types.ObjectId(ctx.sprintId);

    // 1. Every findingId must exist in this sprint's Finding collection.
    //    We rely on `{sprintId, id}` so a cross-sprint id cannot leak in.
    const found = await Finding.find(
      { sprintId: sprintObjectId, id: { $in: params.findingIds } },
      { id: 1 },
    ).lean();
    const foundIds = new Set(found.map((f) => f.id));
    for (const fid of params.findingIds) {
      if (!foundIds.has(fid)) {
        throw new Error(`Unknown finding id: ${fid}`);
      }
    }

    // 2. Allocate the next per-sprint sequence number (1-based).
    const priorCount = await FixProposal.countDocuments({
      sprintId: sprintObjectId,
    });
    const id = `P-${ctx.sprintId.slice(0, 6).toLowerCase()}-${priorCount + 1}`;

    // 3. Persist the proposal in draft state.
    await FixProposal.create({
      id,
      sprintId: sprintObjectId,
      findingIds: params.findingIds,
      authorAgentRole: ctx.agentRole,
      title: params.title,
      fileChanges: params.fileChanges,
      testPlan: params.testPlan,
      status: "draft",
      verificationAttempts: 0,
    });

    return { id, status: "draft" };
  },
};
