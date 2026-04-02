"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface AuditEntry {
  _id: string;
  adminName: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

const ACTION_TYPES = [
  "suspend_user",
  "reactivate_user",
  "verify_id",
  "approve_listing",
  "feature_listing",
  "delete_listing",
  "resolve_report",
  "approve_scam",
  "reject_scam",
];

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (actionFilter) params.set("action", actionFilter);
      const res = await fetch(`/api/admin/audit-log?${params}`);
      const data = await res.json();
      setEntries(data.entries || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Audit Log</h1>
          <Link href="/admin" className="text-sm text-navy-500 hover:underline">← Back to Dashboard</Link>
        </div>

        <div className="glass-card mb-6">
          <div className="flex items-center gap-4">
            <label htmlFor="action-filter" className="text-sm font-medium text-[var(--text-primary)]">Filter by action:</label>
            <select
              id="action-filter"
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
            >
              <option value="">All Actions</option>
              {ACTION_TYPES.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="glass-card overflow-x-auto">
          {loading ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">No audit log entries found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-2 text-[var(--text-secondary)] font-medium">Admin</th>
                  <th className="text-left py-3 px-2 text-[var(--text-secondary)] font-medium">Action</th>
                  <th className="text-left py-3 px-2 text-[var(--text-secondary)] font-medium">Target</th>
                  <th className="text-left py-3 px-2 text-[var(--text-secondary)] font-medium">Details</th>
                  <th className="text-left py-3 px-2 text-[var(--text-secondary)] font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry._id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 px-2 text-[var(--text-primary)]">{entry.adminName}</td>
                    <td className="py-3 px-2">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-navy-100 text-navy-700 dark:bg-navy-800 dark:text-navy-200">
                        {entry.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-[var(--text-secondary)]">
                      {entry.targetType}: {entry.targetId.slice(0, 8)}…
                    </td>
                    <td className="py-3 px-2 text-[var(--text-muted)] max-w-xs truncate">{entry.details}</td>
                    <td className="py-3 px-2 text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 min-h-[44px] rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-sm disabled:opacity-30 btn-press"
            >
              Previous
            </button>
            <span className="px-3 py-1 min-h-[44px] flex items-center text-sm text-[var(--text-primary)]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 min-h-[44px] rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-sm disabled:opacity-30 btn-press"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
