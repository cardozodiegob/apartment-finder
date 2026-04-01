import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <img
          src="https://placehold.co/300x200/dce4ff/3b5bdb?text=404"
          alt="Page not found illustration"
          className="mx-auto mb-6 rounded-xl"
        />
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
          Page Not Found
        </h1>
        <p className="text-[var(--text-secondary)] mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/"
            className="px-6 py-3 min-h-[44px] inline-flex items-center bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/search"
            className="px-6 py-3 min-h-[44px] inline-flex items-center border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:bg-[var(--background-secondary)] transition-colors"
          >
            Search Listings
          </Link>
        </div>
      </div>
    </div>
  );
}
