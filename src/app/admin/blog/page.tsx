"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/lib/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";

interface Article {
  _id: string;
  title: string;
  slug: string;
  body: string;
  category: string;
  featuredImageUrl?: string;
  isPublished: boolean;
  publishedAt?: string;
}

const CATEGORIES = [
  { value: "moving_guides", label: "Moving Guides" },
  { value: "city_guides", label: "City Guides" },
  { value: "rental_tips", label: "Rental Tips" },
  { value: "expat_life", label: "Expat Life" },
];

const emptyArticle = {
  title: "", slug: "", body: "", category: "rental_tips",
  featuredImageUrl: "", isPublished: false,
};

export default function AdminBlogPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [editing, setEditing] = useState<(Partial<Article> & typeof emptyArticle) | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toasts, toast, dismissToast } = useToast();

  const fetchArticles = async () => {
    try {
      const res = await fetch("/api/blog?limit=100");
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchArticles(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const isNew = !editing._id;
      const url = isNew ? "/api/blog" : `/api/blog/${editing.slug}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (res.ok) {
        toast(isNew ? "Article created" : "Article updated", "success");
        setEditing(null);
        fetchArticles();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.message || "Failed to save", "error");
      }
    } catch { toast("Failed to save", "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Blog Management</h1>
          {!editing && (
            <button onClick={() => setEditing({ ...emptyArticle })} className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 btn-press">
              New Article
            </button>
          )}
        </div>

        {editing ? (
          <div className="glass-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{editing._id ? "Edit Article" : "New Article"}</h2>
              <button onClick={() => setEditing(null)} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] btn-press">← Back</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Title</label>
                <input type="text" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Slug</label>
                <input type="text" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="my-article-slug"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Category</label>
                  <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm">
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Featured Image URL</label>
                  <input type="url" value={editing.featuredImageUrl || ""} onChange={(e) => setEditing({ ...editing, featuredImageUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Body (HTML)</label>
                <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={12}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-mono" />
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] min-h-[44px]">
                <input type="checkbox" checked={editing.isPublished} onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })} className="rounded w-5 h-5" />
                Published
              </label>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm hover:bg-navy-600 disabled:opacity-50 btn-press">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-card">
            {loading ? (
              <div className="py-12 text-center text-[var(--text-muted)]">Loading articles…</div>
            ) : articles.length === 0 ? (
              <div className="py-12 text-center text-[var(--text-muted)]">No blog articles yet. Create one to get started.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Title</th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Category</th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Status</th>
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((a) => (
                    <tr key={a._id} className="border-b border-[var(--border)]">
                      <td className="py-2 px-3 text-[var(--text-primary)]">{a.title}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {CATEGORIES.find((c) => c.value === a.category)?.label || a.category}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${a.isPublished ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"}`}>
                          {a.isPublished ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <button onClick={() => setEditing({ ...a, featuredImageUrl: a.featuredImageUrl || "" })} className="text-xs text-navy-500 hover:underline btn-press">Edit</button>
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
