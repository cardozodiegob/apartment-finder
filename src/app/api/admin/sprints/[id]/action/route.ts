/**
 * Admin API: POST /api/admin/sprints/[id]/action
 *
 * Two supported actions, both operating on a specific FixProposal in
 * the sprint:
 *
 *   - `merge_to_main` — fast-forward or squash-merge the fix's sprint
 *     branch into `mainline`. Requires `status === "committed"` and a
 *     recorded branch. Returns the merged HEAD SHA.
 *   - `revert_commit` — create a `git revert` commit on the sprint
 *     branch against the fix's `commitSha`. Sets the FixProposal status
 *     to `reverted`. Returns the new SHA.
 *
 * `GitSafetyError` surfaces as a 409 with `details.attempted` so the
 * admin UI can distinguish push/force attempts from merge-conflict
 * failures.
 *
 * Requirements: 9.5, 9.6, 9.7
 */

import { z } from "zod";

import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/session";
import dbConnect from "@/lib/db/connection";
import FixProposal from "@/lib/db/models/FixProposal";
import { createSprintGit } from "@/lib/sprint/git";

import { assertObjectId, mapSprintRunnerError } from "../../_helpers";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const fixProposalIdRe = /^P-[a-z0-9]{6}-\d+$/;

const actionBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("merge_to_main"),
    fixProposalId: z.string().regex(fixProposalIdRe),
    strategy: z.enum(["ff", "squash"]).default("ff"),
  }),
  z.object({
    action: z.literal("revert_commit"),
    fixProposalId: z.string().regex(fixProposalIdRe),
  }),
]);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
    const { id: sprintId } = await params;
    assertObjectId(sprintId, "sprintId");

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ApiErrorResponse(
        "VALIDATION",
        "Request body must be valid JSON",
        400,
      );
    }

    const parsed = actionBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ApiErrorResponse(
        "VALIDATION",
        "Invalid action payload",
        400,
        parsed.error.flatten(),
      );
    }

    await dbConnect();
    const fp = await FixProposal.findOne({
      sprintId,
      id: parsed.data.fixProposalId,
    });
    if (!fp) {
      throw new ApiErrorResponse(
        "NOT_FOUND",
        `FixProposal ${parsed.data.fixProposalId} not found on sprint`,
        404,
      );
    }

    try {
      if (parsed.data.action === "merge_to_main") {
        if (fp.status !== "committed" || !fp.branch) {
          throw new ApiErrorResponse(
            "ILLEGAL_STATE",
            `FixProposal must be "committed" with a recorded branch; got status="${fp.status}"`,
            409,
          );
        }

        const git = await createSprintGit();
        const mergedSha = await git.mergeToMainline(
          fp.branch,
          parsed.data.strategy,
        );
        return Response.json({
          ok: true,
          mergedSha,
          branch: fp.branch,
          strategy: parsed.data.strategy,
        });
      }

      // revert_commit
      if (fp.status !== "committed" || !fp.commitSha || !fp.branch) {
        throw new ApiErrorResponse(
          "ILLEGAL_STATE",
          `FixProposal must be "committed" with a recorded commitSha and branch; got status="${fp.status}"`,
          409,
        );
      }

      const git = await createSprintGit();
      const revertSha = await git.revert(fp.branch, fp.commitSha);
      fp.status = "reverted";
      await fp.save();
      return Response.json({
        ok: true,
        revertSha,
        branch: fp.branch,
      });
    } catch (err) {
      mapSprintRunnerError(err);
    }
  } catch (err) {
    return errorResponse(err);
  }
  return errorResponse(
    new ApiErrorResponse("INTERNAL_ERROR", "Unreachable", 500),
  );
}
