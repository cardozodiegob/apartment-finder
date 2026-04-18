"use client";

import Link from "next/link";
import { useCompare } from "@/lib/hooks/useCompare";

export default function CompareBar() {
  const { comparedIds, clearCompare } = useCompare();

  if (comparedIds.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#0c1754]/95 backdrop-blur-xl border-t border-[var(--glass-border)] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {comparedIds.length} listing{comparedIds.length !== 1 ? "s" : ""} selected
          </span>
          {comparedIds.length < 2 && (
            <span className="text-xs text-[var(--text-muted)]">Add at least 2 to compare</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearCompare}
            className="px-3 py-1.5 text-xs border border-[var(--border)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--background-secondary)] transition-colors btn-press"
          >
            Clear
          </button>
          {comparedIds.length >= 2 && (
            <Link
              href="/compare"
              className="px-4 py-1.5 bg-navy-500 text-white rounded-lg text-xs font-medium hover:bg-navy-600 transition-colors btn-press"
            >
              Compare Now
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
