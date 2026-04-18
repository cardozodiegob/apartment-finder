"use client";

import { useEffect, useState } from "react";

interface ErrorEvent {
  _id: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  createdAt: string;
}

export default function AdminErrorsPage() {
  const [events, setEvents] = useState<ErrorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/admin/errors")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEvents(d?.events ?? []))
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Recent errors</h1>
        {loading && <p className="text-[var(--text-muted)]">Loading…</p>}
        {err && <p className="text-red-500">{err}</p>}
        {!loading && events.length === 0 && <p className="text-[var(--text-muted)]">Nothing yet.</p>}
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e._id} className="glass-card">
              <div className="flex items-baseline justify-between">
                <p className="font-semibold text-[var(--text-primary)] truncate pr-2">{e.message}</p>
                <span className="text-xs text-[var(--text-muted)] shrink-0">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </div>
              {e.stack && (
                <pre className="mt-2 text-xs text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap">
                  {e.stack}
                </pre>
              )}
              {e.context && Object.keys(e.context).length > 0 && (
                <pre className="mt-2 text-xs text-[var(--text-muted)] overflow-x-auto">
                  {JSON.stringify(e.context, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
