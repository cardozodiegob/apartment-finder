"use client";

import { useEffect, useState } from "react";

export default function TermsPage() {
  const [title, setTitle] = useState("Terms of Service");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/content/terms_of_service")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.content) {
          setTitle(data.content.title);
          setBody(data.content.body);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="glass-card">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{title}</h1>
          {loading ? (
            <p className="text-[var(--text-muted)]">Loading…</p>
          ) : body ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-secondary)]"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          ) : (
            <p className="text-[var(--text-muted)] text-center py-8">Coming soon</p>
          )}
        </div>
      </div>
    </div>
  );
}
