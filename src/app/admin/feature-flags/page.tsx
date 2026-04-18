"use client";

import { useEffect, useState } from "react";

interface Flag {
  _id: string;
  name: string;
  enabled: boolean;
  percent: number;
  description?: string;
}

export default function FeatureFlagsAdminPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  async function load() {
    const res = await fetch("/api/admin/feature-flags");
    if (res.ok) {
      const data = await res.json();
      setFlags(data.flags);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(f: Partial<Flag> & { name: string }) {
    await fetch("/api/admin/feature-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    await load();
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Feature flags</h1>

        <div className="glass-card mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              save({ name: newName.trim(), enabled: false, percent: 100 });
              setNewName("");
            }}
            className="flex gap-2"
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="flag-name"
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
            />
            <button className="px-3 py-2 rounded-lg bg-navy-500 text-white text-sm font-medium">
              Create
            </button>
          </form>
        </div>

        {loading ? (
          <p className="text-[var(--text-muted)]">Loading…</p>
        ) : (
          <div className="space-y-3">
            {flags.map((f) => (
              <div key={f._id} className="glass-card flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--text-primary)]">{f.name}</p>
                  {f.description && <p className="text-xs text-[var(--text-muted)]">{f.description}</p>}
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    onChange={(e) => save({ name: f.name, enabled: e.target.checked, percent: f.percent })}
                    className="w-4 h-4"
                  />
                  Enabled
                </label>
                <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={f.percent}
                    onChange={(e) => save({ name: f.name, enabled: f.enabled, percent: Number(e.target.value) })}
                    className="w-16 px-2 py-1 rounded bg-[var(--surface)] border border-[var(--border)]"
                  />
                  <span>%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
