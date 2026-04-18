"use client";

/**
 * Fix Proposals tab (v1 placeholder).
 *
 * The POST /api/admin/sprints/[id]/action endpoint already implements
 * `merge_to_main` and `revert_commit` against a FixProposal id, but
 * there's no GET endpoint yet that lists FixProposal records for the
 * sprint. Until `/api/admin/sprints/[id]/fix-proposals` ships, this
 * tab renders the aggregate counts (already in SprintStatusView) plus
 * a pointer to the Workspace and Action Log tabs where per-proposal
 * activity is visible today.
 *
 * Requirements: 9.3, 9.5, 9.6, 9.7
 */

import Link from "next/link";

import type { SprintStatusView } from "./page";

interface Props {
  sprintId: string;
  sprint: SprintStatusView;
}

export default function FixProposalsTab({ sprintId }: Props) {
  return (
    <div className="glass-card space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        Fix Proposals
      </h2>
      <div className="rounded-lg border border-amber-400/30 bg-amber-50 dark:bg-amber-900/10 p-4 text-sm text-[var(--text-primary)]">
        <p className="font-medium mb-1">v1 limitation</p>
        <p className="text-[var(--text-secondary)]">
          The fix-proposal list UI is not wired yet. Per-proposal
          <span className="font-mono"> merge_to_main</span> and
          <span className="font-mono"> revert_commit</span> actions are
          available via the{" "}
          <span className="font-mono">
            POST /api/admin/sprints/{sprintId}/action
          </span>{" "}
          endpoint, which takes a{" "}
          <span className="font-mono">fixProposalId</span> of the form{" "}
          <span className="font-mono">P-&lt;sprint-short&gt;-&lt;seq&gt;</span>.
        </p>
        <p className="text-[var(--text-secondary)] mt-2">
          A dedicated{" "}
          <span className="font-mono">
            /api/admin/sprints/{sprintId}/fix-proposals
          </span>{" "}
          endpoint will return the full list with per-proposal
          merge/revert controls. Until then, see:
        </p>
        <ul className="list-disc list-inside text-[var(--text-secondary)] mt-2 space-y-1">
          <li>
            <span className="font-mono">plan.md</span> — lists tickets and
            proposal ids (Workspace tab).
          </li>
          <li>
            <span className="font-mono">log.md</span> — records{" "}
            <span className="font-mono">fix.propose</span>,{" "}
            <span className="font-mono">fix.verify</span>, and{" "}
            <span className="font-mono">fix.commit</span> activity (Workspace
            tab).
          </li>
          <li>
            The Action Log tab contains every tool call with its outcome.
          </li>
        </ul>
      </div>
    </div>
  );
}
