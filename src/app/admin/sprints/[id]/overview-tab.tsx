"use client";

/**
 * Overview tab — metadata, live elapsed time, active agents, and a
 * token-budget progress bar.
 *
 * Requirements: 9.3
 */

import { useEffect, useState } from "react";

import type { SprintStatusView } from "./page";

interface Props {
  sprintId: string;
  sprint: SprintStatusView;
}

function formatElapsed(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function OverviewTab({ sprint }: Props) {
  // Local tick so elapsed time advances between SWR poll intervals.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (sprint.status !== "running" && sprint.status !== "closing") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sprint.status]);

  const startedAtMs = sprint.startedAt ? Date.parse(sprint.startedAt) : null;
  const liveElapsedMs =
    startedAtMs !== null && (sprint.status === "running" || sprint.status === "closing")
      ? Math.max(0, now - startedAtMs)
      : sprint.elapsedMs;

  const tokenPct =
    sprint.tokenBudget > 0
      ? Math.min(100, (sprint.tokensUsed / sprint.tokenBudget) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="glass-card">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
          Metadata
        </h2>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between">
            <dt className="text-[var(--text-secondary)]">Duration</dt>
            <dd className="text-[var(--text-primary)]">
              {sprint.durationMinutes} min
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-secondary)]">Elapsed</dt>
            <dd className="text-[var(--text-primary)] font-mono">
              {formatElapsed(liveElapsedMs)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-secondary)]">Started</dt>
            <dd className="text-[var(--text-primary)]">
              {sprint.startedAt
                ? new Date(sprint.startedAt).toLocaleString()
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-secondary)]">Result</dt>
            <dd className="text-[var(--text-primary)]">
              {sprint.result ?? "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="glass-card">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
          Token Budget
        </h2>
        <div className="text-sm text-[var(--text-primary)] mb-2">
          {sprint.tokensUsed.toLocaleString()} /{" "}
          {sprint.tokenBudget.toLocaleString()} tokens
        </div>
        <div className="w-full h-2 bg-[var(--background-secondary)] rounded-full overflow-hidden">
          <div
            className={`h-2 rounded-full ${tokenPct >= 95 ? "bg-red-500" : tokenPct >= 75 ? "bg-amber-500" : "bg-navy-500"}`}
            style={{ width: `${tokenPct}%` }}
          />
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-1">
          {tokenPct.toFixed(1)}% used
        </div>
      </div>

      <div className="glass-card md:col-span-2">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
          Goals
        </h2>
        {sprint.goals.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No goals recorded.</p>
        ) : (
          <ol className="list-decimal list-inside text-sm text-[var(--text-primary)] space-y-1">
            {sprint.goals.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ol>
        )}
      </div>

      <div className="glass-card">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
          Active agents
        </h2>
        {sprint.activeAgents.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No agents yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {sprint.activeAgents.map((a) => (
              <li
                key={a}
                className="px-2 py-0.5 rounded-full text-xs bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
              >
                {a}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-card">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
          Findings summary
        </h2>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between">
            <dt className="text-[var(--text-secondary)]">Total</dt>
            <dd className="text-[var(--text-primary)] font-medium">
              {sprint.findingCounts.total}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-secondary)]">Critical</dt>
            <dd className="text-red-600 font-medium">
              {sprint.findingCounts.bySeverity.critical}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-secondary)]">High</dt>
            <dd className="text-amber-600 font-medium">
              {sprint.findingCounts.bySeverity.high}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-secondary)]">Medium</dt>
            <dd className="text-[var(--text-primary)]">
              {sprint.findingCounts.bySeverity.medium}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-secondary)]">Low</dt>
            <dd className="text-[var(--text-primary)]">
              {sprint.findingCounts.bySeverity.low}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
