"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Article {
  _id: string;
  title: string;
  slug: string;
  body: string;
  category: string;
  featuredImageUrl?: string;
  publishedAt: string;
}

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "moving_guides", label: "Moving Guides" },
  { value: "city_guides", label: "City Guides" },
  { value: "rental_tips", label: "Rental Tips" },
  { value: "expat_life", label: "Expat Life" },
];

const PLACEHOLDER_IMG = "https://placehold.co/600x300/e2e8f0/64748b?text=Blog";

export default function BlogPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "12" });
      if (category) params.set("category", category);
      const res = await fetch(`/api/blog?${params}`);
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, category]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const excerpt = (html: string) => {
    const text = html.replace(/<[^>]+>/g, "");
    return text.length > 150 ? text.slice(0, 150) + "…" : text;
  };

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-6">Blog</h1>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => { setCategory(c.value); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors btn-press ${
                category === c.value
                  ? "bg-navy-500 text-white"
                  : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--background-secondary)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-[var(--text-muted)]">Loading articles…</div>
        ) : articles.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)]">No articles found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((a) => (
              <Link key={a._id} href={`/blog/${a.slug}`} className="glass-card card-hover block">
                <img
                  src={a.featuredImageUrl || PLACEHOLDER_IMG}
                  alt={a.title}
                  className="w-full h-40 object-cover rounded-lg mb-3"
                  loading="lazy"
                />
                <span className="text-xs px-2 py-0.5 rounded-full bg-navy-100 text-navy-700 dark:bg-navy-800 dark:text-navy-200 mb-2 inline-block">
                  {CATEGORIES.find((c) => c.value === a.category)?.label || a.category}
                </span>
                <h2 className="font-semibold text-[var(--text-primary)] mb-1">{a.title}</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-2">{excerpt(a.body)}</p>
                <p className="text-xs text-[var(--text-muted)]">{new Date(a.publishedAt).toLocaleDateString()}</p>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`px-3 py-1 min-h-[44px] min-w-[44px] rounded-lg text-sm ${
                  page === i + 1 ? "bg-navy-500 text-white" : "border border-[var(--border)] text-[var(--text-secondary)]"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
