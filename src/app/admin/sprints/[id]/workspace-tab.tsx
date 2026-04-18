"use client";

/**
 * Workspace tab — renders the four shared markdown docs
 * (`plan`, `log`, `findings`, `retrospective`) via `react-markdown`,
 * each behind a sub-tab selector. Empty docs render an empty state.
 *
 * Requirements: 9.3
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import useSWR from "swr";

import { fetcher } from "../_fetcher";
import type { SprintStatusView } from "./page";

interface Props {
  sprintId: string;
  sprint: SprintStatusView;
}

const DOCS = [
  { id: "plan", label: "plan.md" },
  { id: "log", label: "log.md" },
  { id: "findings", label: "findings.md" },
  { id: "retrospective", label: "retrospective.md" },
] as const;

type DocId = (typeof DOCS)[number]["id"];

interface DocResponse {
  doc: DocId;
  content: string;
}

export default function WorkspaceTab({ sprintId, sprint }: Props) {
  const [active, setActive] = useState<DocId>("plan");
  const shouldPoll =
    sprint.status === "running" || sprint.status === "closing";

  const { data, error, isLoading } = useSWR<DocResponse>(
    `/api/admin/sprints/${sprintId}/artifacts?doc=${active}`,
    fetcher,
    { refreshInterval: shouldPoll ? 5000 : 0 },
  );

  return (
    <div className="glass-card">
      <div className="flex gap-1 mb-4 flex-wrap border-b border-[var(--border)]">
        {DOCS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setActive(d.id)}
            className={`px-3 py-2 text-xs font-mono border-b-2 transition-colors ${
              active === d.id
                ? "border-navy-500 text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-[var(--text-muted)] text-sm">
          Loading {active}.md…
        </div>
      ) : error ? (
        <div className="py-8 text-center text-red-500 text-sm">
          Failed to load {active}.md
        </div>
      ) : !data || data.content.length === 0 ? (
        <div className="py-8 text-center text-[var(--text-muted)] text-sm">
          {active}.md is empty.
        </div>
      ) : (
        <article className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-primary)]">
          <ReactMarkdown>{data.content}</ReactMarkdown>
        </article>
      )}
    </div>
  );
}
