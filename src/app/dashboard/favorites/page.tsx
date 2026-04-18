"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { firstPhotoUrl, type PhotoValue } from "@/lib/listings/photoUrl";

interface ListingSummary {
  _id: string;
  title: string;
  monthlyRent: number;
  currency: string;
  photos: PhotoValue[];
  address: { city: string; country: string };
  propertyType: string;
  priceHistory?: { price: number; currency: string; changedAt: string }[];
}

interface FavoriteItem {
  _id: string;
  listingId: ListingSummary | string;
  folderName?: string;
  note?: string;
  savedAt: string;
}

const PLACEHOLDER_IMG = "https://placehold.co/400x300/e2e8f0/64748b?text=No+Photo";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState("");
  const [shareInfo, setShareInfo] = useState<{ folder: string; url: string } | null>(null);

  useEffect(() => {
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((data) => {
        if (data.favorites) setFavorites(data.favorites);
        else if (data.message) setError(data.message);
      })
      .catch(() => setError("Failed to load favorites"))
      .finally(() => setLoading(false));
  }, []);

  const folders = useMemo(() => {
    const names = new Set<string>(["All"]);
    for (const f of favorites) names.add(f.folderName || "Default");
    return Array.from(names);
  }, [favorites]);

  const visible = useMemo(() => {
    if (activeFolder === "All") return favorites;
    return favorites.filter((f) => (f.folderName || "Default") === activeFolder);
  }, [favorites, activeFolder]);

  async function handleRemove(listingId: string) {
    await fetch(`/api/favorites/${listingId}`, { method: "DELETE" });
    setFavorites((prev) => prev.filter((f) => {
      const lid = typeof f.listingId === "string" ? f.listingId : f.listingId._id;
      return lid !== listingId;
    }));
  }

  function toggleSelect(favId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(favId)) next.delete(favId); else next.add(favId);
      return next;
    });
  }

  async function handleBulkMove() {
    if (selected.size === 0 || !bulkTarget.trim()) return;
    const ids = Array.from(selected);
    await fetch("/api/favorites/bulk-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, folderName: bulkTarget.trim() }),
    });
    setFavorites((prev) =>
      prev.map((f) => (ids.includes(f._id) ? { ...f, folderName: bulkTarget.trim() } : f)),
    );
    setSelected(new Set());
    setBulkTarget("");
  }

  async function handleShareFolder() {
    if (activeFolder === "All") return;
    const res = await fetch("/api/favorites/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderName: activeFolder }),
    });
    if (res.ok) {
      const data = await res.json();
      const url = `${window.location.origin}/favorites/shared/${data.token}`;
      setShareInfo({ folder: activeFolder, url });
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-6">My Favorites</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>
        )}

        {loading ? (
          <p className="text-[var(--text-muted)]">Loading...</p>
        ) : favorites.length === 0 ? (
          <div className="glass-card text-center py-12">
            <p className="text-[var(--text-muted)] mb-4">No saved listings yet</p>
            <Link href="/search" className="text-navy-500 hover:underline">Browse listings</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
            <aside>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Folders</h2>
              <nav className="flex flex-col gap-1" aria-label="Favorite folders">
                {folders.map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFolder(f)}
                    className={`text-left px-3 py-2 rounded-lg text-sm ${f === activeFolder ? "bg-navy-500 text-white" : "text-[var(--text-primary)] hover:bg-[var(--background-secondary)]"}`}
                  >
                    {f}
                  </button>
                ))}
              </nav>

              {activeFolder !== "All" && (
                <button
                  onClick={handleShareFolder}
                  className="mt-3 w-full px-3 py-2 rounded-lg border border-navy-500 text-navy-500 text-xs font-medium hover:bg-navy-50 dark:hover:bg-navy-900/20"
                >
                  Share folder link
                </button>
              )}
              {shareInfo && (
                <div className="mt-2 p-2 rounded-lg bg-[var(--background-secondary)] text-xs text-[var(--text-secondary)] break-all">
                  Link copied:<br />
                  <a href={shareInfo.url} className="text-navy-500 hover:underline">{shareInfo.url}</a>
                </div>
              )}
            </aside>

            <main>
              {selected.size > 0 && (
                <div className="mb-4 flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-[var(--text-primary)]">{selected.size} selected</span>
                  <input
                    type="text"
                    value={bulkTarget}
                    onChange={(e) => setBulkTarget(e.target.value)}
                    placeholder="Move to folder…"
                    className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
                  />
                  <button
                    onClick={handleBulkMove}
                    disabled={!bulkTarget.trim()}
                    className="px-3 py-1 rounded-lg bg-navy-500 text-white text-sm font-medium hover:bg-navy-600 disabled:opacity-50"
                  >
                    Move
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="px-3 py-1 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-sm"
                  >
                    Clear
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visible.map((fav) => {
                  const listing = typeof fav.listingId === "string" ? null : fav.listingId;
                  const listingId = typeof fav.listingId === "string" ? fav.listingId : fav.listingId._id;
                  const photo = listing ? firstPhotoUrl(listing.photos) : "";

                  let dropBadge: React.ReactNode = null;
                  if (listing?.priceHistory && listing.priceHistory.length > 0) {
                    const last = listing.priceHistory[listing.priceHistory.length - 1];
                    if (last.price > listing.monthlyRent) {
                      const pct = Math.round(((last.price - listing.monthlyRent) / last.price) * 100);
                      dropBadge = (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs font-medium">
                          ↓ Price dropped −{pct}%
                        </span>
                      );
                    }
                  }

                  return (
                    <div key={fav._id} className="glass-card">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selected.has(fav._id)}
                          onChange={() => toggleSelect(fav._id)}
                          aria-label={`Select ${listing?.title ?? "listing"}`}
                          className="mt-2 w-4 h-4 rounded border-[var(--border)]"
                        />
                        <Link href={`/listings/${listingId}`} className="flex-1 block">
                          <img
                            src={photo || PLACEHOLDER_IMG}
                            alt={listing?.title || "Listing"}
                            className="w-full h-40 object-cover rounded-lg mb-3"
                            loading="lazy"
                          />
                          <h3 className="font-semibold text-[var(--text-primary)] truncate">{listing?.title || "Listing"}</h3>
                          <p className="text-sm text-[var(--text-muted)]">
                            {listing?.address?.city || "Unknown"}, {listing?.address?.country || ""}
                          </p>
                          {listing && (
                            <p className="text-lg font-bold text-navy-500 mt-1">
                              {listing.currency} {listing.monthlyRent.toLocaleString()}/mo
                            </p>
                          )}
                          {dropBadge}
                        </Link>
                      </div>
                      {fav.note && (
                        <p className="text-xs text-[var(--text-secondary)] mt-2 italic">{fav.note}</p>
                      )}
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {(fav.folderName || "Default")} · saved {new Date(fav.savedAt).toLocaleDateString()}
                      </p>
                      <button
                        onClick={() => handleRemove(listingId)}
                        className="mt-2 text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
