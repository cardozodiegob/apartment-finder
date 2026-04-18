"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface FavoriteItem {
  _id: string;
  listingId: {
    _id: string;
    title: string;
    monthlyRent: number;
    currency: string;
    photos: string[];
    address: { city: string; country: string };
    propertyType: string;
  } | string;
  savedAt: string;
}

const PLACEHOLDER_IMG = "https://placehold.co/400x300/e2e8f0/64748b?text=No+Photo";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  async function handleRemove(listingId: string) {
    await fetch(`/api/favorites/${listingId}`, { method: "DELETE" });
    setFavorites((prev) => prev.filter((f) => {
      const lid = typeof f.listingId === "string" ? f.listingId : f.listingId._id;
      return lid !== listingId;
    }));
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">My Favorites</h1>

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((fav) => {
              const listing = typeof fav.listingId === "string" ? null : fav.listingId;
              const listingId = typeof fav.listingId === "string" ? fav.listingId : fav.listingId._id;
              return (
                <div key={fav._id} className="glass-card">
                  <Link href={`/listings/${listingId}`}>
                    <img
                      src={listing?.photos?.[0] || PLACEHOLDER_IMG}
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
                  </Link>
                  <button
                    onClick={() => handleRemove(listingId)}
                    className="mt-2 text-xs text-red-500 hover:underline"
                  >
                    Remove from favorites
                  </button>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Saved {new Date(fav.savedAt).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
