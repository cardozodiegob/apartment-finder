"use client";

import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";

interface PosterCardData {
  id: string;
  fullName: string;
  firstName: string;
  photoUrl: string | null;
  trustScore: number;
  badges: Array<"idVerified" | "emailVerified" | "phoneVerified">;
  languages: string[];
  memberSince: string;
  completedTransactions: number;
  responseRate: number | null;
  responseTimeHours: number | null;
}

interface PosterCardProps {
  poster: PosterCardData;
  listingId: string;
}

const BADGE_LABELS: Record<PosterCardData["badges"][number], string> = {
  idVerified: "ID verified",
  emailVerified: "Email verified",
  phoneVerified: "Phone verified",
};

function formatResponseTime(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return "< 1h";
  if (hours < 24) return `~${Math.round(hours)}h`;
  return `~${Math.round(hours / 24)}d`;
}

function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export default function PosterCard({ poster, listingId }: PosterCardProps) {
  const memberYear = new Date(poster.memberSince).getFullYear();
  const trustPct = Math.max(0, Math.min(100, (poster.trustScore / 5) * 100));

  return (
    <div className="glass-card">
      <div className="flex items-start gap-3 mb-4">
        <UserAvatar name={poster.fullName} photoUrl={poster.photoUrl} size={56} />
        <div className="flex-1 min-w-0">
          <Link
            href={`/users/${poster.id}`}
            className="text-base font-semibold text-[var(--text-primary)] hover:underline truncate block"
          >
            {poster.fullName}
          </Link>
          <p className="text-xs text-[var(--text-muted)]">
            Member since {memberYear}
            {poster.completedTransactions > 0 && (
              <> · {poster.completedTransactions} transactions</>
            )}
          </p>
        </div>
      </div>

      {/* Trust bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-[var(--text-muted)]">Trust score</span>
          <span className="font-semibold text-[var(--text-primary)]">
            {poster.trustScore.toFixed(1)} / 5
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[var(--background-secondary)]">
          <div
            className="h-1.5 rounded-full bg-navy-500"
            style={{ width: `${trustPct}%` }}
          />
        </div>
      </div>

      {/* Response metrics */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="text-center p-2 rounded-lg bg-[var(--background-secondary)]">
          <p className="text-xs text-[var(--text-muted)]">Response rate</p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {formatRate(poster.responseRate)}
          </p>
        </div>
        <div className="text-center p-2 rounded-lg bg-[var(--background-secondary)]">
          <p className="text-xs text-[var(--text-muted)]">Response time</p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {formatResponseTime(poster.responseTimeHours)}
          </p>
        </div>
      </div>

      {/* Badges */}
      {poster.badges.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {poster.badges.map((b) => (
            <span
              key={b}
              className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200"
            >
              ✓ {BADGE_LABELS[b]}
            </span>
          ))}
        </div>
      )}

      {/* Languages */}
      {poster.languages.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-[var(--text-muted)] mb-1">Speaks</p>
          <div className="flex flex-wrap gap-1">
            {poster.languages.map((l) => (
              <span
                key={l}
                className="px-2 py-0.5 text-xs rounded-full bg-[var(--background-secondary)] text-[var(--text-primary)] uppercase"
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        href={`/dashboard/messages?listingId=${listingId}&posterId=${poster.id}`}
        className="block w-full text-center px-4 py-2 rounded-lg bg-navy-500 text-white text-sm font-medium hover:bg-navy-600 transition-colors btn-press"
      >
        Message {poster.firstName}
      </Link>
    </div>
  );
}
