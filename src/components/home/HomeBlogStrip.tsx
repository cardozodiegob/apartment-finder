import Link from "next/link";

interface BlogEntry {
  _id?: unknown;
  slug: string;
  title: string;
  excerpt?: string;
  coverImage?: string;
  featuredImageUrl?: string;
  publishedAt?: Date | string;
}

export default function HomeBlogStrip({ articles }: { articles: BlogEntry[] }) {
  if (!articles || articles.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {articles.map((a) => {
        const img = a.featuredImageUrl ?? a.coverImage ?? "";
        return (
          <Link
            key={a.slug}
            href={`/blog/${a.slug}`}
            className="glass-card card-hover p-0 overflow-hidden block"
          >
            {img ? (
              <img src={img} alt={a.title} className="w-full h-36 object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-36 bg-[var(--background-secondary)]" />
            )}
            <div className="p-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 line-clamp-2">{a.title}</h3>
              {a.excerpt && (
                <p className="text-xs text-[var(--text-muted)] line-clamp-2">{a.excerpt}</p>
              )}
              {a.publishedAt && (
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {new Date(a.publishedAt as string | Date).toLocaleDateString()}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
