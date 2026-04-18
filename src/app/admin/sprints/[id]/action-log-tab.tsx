"use client";

/**
 * Action Log tab — download the full `sprintActionLog` as JSON.
 *
 * The artifacts endpoint streams every action log entry for the sprint
 * as a JSON attachment when called with `?download=actionLog`. We also
 * surface the tail of `log.md` (already in `sprint.recentLogEntries`)
 * so the admin can skim recent activity without opening the file.
 *
 * Requirements: 13.5
 */

import type { SprintStatusView } from "./page";

interface Props {
  sprintId: string;
  sprint: SprintStatusView;
}

export default function ActionLogTab({ sprintId, sprint }: Props) {
  const downloadHref = `/api/admin/sprints/${sprintId}/artifacts?download=actionLog`;

  return (
    <div className="space-y-4">
      <div className="glass-card">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
          Action Log
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          The downloadable JSON contains every agent tool call with its
          outcome and a SHA-256 digest of the parameters (full parameters
          and responses are included only when{" "}
          <span className="font-mono">SPRINT_VERBOSE_LOGS=true</span>).
        </p>
        <a
          href={downloadHref}
          className="inline-block px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600"
        >
          Download JSON
        </a>
      </div>

      <div className="glass-card">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
          Recent log entries
        </h3>
        {sprint.recentLogEntries.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No log entries yet.
          </p>
        ) : (
          <pre className="text-xs font-mono text-[var(--text-primary)] bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
            {sprint.recentLogEntries.join("\n")}
          </pre>
        )}
      </div>
    </div>
  );
}
