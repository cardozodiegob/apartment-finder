"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import { firstPhotoUrl, type PhotoValue } from "@/lib/listings/photoUrl";

interface ReviewData {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ListingData {
  id: string;
  title: string;
  monthlyRent: number;
  currency: string;
  city: string;
  propertyType: string;
  photos: PhotoValue[];
}

interface ProfileData {
  id: string;
  fullName: string;
  bio: string | null;
  trustScore: number;
  badge: "new" | "trusted" | "verified";
  badges?: string[];
  languages?: string[];
  completedTransactions: number;
  recentReviews: ReviewData[];
  reviewHistogram?: number[];
  activeListings: ListingData[];
  memberSince: string;
  profileCompleteness: number;
  isSuspended: boolean;
  responseRate?: number | null;
  responseTimeHours?: number | null;
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        // Check if viewer is the profile owner
        const sessionRes = await fetch("/api/auth/session");
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData.user?.mongoId === userId) {
            setIsOwner(true);
          }
        }

        const res = await fetch(`/api/users/${userId}/profile`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.message || "Failed to load profile");
          return;
        }
        const data = await res.json();
        setProfile(data.profile);
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <p className="text-[var(--text-muted)]">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <p className="text-red-500 dark:text-red-400">{error || "Profile not found"}</p>
      </div>
    );
  }

  const badgeColors = {
    new: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
    trusted: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
    verified: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200",
  };

  const trustPercentage = (profile.trustScore / 5) * 100;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {profile.isSuspended && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-300 font-medium">Account Flagged</p>
          <p className="text-red-600 dark:text-red-400 text-sm">
            This account has been flagged for review by our moderation team.
          </p>
        </div>
      )}

      {/* Profile Header */}
      <div className="flex items-start gap-6 mb-8">
        <UserAvatar name={profile.fullName} size={96} />
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{profile.fullName}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColors[profile.badge]}`}>
              {profile.badge}
            </span>
          </div>
          {profile.bio && (
            <p className="text-[var(--text-secondary)] mb-2">{profile.bio}</p>
          )}
          <p className="text-sm text-[var(--text-muted)]">
            Member since {new Date(profile.memberSince).toLocaleDateString()}
          </p>
          {isOwner && (
            <Link
              href="/dashboard/settings"
              className="inline-block mt-3 px-4 py-2 rounded-xl text-sm font-medium bg-white/60 dark:bg-[#0c1754]/60 backdrop-blur-md border border-[var(--glass-border)] text-[var(--text-primary)] hover:bg-white/80 dark:hover:bg-[#0c1754]/80 transition-colors btn-press"
            >
              Edit Profile
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="glass-card text-center">
          <div className="text-2xl font-bold text-[var(--text-primary)]">{profile.trustScore.toFixed(1)}</div>
          <div className="text-sm text-[var(--text-muted)]">Trust Score</div>
          <div className="mt-1 w-full bg-[var(--background-secondary)] rounded-full h-1.5">
            <div
              className="bg-navy-500 h-1.5 rounded-full"
              style={{ width: `${trustPercentage}%` }}
            />
          </div>
        </div>
        <div className="glass-card text-center">
          <div className="text-2xl font-bold text-[var(--text-primary)]">{profile.completedTransactions}</div>
          <div className="text-sm text-[var(--text-muted)]">Transactions</div>
        </div>
        <div className="glass-card text-center">
          <div className="text-2xl font-bold text-[var(--text-primary)]">{profile.activeListings.length}</div>
          <div className="text-sm text-[var(--text-muted)]">Active Listings</div>
        </div>
        <div className="glass-card text-center">
          <div className="text-2xl font-bold text-[var(--text-primary)]">{Math.round(profile.profileCompleteness * 100)}%</div>
          <div className="text-sm text-[var(--text-muted)]">Profile Complete</div>
        </div>
      </div>

      {/* Response metrics */}
      {(profile.responseRate !== null || profile.responseTimeHours !== null) && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="glass-card text-center">
            <div className="text-xl font-semibold text-[var(--text-primary)]">
              {profile.responseRate !== null && profile.responseRate !== undefined
                ? `${Math.round((profile.responseRate ?? 0) * 100)}%`
                : "—"}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Response rate (90d)</div>
          </div>
          <div className="glass-card text-center">
            <div className="text-xl font-semibold text-[var(--text-primary)]">
              {profile.responseTimeHours !== null && profile.responseTimeHours !== undefined
                ? profile.responseTimeHours < 1
                  ? "< 1h"
                  : profile.responseTimeHours < 24
                    ? `~${Math.round(profile.responseTimeHours)}h`
                    : `~${Math.round(profile.responseTimeHours / 24)}d`
                : "—"}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Response time</div>
          </div>
        </div>
      )}

      {/* Verification badges + languages */}
      {(profile.badges && profile.badges.length > 0) || (profile.languages && profile.languages.length > 0) ? (
        <div className="glass-card mb-8">
          {profile.badges && profile.badges.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {profile.badges.map((b) => {
                const [kind, value] = b.includes(":") ? b.split(":") : [b];
                const label =
                  kind === "idVerified" ? "✓ ID verified" :
                  kind === "emailVerified" ? "✓ Email verified" :
                  kind === "phoneVerified" ? "✓ Phone verified" :
                  kind === "landlordSince" ? `Landlord since ${value}` :
                  kind === "transactions" ? `${value} transactions` : kind;
                return (
                  <span key={b} className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200">
                    {label}
                  </span>
                );
              })}
            </div>
          )}
          {profile.languages && profile.languages.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1">Speaks</p>
              <div className="flex flex-wrap gap-1">
                {profile.languages.map((l) => (
                  <span key={l} className="px-2 py-0.5 text-xs rounded-full bg-[var(--background-secondary)] text-[var(--text-primary)] uppercase">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Review histogram */}
      {profile.reviewHistogram && profile.reviewHistogram.some((n) => n > 0) && (
        <div className="glass-card mb-8">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Review distribution</h2>
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = profile.reviewHistogram![stars - 1];
              const total = profile.reviewHistogram!.reduce((a, b) => a + b, 0);
              const pct = total === 0 ? 0 : Math.round((count / total) * 100);
              return (
                <div key={stars} className="flex items-center gap-2 text-xs">
                  <span className="w-10 text-[var(--text-muted)]">{stars} ★</span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--background-secondary)]">
                    <div className="h-2 rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-[var(--text-muted)]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Reviews */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Recent Reviews</h2>
        {profile.recentReviews.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">No reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {profile.recentReviews.map((review) => (
              <div key={review.id} className="glass-card">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-[var(--text-primary)]">{review.reviewerName}</span>
                  <span
                    className="text-yellow-500 text-sm"
                    role="img"
                    aria-label={`${review.rating} out of 5 stars`}
                  >
                    {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                <p className="text-[var(--text-secondary)] text-sm">{review.comment}</p>
                <p className="text-[var(--text-muted)] text-xs mt-1">
                  {new Date(review.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Listings */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Active Listings</h2>
        {profile.activeListings.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">No active listings.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.activeListings.map((listing) => {
              const photo = firstPhotoUrl(listing.photos);
              return (
                <Link
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  className="glass-card card-hover overflow-hidden p-0 block"
                >
                  {photo ? (
                    <img
                      src={photo}
                      alt={listing.title}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-[var(--background-secondary)] flex items-center justify-center text-[var(--text-muted)] text-sm">
                      {listing.propertyType}
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-[var(--text-primary)] truncate">{listing.title}</h3>
                    <p className="text-[var(--text-muted)] text-xs">{listing.city} · {listing.propertyType}</p>
                    <p className="font-semibold text-sm text-[var(--text-primary)] mt-1">
                      {listing.currency} {listing.monthlyRent.toLocaleString()}/mo
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
