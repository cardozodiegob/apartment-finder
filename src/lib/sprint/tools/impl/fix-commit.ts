/**
 * `fix.commit` tool implementation.
 *
 * Auto_Commit entry point. Called only after `fix.verify` set the
 * FixProposal to `status = "passed"`. The tool:
 *
 *   1. Reloads the proposal and enforces the `passed` gate.
 *   2. Evaluates the spec-emission predicate (file count > 10,
 *      changed lines > 500, or a critical security finding). If it
 *      fires, the fix is promoted to a new `.kiro/specs/<name>/` entry
 *      (left untracked for human review) and marked `promoted_to_spec`
 *      — no git commit is made.
 *   3. Otherwise, confirms HEAD is still on the fix branch (set up by
 *      `fix.verify`), builds the commit-summary inputs from the linked
 *      findings and last verification report, and delegates to the git
 *      wrapper's `commitFix`.
 *   4. Persists `status = "committed"`, the commit SHA, and branch name.
 *
 * Requirements: 6.7, 6.8, 11.1, 11.2, 11.3, 11.4
 */

import { Types } from "mongoose";
import { z } from "zod";

import dbConnect from "@/lib/db/connection";
import Finding from "@/lib/db/models/Finding";
import FixProposal from "@/lib/db/models/FixProposal";
import { createSprintGit, type VerificationSummary } from "@/lib/sprint/git";
import { evaluateAndEmitSpec } from "@/lib/sprint/spec-emitter";
import type {
  FixStatus,
  VerificationStepName,
  VerificationStepStatus,
} from "@/lib/sprint/types";

import type { ToolDefinition } from "../executor";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const FIX_ID_RE = /^P-[a-z0-9]{6}-\d+$/;

const paramsSchema = z.object({
  fixProposalId: z.string().regex(FIX_ID_RE, "fixProposalId must match P-<6-alnum>-<n>"),
});

export type FixCommitParams = z.infer<typeof paramsSchema>;

export interface FixCommitOutput {
  status: FixStatus;
  commitSha: string | null;
  branch: string | null;
  promotedSpecPath: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_VERIFICATION: VerificationSummary = {
  vitest: "skipped",
  "next-lint": "skipped",
  tsc: "skipped",
  playwright: "skipped",
};

/**
 * Translate the persisted step array into the {name → status} record
 * required by the git wrapper's commit-message trailer builder. Missing
 * steps default to `"skipped"`.
 */
function summarizeVerification(
  steps:
    | ReadonlyArray<{ name: VerificationStepName; status: VerificationStepStatus }>
    | undefined,
): VerificationSummary {
  const summary: Record<VerificationStepName, VerificationStepStatus> = {
    ...DEFAULT_VERIFICATION,
  };
  if (steps) {
    for (const s of steps) {
      summary[s.name] = s.status;
    }
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const fixCommitToolDef: ToolDefinition<
  FixCommitParams,
  FixCommitOutput
> = {
  name: "fix.commit",
  schema: paramsSchema,
  async run(params, ctx): Promise<FixCommitOutput> {
    await dbConnect();

    const sprintObjectId = new Types.ObjectId(ctx.sprintId);

    // 1. Reload + gate-check.
    const fp = await FixProposal.findOne({
      sprintId: sprintObjectId,
      id: params.fixProposalId,
    });
    if (!fp) {
      throw new Error("Fix proposal not found");
    }
    if (fp.status !== "passed") {
      throw new Error(`fix is not in passed state: ${fp.status}`);
    }

    // 2. Fetch the linked findings — used for both the spec-emission
    //    predicate and the commit subject line. We query once and
    //    re-order to match `fp.findingIds` so the commit message
    //    preserves the agent's original ordering.
    const linkedDocs = await Finding.find(
      { sprintId: sprintObjectId, id: { $in: fp.findingIds } },
      { id: 1, category: 1, severity: 1, title: 1, description: 1, reproductionSteps: 1 },
    ).lean();
    const byId = new Map(linkedDocs.map((f) => [f.id, f]));
    const orderedLinked = fp.findingIds
      .map((fid) => byId.get(fid))
      .filter((f): f is (typeof linkedDocs)[number] => f !== undefined);

    // 3. Spec-emission gate. Large or critical-security fixes get a new
    //    `.kiro/specs/` directory instead of an auto-commit.
    const emitResult = await evaluateAndEmitSpec({
      sprintId: ctx.sprintId,
      fixProposal: {
        id: fp.id,
        title: fp.title,
        findingIds: fp.findingIds,
        fileChanges: fp.fileChanges.map((c) => ({
          path: c.path,
          operation: c.operation,
          addedLines: c.addedLines,
          removedLines: c.removedLines,
        })),
      },
      findings: orderedLinked.map((f) => ({
        id: f.id,
        category: f.category,
        severity: f.severity,
        title: f.title,
        description: f.description,
        reproductionSteps: f.reproductionSteps ?? [],
      })),
    });

    if (emitResult.promoted) {
      fp.status = "promoted_to_spec";
      if (emitResult.promotedSpecPath !== undefined) {
        fp.promotedSpecPath = emitResult.promotedSpecPath;
      }
      await fp.save();
      return {
        status: "promoted_to_spec",
        commitSha: null,
        branch: null,
        promotedSpecPath: emitResult.promotedSpecPath ?? null,
      };
    }

    // 4. Normal auto-commit path.
    const branch = `sprint/${ctx.sprintId}/fix-${fp.id}`;
    const git = await createSprintGit();
    await git.assertOnSprintBranch(branch);

    const findingTitles = orderedLinked.map((f) => f.title);
    const verification = summarizeVerification(
      fp.lastVerificationReport?.steps,
    );

    const commitSha = await git.commitFix({
      branch,
      fixProposalId: fp.id,
      sprintId: ctx.sprintId,
      findingIds: fp.findingIds,
      findingTitles,
      verification,
      changes: fp.fileChanges,
    });

    fp.status = "committed";
    fp.commitSha = commitSha;
    fp.branch = branch;
    await fp.save();

    return {
      status: "committed",
      commitSha,
      branch,
      promotedSpecPath: null,
    };
  },
};
