"use client";

/**
 * Admin: sprint detail shell.
 *
 * Loads the `SprintStatusView` with SWR and polls every 5 s while the
 * sprint is `running` or `closing`; falls back to a static fetch on
 * terminal (`completed` / `aborted`) and `pending` states. Renders a
 * header with status + start/abort controls, then a tab navigation
 * for the six tab components.
 *
 * Requirements: 9.3, 9.4
 */

import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

import { ToastContainer } from "@/components/ui/Toast";
import { useToast } from "@/lib/hooks/useToast";
import type {
  AgentRole,
  FindingSeverity,
  SprintResult,
  SprintStatus,
} from "@/lib/sprint/types";

import { fetcher } from "../_fetcher";
import ActionLogTab from "./action-log-tab";
import FindingsTab from "./findings-tab";
import FixProposalsTab from "./fix-proposals-tab";
import OverviewTab from "./overview-tab";
import RetrospectiveTab from "./retrospective-tab";
import WorkspaceTab from "./workspace-tab";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SprintStatusView {
  sprintId: string;
  status: SprintStatus;
  result?: SprintResult;
  durationMinutes: number;
  startedAt?: string;
  goals: string[];
  activeAgents: AgentRole[];
  findingCounts: {
    total: number;
    bySeverity: Record<FindingSeverity, number>;
  };
  elapsedMs: number;
  tokensUsed: number;
  tokenBudget: number;
  hasCriticalFinding: boolean;
  recentLogEntries: string[];
}

type TabId =
  | "overview"
  | "workspace"
  | "findings"
  | "fix-proposals"
  | "retrospective"
  | "action-log";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "workspace", label: "Workspace" },
  { id: "findings", label: "Findings" },
  { id: "fix-proposals", label: "Fix Proposals" },
  { id: "retrospective", label: "Retrospective" },
  { id: "action-log", label: "Action Log" },
];

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SprintDetailPage() {
  const params = useParams<{ id: string }>();
  const sprintId = params.id;
  const { toasts, toast, dismissToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [acting, setActing] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<SprintStatusView>(
    sprintId ? `/api/admin/sprints/${sprintId}` : null,
    fetcher,
    {
      refreshInterval: (latest) =>
        latest && (latest.status === "running" || latest.status === "closing")
          ? 5000
          : 0,
    },
  );

  async function handleAction(
    action: "start" | "abort",
    reason?: string,
  ): Promise<void> {
    if (!sprintId) return;
    setActing(true);
    try {
      const res = await fetch(`/api/admin/sprints/${sprintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "abort" ? { action, reason } : { action },
        ),
      });
      if (res.ok) {
        toast(action === "start" ? "Sprint started" : "Sprint aborted", "success");
        await mutate();
      } else {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toast(body.message ?? `Action failed (${res.status})`, "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setActing(false);
    }
  }

  function handleAbortClick(): void {
    const reason = window.prompt("Reason for aborting this sprint?") ?? "";
    if (reason.length === 0) return;
    void handleAction("abort", reason);
  }

  const canStart = data?.status === "pending";
  const canAbort =
    data?.status === "running" || data?.status === "closing";

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6">
          <a
            href="/admin/sprints"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            ← Back to sprints
          </a>
        </div>

        {isLoading ? (
          <div className="glass-card py-12 text-center text-[var(--text-muted)]">
            Loading sprint…
          </div>
        ) : error || !data ? (
          <div className="glass-card py-12 text-center text-red-500">
            Failed to load sprint.
          </div>
        ) : (
          <>
            <div className="glass-card mb-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1">
                    Sprint{" "}
                    <span className="font-mono text-sm text-[var(--text-secondary)]">
                      {data.sprintId}
                    </span>
                  </h1>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${STATUS_CLASSES[data.status]}`}
                    >
                      {data.status}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      Elapsed: {formatElapsed(data.elapsedMs)} /{" "}
                      {data.durationMinutes}m
                    </span>
                    {data.hasCriticalFinding && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        Critical finding
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {canStart && (
                    <button
                      type="button"
                      onClick={() => void handleAction("start")}
                      disabled={acting}
                      className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 disabled:opacity-50"
                    >
                      {acting ? "Starting…" : "Start Sprint"}
                    </button>
                  )}
                  {canAbort && (
                    <button
                      type="button"
                      onClick={handleAbortClick}
                      disabled={acting}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                    >
                      {acting ? "Aborting…" : "Abort Sprint"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="border-b border-[var(--border)] mb-4 flex gap-1 flex-wrap">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                    activeTab === t.id
                      ? "border-navy-500 text-[var(--text-primary)] font-medium"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div>
              {activeTab === "overview" && (
                <OverviewTab sprintId={sprintId} sprint={data} />
              )}
              {activeTab === "workspace" && (
                <WorkspaceTab sprintId={sprintId} sprint={data} />
              )}
              {activeTab === "findings" && (
                <FindingsTab sprintId={sprintId} sprint={data} />
              )}
              {activeTab === "fix-proposals" && (
                <FixProposalsTab sprintId={sprintId} sprint={data} />
              )}
              {activeTab === "retrospective" && (
                <RetrospectiveTab sprintId={sprintId} sprint={data} />
              )}
              {activeTab === "action-log" && (
                <ActionLogTab sprintId={sprintId} sprint={data} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
