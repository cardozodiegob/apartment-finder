"use client";

import { useState, useEffect, useCallback } from "react";

interface PosterInfo {
  fullName: string;
  trustScore: number;
  confirmedScamReports: number;
  accountCreatedAt: string;
}

interface Address {
  street: string;
  city: string;
  neighborhood?: string;
  postalCode: string;
  country: string;
}

interface FlaggedListing {
  _id: string;
  title: string;
  description: string;
  address: Address;
  monthlyRent: number;
  currency: string;
  photos: (string | { url: string })[];
  scamRiskLevel: "medium" | "high";
  status: string;
  posterId: string;
  posterInfo: PosterInfo | null;
  createdAt: string;
  updatedAt: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function accountAge(createdAt: string): string {
  const days = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}mo`;
}

function formatAddress(addr: Address): string {
  return `${addr.street}, ${addr.city}, ${addr.postalCode}, ${addr.country}`;
}

function RiskBadge({ level }: { level: "medium" | "high" }) {
  const styles =
    level === "high"
      ? "bg-red-100 text-red-700"
      : "bg-yellow-100 text-yellow-700";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      {level.toUpperCase()} RISK
    </span>
  );
}

export default function ScamReviewPage() {
  const [listings, setListings] = useState<FlaggedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const fetchListings = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/scam-review")
      .then((r) => r.json())
      .then((data) => setListings(data.listings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Identify duplicate-address listings from different posters
  const duplicateAddressKeys = new Set<string>();
  const addressMap = new Map<string, Set<string>>();
  for (const listing of listings) {
    const key = formatAddress(listing.address).toLowerCase();
    if (!addressMap.has(key)) addressMap.set(key, new Set());
    addressMap.get(key)!.add(listing.posterId);
  }
  for (const [key, posters] of addressMap) {
    if (posters.size > 1) duplicateAddressKeys.add(key);
  }

  async function handleApprove(id: string) {
    setActionInProgress(id);
    try {
      await fetch(`/api/admin/scam-review/${id}/approve`, { method: "POST" });
      setListings((prev) => prev.filter((l) => l._id !== id));
    } catch {
      // silently fail
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleReject(id: string) {
    setActionInProgress(id);
    try {
      await fetch(`/api/admin/scam-review/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason[id] || "" }),
      });
      setListings((prev) => prev.filter((l) => l._id !== id));
    } catch {
      // silently fail
    } finally {
      setActionInProgress(null);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
          Scam Review Queue
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Listings flagged with medium or high scam risk. Review and approve or
          reject.
        </p>

        {loading && (
          <p className="text-[var(--text-muted)] text-sm">Loading...</p>
        )}

        <div className="space-y-4">
          {listings.map((listing) => {
            const addrStr = formatAddress(listing.address);
            const isDuplicateAddress = duplicateAddressKeys.has(
              addrStr.toLowerCase()
            );

            return (
              <div
                key={listing._id}
                className={`glass-card ${isDuplicateAddress ? "border-2 border-orange-400" : ""}`}
              >
                {isDuplicateAddress && (
                  <div className="mb-2 px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded">
                    Duplicate address — same address used by different posters
                  </div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)] truncate">
                        {listing.title}
                      </h2>
                      <RiskBadge level={listing.scamRiskLevel} />
                    </div>

                    <p className="text-sm text-[var(--text-secondary)] mb-1">
                      {listing.monthlyRent} {listing.currency}/mo
                    </p>

                    <p className="text-sm text-[var(--text-secondary)] mb-2">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addrStr)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-[var(--text-primary)]"
                      >
                        {addrStr}
                      </a>
                    </p>

                    {/* Dates */}
                    <div className="flex gap-4 text-xs text-[var(--text-muted)] mb-2 flex-wrap">
                      <span>Created: {formatDate(listing.createdAt)}</span>
                      <span>Last edit: {formatDate(listing.updatedAt)}</span>
                      {listing.posterInfo && (
                        <span>
                          Poster account age:{" "}
                          {accountAge(listing.posterInfo.accountCreatedAt)}
                        </span>
                      )}
                    </div>

                    {/* Poster info */}
                    {listing.posterInfo && (
                      <div className="flex gap-4 text-xs text-[var(--text-muted)] mb-2 flex-wrap">
                        <span>Poster: {listing.posterInfo.fullName}</span>
                        <span>
                          Trust: {listing.posterInfo.trustScore.toFixed(1)}/5
                        </span>
                        <span>
                          Confirmed scams:{" "}
                          {listing.posterInfo.confirmedScamReports}
                        </span>
                      </div>
                    )}

                    {/* Photos with reverse image search */}
                    {listing.photos.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-2">
                        {listing.photos.map((photo, i) => {
                          const url = typeof photo === "string" ? photo : photo.url;
                          return (
                            <a
                              key={i}
                              href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline text-blue-600 hover:text-blue-800"
                            >
                              Photo {i + 1} — reverse search
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleApprove(listing._id)}
                    disabled={actionInProgress === listing._id}
                    className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <input
                    type="text"
                    placeholder="Rejection reason"
                    value={rejectReason[listing._id] || ""}
                    onChange={(e) =>
                      setRejectReason((prev) => ({
                        ...prev,
                        [listing._id]: e.target.value,
                      }))
                    }
                    className="px-2 py-1 border rounded text-xs flex-1 min-w-[150px] bg-[var(--background)] text-[var(--text-primary)]"
                  />
                  <button
                    onClick={() => handleReject(listing._id)}
                    disabled={actionInProgress === listing._id}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}

          {!loading && listings.length === 0 && (
            <p className="text-[var(--text-muted)] text-sm">
              No flagged listings to review
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
