"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <img
          src="https://placehold.co/300x200/fecaca/991b1b?text=Error"
          alt="Something went wrong illustration"
          className="mx-auto mb-6 rounded-xl"
        />
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
          Something Went Wrong
        </h1>
        <p className="text-[var(--text-secondary)] mb-6">
          An unexpected error occurred. Please try again or return to the homepage.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={reset}
            className="px-6 py-3 min-h-[44px] inline-flex items-center bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-6 py-3 min-h-[44px] inline-flex items-center border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:bg-[var(--background-secondary)] transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
