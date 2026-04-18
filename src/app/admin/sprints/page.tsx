"use client";

/**
 * Admin: sprints list page.
 *
 * Shows paginated sprints with status, duration, selected roles,
 * finding counts by severity, and fix-proposal counts by status.
 *
 * Requirements: 9.1
 */

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import type {
  FindingSeverity,
  FixStatus,
  SprintStatus,
} from "@/lib/sprint/types";

import { fetcher } from "./_fetcher";

interface SprintListItem {
  sprintId: string;
  status: SprintStatus;
  durationMinutes: number;
  roles: string[];
  createdAt: string;
  findingCounts: {
    total: number;
    bySeverity: Record<FindingSeverity, number>;
  };
  fixCounts: {
    total: number;
    byStatus: Record<FixStatus, number>;
  };
}

interface SprintListResponse {
  items: SprintListItem[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

const STATUS_CLASSES: Record<SprintStatus, string> = {
  pending:
    "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  closing:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  completed:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  aborted: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

function formatRoles(roles: string[]): string {
  if (roles.length <= 3) return roles.join(", ");
  return `${roles.slice(0, 3).join(", ")} +${roles.length - 3} more`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function SprintListPage() {
  const [page, setPage] = useState(1);
  const { data, error, isLoading } = useSWR<SprintListResponse>(
    `/api/admin/sprints?page=${page}&pageSize=${PAGE_SIZE}`,
    fetcher,
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Sprints
          </h1>
          <Link
            href="/admin/sprints/new"
            className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600"
          >
            New Sprint
          </Link>
        </div>

        <div className="glass-card">
          {isLoading ? (
            <div className="py-12 text-center text-[var(--text-muted)]">
              Loading sprints…
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-500">
              Failed to load sprints.
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)]">
              No sprints yet. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">
                      Status
                    </th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">
                      Created
                    </th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">
                      Duration
                    </th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">
                      Roles
                    </th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">
                      Findings
                    </th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">
                      Fix Proposals
                    </th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((s) => (
                    <tr key={s.sprintId} className="border-b border-[var(--border)]">
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${STATUS_CLASSES[s.status]}`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[var(--text-primary)]">
                        {formatDate(s.createdAt)}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-primary)]">
                        {s.durationMinutes}m
                      </td>
                      <td className="py-2 px-3 text-[var(--text-primary)]">
                        {formatRoles(s.roles)}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-primary)]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {s.findingCounts.total}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            C:{s.findingCounts.bySeverity.critical} H:
                            {s.findingCounts.bySeverity.high} M:
                            {s.findingCounts.bySeverity.medium} L:
                            {s.findingCounts.bySeverity.low}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-[var(--text-primary)]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {s.fixCounts.total}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            committed:{s.fixCounts.byStatus.committed ?? 0}{" "}
                            passed:{s.fixCounts.byStatus.passed ?? 0}{" "}
                            draft:{s.fixCounts.byStatus.draft ?? 0}{" "}
                            rejected:{s.fixCounts.byStatus.rejected ?? 0}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <Link
                          href={`/admin/sprints/${s.sprintId}`}
                          className="text-xs text-navy-500 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]">
              <span className="text-xs text-[var(--text-muted)]">
                Page {data.page} of {totalPages} · {data.total} total
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-xs rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => (p < totalPages ? p + 1 : p))
                  }
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-xs rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
