"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/lib/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";

interface Guide {
  _id: string;
  city: string;
  neighborhood: string;
  slug: string;
  overview: string;
  transitScore?: number;
  transitInfo?: string;
  safetyInfo?: string;
  amenities?: { supermarkets: string[]; pharmacies: string[]; schools: string[]; parks: string[] };
  averageRent?: number;
  centerLat: number;
  centerLng: number;
  isPublished: boolean;
}

const emptyGuide: Omit<Guide, "_id"> = {
  city: "", neighborhood: "", slug: "", overview: "",
  transitScore: undefined, transitInfo: "", safetyInfo: "",
  amenities: { supermarkets: [], pharmacies: [], schools: [], parks: [] },
  averageRent: undefined, centerLat: 0, centerLng: 0, isPublished: false,
};

export default function AdminNeighborhoodsPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [editing, setEditing] = useState<(Partial<Guide> & typeof emptyGuide) | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toasts, toast, dismissToast } = useToast();

  const fetchGuides = async () => {
    try {
      // Fetch all guides (including unpublished) via admin-accessible endpoint
      const res = await fetch("/api/neighborhoods");
      if (res.ok) {
        const data = await res.json();
        setGuides(data.guides || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGuides(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const isNew = !editing._id;
      const url = isNew ? "/api/neighborhoods" : `/api/neighborhoods/${editing._id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (res.ok) {
        toast(isNew ? "Guide created" : "Guide updated", "success");
        setEditing(null);
        fetchGuides();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.message || "Failed to save", "error");
      }
    } catch { toast("Failed to save", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this neighborhood guide?")) return;
    try {
      const res = await fetch(`/api/neighborhoods/${id}`, { method: "DELETE" });
      if (res.ok) { toast("Guide deleted", "success"); fetchGuides(); }
      else toast("Failed to delete", "error");
    } catch { toast("Failed to delete", "error"); }
  };

  const updateAmenity = (type: keyof NonNullable<Guide["amenities"]>, value: string) => {
    if (!editing) return;
    const amenities = editing.amenities || { supermarkets: [], pharmacies: [], schools: [], parks: [] };
    setEditing({ ...editing, amenities: { ...amenities, [type]: value.split(",").map((s) => s.trim()).filter(Boolean) } });
  };

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Neighborhood Guides</h1>
          {!editing && (
            <button onClick={() => setEditing({ ...emptyGuide })} className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 btn-press">
              New Guide
            </button>
          )}
        </div>

        {editing ? (
          <div className="glass-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{editing._id ? "Edit Guide" : "New Guide"}</h2>
              <button onClick={() => setEditing(null)} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] btn-press">← Back</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">City</label>
                  <input type="text" value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Neighborhood</label>
                  <input type="text" value={editing.neighborhood} onChange={(e) => setEditing({ ...editing, neighborhood: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Slug</label>
                <input type="text" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="e.g. berlin-kreuzberg"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Overview (HTML)</label>
                <textarea value={editing.overview} onChange={(e) => setEditing({ ...editing, overview: e.target.value })} rows={6}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-mono" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Transit Score (0-100)</label>
                  <input type="number" min={0} max={100} value={editing.transitScore ?? ""} onChange={(e) => setEditing({ ...editing, transitScore: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Average Rent (EUR)</label>
                  <input type="number" min={0} value={editing.averageRent ?? ""} onChange={(e) => setEditing({ ...editing, averageRent: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] min-h-[44px]">
                    <input type="checkbox" checked={editing.isPublished} onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })} className="rounded w-5 h-5" />
                    Published
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Transit Info (HTML)</label>
                <textarea value={editing.transitInfo || ""} onChange={(e) => setEditing({ ...editing, transitInfo: e.target.value })} rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Safety Info (HTML)</label>
                <textarea value={editing.safetyInfo || ""} onChange={(e) => setEditing({ ...editing, safetyInfo: e.target.value })} rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-mono" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Center Latitude</label>
                  <input type="number" step="any" value={editing.centerLat} onChange={(e) => setEditing({ ...editing, centerLat: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Center Longitude</label>
                  <input type="number" step="any" value={editing.centerLng} onChange={(e) => setEditing({ ...editing, centerLng: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--text-secondary)]">Amenities (comma-separated)</p>
                {(["supermarkets", "pharmacies", "schools", "parks"] as const).map((type) => (
                  <div key={type}>
                    <label className="block text-xs text-[var(--text-muted)] mb-1 capitalize">{type}</label>
                    <input type="text" value={editing.amenities?.[type]?.join(", ") || ""} onChange={(e) => updateAmenity(type, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
                  </div>
                ))}
              </div>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm hover:bg-navy-600 disabled:opacity-50 btn-press">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-card">
            {loading ? (
              <div className="py-12 text-center text-[var(--text-muted)]">Loading guides…</div>
            ) : guides.length === 0 ? (
              <div className="py-12 text-center text-[var(--text-muted)]">No neighborhood guides yet. Create one to get started.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">City</th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Neighborhood</th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Slug</th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Status</th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {guides.map((g) => (
                    <tr key={g._id} className="border-b border-[var(--border)]">
                      <td className="py-2 px-3 text-[var(--text-primary)]">{g.city}</td>
                      <td className="py-2 px-3 text-[var(--text-primary)]">{g.neighborhood}</td>
                      <td className="py-2 px-3 text-[var(--text-primary)] font-mono text-xs">{g.slug}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${g.isPublished ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"}`}>
                          {g.isPublished ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="py-2 px-3 flex gap-2">
                        <button onClick={() => setEditing({ ...g })} className="text-xs text-navy-500 hover:underline btn-press">Edit</button>
                        <button onClick={() => handleDelete(g._id)} className="text-xs text-red-500 hover:underline btn-press">Delete</button>
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
