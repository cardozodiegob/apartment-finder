"use client";

/**
 * Findings tab (v1).
 *
 * The API doesn't expose a dedicated `/findings` endpoint yet, so the
 * v1 view reads `findings.md` directly via the artifacts endpoint and
 * renders it with `react-markdown`. The counts summary at the top is
 * driven by the `SprintStatusView` already loaded by the parent shell.
 *
 * NOTE (v1 limitation): severity filtering and a structured list with
 * per-finding chips require a dedicated `/api/admin/sprints/[id]/findings`
 * endpoint that returns Finding records. Until that's wired, this tab
 * shows the full `findings.md` plus the aggregate counts.
 *
 * Requirements: 9.3
 */

import ReactMarkdown from "react-markdown";
import useSWR from "swr";

import type { FindingSeverity } from "@/lib/sprint/types";

import { fetcher } from "../_fetcher";
import type { SprintStatusView } from "./page";

interface Props {
  sprintId: string;
  sprint: SprintStatusView;
}

interface DocResponse {
  doc: "findings";
  content: string;
}

const SEVERITY_ORDER: FindingSeverity[] = ["critical", "high", "medium", "low"];

const SEVERITY_CLASSES: Record<FindingSeverity, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
};

export default function FindingsTab({ sprintId, sprint }: Props) {
  const shouldPoll =
    sprint.status === "running" || sprint.status === "closing";
  const { data, error, isLoading } = useSWR<DocResponse>(
    `/api/admin/sprints/${sprintId}/artifacts?doc=findings`,
    fetcher,
    { refreshInterval: shouldPoll ? 5000 : 0 },
  );

  return (
    <div className="space-y-4">
      <div className="glass-card">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
          Findings ({sprint.findingCounts.total})
        </h2>
        <div className="flex flex-wrap gap-2">
          {SEVERITY_ORDER.map((sev) => (
            <span
              key={sev}
              className={`px-2 py-0.5 rounded-full text-xs ${SEVERITY_CLASSES[sev]}`}
            >
              {sev}: {sprint.findingCounts.bySeverity[sev]}
            </span>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          v1: showing the full findings.md document below. A dedicated
          filterable list with per-finding drawers is planned once the
          findings API is exposed.
        </p>
      </div>

      <div className="glass-card">
        {isLoading ? (
          <div className="py-8 text-center text-[var(--text-muted)] text-sm">
            Loading findings.md…
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-500 text-sm">
            Failed to load findings.md
          </div>
        ) : !data || data.content.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-muted)] text-sm">
            No findings yet.
          </div>
        ) : (
          <article className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-primary)]">
            <ReactMarkdown>{data.content}</ReactMarkdown>
          </article>
        )}
      </div>
    </div>
  );
}
