"use client";

/**
 * Admin: new sprint form.
 *
 * Role multiselect (`tech_lead` is required and pre-checked), persona
 * multiselect, duration input (5..240), goals textarea (one per line),
 * and the user's currently-checked-out branch name. Submits to
 * `POST /api/admin/sprints` and redirects to the detail page on 201.
 *
 * Requirements: 9.2
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ToastContainer } from "@/components/ui/Toast";
import { useToast } from "@/lib/hooks/useToast";
import {
  AGENT_ROLES,
  CUSTOMER_PERSONAS,
  type AgentRole,
  type CustomerPersona,
} from "@/lib/sprint/types";

const DEFAULT_DURATION = 60;

export default function NewSprintPage() {
  const router = useRouter();
  const { toasts, toast, dismissToast } = useToast();

  const [roles, setRoles] = useState<Set<AgentRole>>(new Set(["tech_lead"]));
  const [personas, setPersonas] = useState<Set<CustomerPersona>>(new Set());
  const [durationMinutes, setDurationMinutes] = useState<number>(
    DEFAULT_DURATION,
  );
  const [goalsText, setGoalsText] = useState("");
  const [branch, setBranch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleRole(role: AgentRole) {
    if (role === "tech_lead") return; // always required
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  function togglePersona(p: CustomerPersona) {
    setPersonas((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const goals = goalsText
      .split("\n")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);

    if (goals.length === 0) {
      setErrorMessage("Add at least one goal (one per line).");
      return;
    }
    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 5 ||
      durationMinutes > 240
    ) {
      setErrorMessage("Duration must be an integer between 5 and 240 minutes.");
      return;
    }
    if (branch.trim().length === 0) {
      setErrorMessage("Enter the branch you're currently on.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roles: Array.from(roles),
          personas: Array.from(personas),
          durationMinutes,
          goals,
          currentBranchAtStart: branch.trim(),
        }),
      });

      if (res.status === 201) {
        const data = (await res.json()) as { sprintId: string };
        toast("Sprint created", "success");
        router.push(`/admin/sprints/${data.sprintId}`);
        return;
      }

      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        code?: string;
      };
      const msg = body.message ?? `Failed to create sprint (${res.status})`;
      setErrorMessage(msg);
      toast(msg, "error");
    } catch {
      const msg = "Network error while creating sprint";
      setErrorMessage(msg);
      toast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            New Sprint
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="glass-card space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Agent roles
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AGENT_ROLES.map((role) => {
                const required = role === "tech_lead";
                const checked = roles.has(role);
                return (
                  <label
                    key={role}
                    className={`flex items-center gap-2 text-sm text-[var(--text-primary)] px-2 py-1 rounded ${required ? "opacity-70" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={required}
                      onChange={() => toggleRole(role)}
                      className="rounded w-4 h-4"
                    />
                    <span>
                      {role}
                      {required ? " (required)" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Customer personas
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CUSTOMER_PERSONAS.map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-2 text-sm text-[var(--text-primary)] px-2 py-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={personas.has(p)}
                    onChange={() => togglePersona(p)}
                    className="rounded w-4 h-4"
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="duration"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                Duration (minutes)
              </label>
              <input
                id="duration"
                type="number"
                min={5}
                max={240}
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(Number.parseInt(e.target.value, 10) || 0)
                }
                className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Between 5 and 240 minutes.
              </p>
            </div>
            <div>
              <label
                htmlFor="branch"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                Current branch
              </label>
              <input
                id="branch"
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="e.g. feature/my-work"
                className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                The branch you&apos;re currently on — sprint commits will stay
                off this branch.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="goals"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Goals
            </label>
            <textarea
              id="goals"
              rows={6}
              value={goalsText}
              onChange={(e) => setGoalsText(e.target.value)}
              placeholder="One goal per line…"
              className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-mono"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Empty lines are ignored.
            </p>
          </div>

          {errorMessage && (
            <p className="text-sm text-red-500" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create sprint"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/sprints")}
              className="px-4 py-2 bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
