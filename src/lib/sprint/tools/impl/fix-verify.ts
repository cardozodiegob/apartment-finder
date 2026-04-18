/**
 * `fix.verify` tool implementation.
 *
 * Runs the Verification_Gate against a previously-proposed fix and
 * updates the FixProposal record with the outcome. The tool itself is
 * an orchestration shell — the gate's pipeline (vitest / next-lint /
 * tsc / playwright) lives in `src/lib/sprint/verify.ts`.
 *
 * Pipeline:
 *   1. Load the FixProposal by `{sprintId, id}` (scoped so an id from
 *      another sprint cannot be verified).
 *   2. Look up the linked Findings so the gate can decide whether
 *      Playwright is required (accessibility / ux / i18n triggers).
 *   3. Bump `verificationAttempts`, set `status = "verifying"`, save.
 *   4. Check out (or create) `sprint/<sprintId>/fix-<fixProposalId>`
 *      via the git wrapper.
 *   5. Run the gate. The gate applies fileChanges onto the branch and
 *      runs the full pipeline up to the 600 s wall-clock cap.
 *   6. Translate the report back to a FixStatus:
 *        - `overall = "passed"`         → status = "passed"
 *        - any step is `timeout` AND    → status = "failed",
 *          wallClock > 600 s             rejectReason = "timeout"
 *        - verificationAttempts > 3     → status = "rejected",
 *                                         rejectReason = "verify_attempts_exhausted"
 *        - otherwise                    → status = "failed",
 *                                         rejectReason = "verification_failed"
 *
 * Retry orchestration (max 3 retries per fix) lives in the Sprint_Runner;
 * the gate itself never retries internally.
 *
 * Requirements: 6.3, 6.4, 6.5, 6.6, 6.10
 */

import { Types } from "mongoose";
import { z } from "zod";

import dbConnect from "@/lib/db/connection";
import FixProposal from "@/lib/db/models/FixProposal";
import Finding from "@/lib/db/models/Finding";
import { createSprintGit } from "@/lib/sprint/git";
import type { FixRejectReason } from "@/lib/db/models/FixProposal";
import {
  runVerificationGate,
  VERIFICATION_WALL_CLOCK_CAP_MS,
} from "@/lib/sprint/verify";
import type {
  FindingCategory,
  FixStatus,
  VerificationReport,
} from "@/lib/sprint/types";

import type { ToolDefinition } from "../executor";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const FIX_ID_RE = /^P-[a-z0-9]{6}-\d+$/;

const paramsSchema = z.object({
  fixProposalId: z.string().regex(FIX_ID_RE, "fixProposalId must match P-<6-alnum>-<n>"),
});

export type FixVerifyParams = z.infer<typeof paramsSchema>;

export interface FixVerifyOutput {
  report: VerificationReport;
  newStatus: FixStatus;
  rejectReason?: FixRejectReason;
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const fixVerifyToolDef: ToolDefinition<
  FixVerifyParams,
  FixVerifyOutput
> = {
  name: "fix.verify",
  schema: paramsSchema,
  async run(params, ctx): Promise<FixVerifyOutput> {
    await dbConnect();

    const sprintObjectId = new Types.ObjectId(ctx.sprintId);

    // 1. Load the proposal (sprint-scoped).
    const fp = await FixProposal.findOne({
      sprintId: sprintObjectId,
      id: params.fixProposalId,
    });
    if (!fp) {
      throw new Error("Fix proposal not found");
    }

    // 2. Collect linked finding categories so the gate can decide
    //    whether Playwright is required.
    const linkedFindings = await Finding.find(
      { sprintId: sprintObjectId, id: { $in: fp.findingIds } },
      { category: 1 },
    ).lean();
    const linkedFindingCategories: FindingCategory[] = linkedFindings.map(
      (f) => f.category,
    );

    // 3. Move the proposal into `verifying` before we start so observers
    //    see the in-flight state and subsequent verifies are serialized.
    fp.verificationAttempts = (fp.verificationAttempts ?? 0) + 1;
    fp.status = "verifying";
    await fp.save();

    const branch = `sprint/${ctx.sprintId}/fix-${fp.id}`;

    // 4. Prepare the fix branch. Creating a branch that already exists
    //    throws from simple-git; fall back to an assertion so re-verify
    //    on the same branch is idempotent.
    const git = await createSprintGit();
    try {
      await git.createFixBranch(ctx.sprintId, fp.id);
    } catch (err) {
      // Probably already exists — recover by confirming we're on it.
      try {
        await git.assertOnSprintBranch(branch);
      } catch {
        // Could not recover — rethrow the original branch-creation error.
        throw err;
      }
    }

    // 5. Run the verification pipeline. The gate applies fileChanges
    //    onto the branch and handles its own per-step timeouts.
    const report = await runVerificationGate({
      fixProposalId: fp.id,
      branch,
      fileChanges: fp.fileChanges,
      linkedFindingCategories,
      git,
    });

    // 6. Persist the report and map the outcome to a FixStatus.
    fp.lastVerificationReport = report;

    let newStatus: FixStatus;
    let rejectReason: FixRejectReason | undefined;

    if (report.overall === "passed") {
      newStatus = "passed";
      rejectReason = undefined;
    } else {
      const wallClockMs =
        report.completedAt.getTime() - report.startedAt.getTime();
      const hadTimeoutStep = report.steps.some((s) => s.status === "timeout");

      if ((fp.verificationAttempts ?? 0) > 3) {
        newStatus = "rejected";
        rejectReason = "verify_attempts_exhausted";
      } else if (
        hadTimeoutStep &&
        wallClockMs > VERIFICATION_WALL_CLOCK_CAP_MS
      ) {
        newStatus = "failed";
        rejectReason = "timeout";
      } else {
        newStatus = "failed";
        rejectReason = "verification_failed";
      }
    }

    fp.status = newStatus;
    if (rejectReason !== undefined) {
      fp.rejectReason = rejectReason;
    }
    await fp.save();

    return {
      report,
      newStatus,
      ...(rejectReason !== undefined ? { rejectReason } : {}),
    };
  },
};
