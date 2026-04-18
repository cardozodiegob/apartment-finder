"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Article {
  _id: string;
  title: string;
  slug: string;
  body: string;
  category: string;
  featuredImageUrl?: string;
  publishedAt: string;
  authorId: string;
}

const CATEGORIES: Record<string, string> = {
  moving_guides: "Moving Guides",
  city_guides: "City Guides",
  rental_tips: "Rental Tips",
  expat_life: "Expat Life",
};

const PLACEHOLDER_IMG = "https://placehold.co/800x400/e2e8f0/64748b?text=Blog";

export default function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<Article[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/blog/${slug}`);
        if (!res.ok) { setError("Article not found"); return; }
        const data = await res.json();
        setArticle(data.article);
        setRelated(data.related || []);
      } catch { setError("Failed to load article"); }
    }
    if (slug) load();
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="glass-card text-center">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Article Not Found</h1>
          <p className="text-[var(--text-muted)]">{error}</p>
          <Link href="/blog" className="mt-4 inline-block text-navy-500 hover:underline">Back to Blog</Link>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            <Link href="/blog" className="text-sm text-navy-500 hover:underline mb-4 inline-block">← Back to Blog</Link>
            <img
              src={article.featuredImageUrl || PLACEHOLDER_IMG}
              alt={article.title}
              className="w-full h-64 object-cover rounded-2xl mb-6"
            />
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs px-2.5 py-1 rounded-full bg-navy-100 text-navy-700 dark:bg-navy-800 dark:text-navy-200">
                {CATEGORIES[article.category] || article.category}
              </span>
              <span className="text-sm text-[var(--text-muted)]">{new Date(article.publishedAt).toLocaleDateString()}</span>
            </div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-6">{article.title}</h1>
            <div className="prose dark:prose-invert max-w-none text-[var(--text-primary)]" dangerouslySetInnerHTML={{ __html: article.body }} />
          </div>

          {/* Sidebar: Related articles */}
          <aside className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Related Articles</h3>
            {related.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No related articles yet.</p>
            ) : (
              related.map((r) => (
                <Link key={r._id} href={`/blog/${r.slug}`} className="glass-card card-hover block">
                  <h4 className="font-medium text-[var(--text-primary)] text-sm mb-1">{r.title}</h4>
                  <p className="text-xs text-[var(--text-muted)]">{new Date(r.publishedAt).toLocaleDateString()}</p>
                </Link>
              ))
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
