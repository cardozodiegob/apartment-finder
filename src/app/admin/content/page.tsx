"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/lib/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";

interface ContentEntry {
  _id?: string;
  key: string;
  title: string;
  body: string;
  contentType: "page" | "image";
  updatedAt?: string;
}

const DEFAULT_KEYS: ContentEntry[] = [
  { key: "privacy_policy", title: "Privacy Policy", body: "", contentType: "page" },
  { key: "terms_of_service", title: "Terms of Service", body: "", contentType: "page" },
  { key: "contact", title: "Contact", body: "", contentType: "page" },
  { key: "hero_image", title: "Hero Image", body: "", contentType: "image" },
  { key: "listing_placeholder", title: "Listing Placeholder", body: "", contentType: "image" },
];

export default function AdminContentPage() {
  const [entries, setEntries] = useState<ContentEntry[]>(DEFAULT_KEYS);
  const [editing, setEditing] = useState<ContentEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toasts, toast, dismissToast } = useToast();

  useEffect(() => {
    Promise.all(
      DEFAULT_KEYS.map((dk) =>
        fetch(`/api/content/${dk.key}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => (data?.content ? { ...dk, ...data.content } : dk))
          .catch(() => dk)
      )
    )
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content/${editing.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editing.title,
          body: editing.body,
          contentType: editing.contentType,
        }),
      });
      if (res.ok) {
        toast("Content saved", "success");
        setEntries((prev) =>
          prev.map((e) => (e.key === editing.key ? { ...editing } : e))
        );
        setEditing(null);
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.message || "Failed to save", "error");
      }
    } catch {
      toast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Content Management</h1>

        {editing ? (
          <div className="glass-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Edit: {editing.title}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] btn-press"
              >
                ← Back
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Title</label>
                <input
                  type="text"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {editing.contentType === "image" ? "Image URL" : "Body (HTML)"}
                </label>
                {editing.contentType === "image" ? (
                  <input
                    type="url"
                    value={editing.body}
                    onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
                  />
                ) : (
                  <textarea
                    value={editing.body}
                    onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                    rows={12}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-mono"
                  />
                )}
              </div>
              {editing.contentType === "image" && editing.body && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Preview</label>
                  <img src={editing.body} alt="Preview" className="max-h-40 rounded-lg border border-[var(--border)]" />
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm hover:bg-navy-600 disabled:opacity-50 btn-press"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-card">
            {loading ? (
              <div className="py-12 text-center text-[var(--text-muted)]">Loading content…</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Key</th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Title</th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Type</th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Status</th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.key} className="border-b border-[var(--border)]">
                      <td className="py-2 px-3 text-[var(--text-primary)] font-mono text-xs">{entry.key}</td>
                      <td className="py-2 px-3 text-[var(--text-primary)]">{entry.title}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          entry.contentType === "page"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                        }`}>
                          {entry.contentType}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          entry.body
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                        }`}>
                          {entry.body ? "Set" : "Empty"}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => setEditing({ ...entry })}
                          className="text-xs text-navy-500 hover:underline btn-press"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
