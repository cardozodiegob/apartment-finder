"use client";

/**
 * Retrospective tab — renders `retrospective.md` via `react-markdown`.
 *
 * Requirements: 9.3
 */

import ReactMarkdown from "react-markdown";
import useSWR from "swr";

import { fetcher } from "../_fetcher";
import type { SprintStatusView } from "./page";

interface Props {
  sprintId: string;
  sprint: SprintStatusView;
}

interface DocResponse {
  doc: "retrospective";
  content: string;
}

export default function RetrospectiveTab({ sprintId, sprint }: Props) {
  const shouldPoll =
    sprint.status === "running" || sprint.status === "closing";
  const { data, error, isLoading } = useSWR<DocResponse>(
    `/api/admin/sprints/${sprintId}/artifacts?doc=retrospective`,
    fetcher,
    { refreshInterval: shouldPoll ? 5000 : 0 },
  );

  return (
    <div className="glass-card">
      {isLoading ? (
        <div className="py-8 text-center text-[var(--text-muted)] text-sm">
          Loading retrospective.md…
        </div>
      ) : error ? (
        <div className="py-8 text-center text-red-500 text-sm">
          Failed to load retrospective.md
        </div>
      ) : !data || data.content.length === 0 ? (
        <div className="py-8 text-center text-[var(--text-muted)] text-sm">
          Retrospective not written yet — it&apos;s produced when the sprint
          transitions to <span className="font-mono">closing</span>.
        </div>
      ) : (
        <article className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-primary)]">
          <ReactMarkdown>{data.content}</ReactMarkdown>
        </article>
      )}
    </div>
  );
}
