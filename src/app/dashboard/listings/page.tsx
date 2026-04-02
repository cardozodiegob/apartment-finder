"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";
import { SkeletonCard } from "@/components/ui/Skeleton";

interface ListingItem {
  _id: string;
  title: string;
  propertyType: string;
  monthlyRent: number;
  currency: string;
  status: string;
  photos: string[];
  address: { city: string; country: string };
  createdAt: string;
}

const PLACEHOLDER_IMG = "https://placehold.co/400x300/e2e8f0/64748b?text=No+Photo";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  under_review: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function DashboardListingsPage() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const { toasts, toast, dismissToast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionRes.ok || !sessionData.session) {
          setError("Please log in to view your listings");
          setIsLoading(false);
          return;
        }
        const userId = sessionData.session.user.mongoId;
        const statusParam = filter !== "all" ? `?status=${filter}` : "";
        const res = await fetch(`/api/listings/user/${userId}${statusParam}`);
        const data = await res.json();
        if (!res.ok) { setError(data.message || "Failed to load listings"); return; }
        setListings(data.listings);
      } catch { setError("Failed to load listings"); }
      finally { setIsLoading(false); }
    }
    load();
  }, [filter]);

  async function handlePriceSave(listing: ListingItem) {
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      toast("Enter a valid price", "error");
      return;
    }
    setSavingPrice(true);
    try {
      const res = await fetch(`/api/listings/${listing._id}/price`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyRent: newPrice }),
      });
      if (res.ok) {
        const data = await res.json();
        setListings((prev) =>
          prev.map((l) => l._id === listing._id ? { ...l, monthlyRent: data.listing.monthlyRent } : l)
        );
        toast("Price updated", "success");
        setEditingId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.message || "Failed to update price", "error");
      }
    } catch {
      toast("Failed to update price", "error");
    } finally {
      setSavingPrice(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">My Listings</h1>
          <Link href="/listings/new"
            className="px-4 py-2 rounded-lg bg-navy-600 hover:bg-navy-700 text-white font-medium transition-colors btn-press">
            + New Listing
          </Link>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mb-6">
          {["all", "draft", "active", "under_review", "archived"].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors btn-press ${
                filter === s
                  ? "bg-navy-600 text-white"
                  : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background-secondary)]"
              }`}>
              {s === "all" ? "All" : s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm" role="alert">{error}</div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="glass-card text-center py-12">
            <p className="text-[var(--text-muted)] mb-4">No listings yet</p>
            <Link href="/listings/new" className="text-navy-500 hover:underline">Create your first listing</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <div key={listing._id} className="glass-card hover:shadow-lg transition-shadow group">
                <Link href={`/listings/${listing._id}`} className="block">
                  <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-[var(--surface)]">
                    <img
                      src={listing.photos[0] || PLACEHOLDER_IMG}
                      alt={listing.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-[var(--text-primary)] line-clamp-1">{listing.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${STATUS_STYLES[listing.status] || STATUS_STYLES.archived}`}>
                      {listing.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">{listing.address.city}, {listing.address.country}</p>
                </Link>

                {/* Price row with edit */}
                <div className="mt-1">
                  {editingId === listing._id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-24 px-2 py-1 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
                        min="0"
                        autoFocus
                      />
                      <span className="text-xs text-[var(--text-muted)]">{listing.currency}</span>
                      <button
                        onClick={() => handlePriceSave(listing)}
                        disabled={savingPrice}
                        className="px-2 py-1 text-xs bg-navy-500 text-white rounded-lg hover:bg-navy-600 disabled:opacity-50 btn-press"
                      >
                        {savingPrice ? "…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 text-xs border border-[var(--border)] text-[var(--text-muted)] rounded-lg hover:bg-[var(--background-secondary)] btn-press"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-[var(--text-primary)]">
                        {listing.monthlyRent.toLocaleString()} {listing.currency}
                        <span className="text-sm font-normal text-[var(--text-muted)]">/mo</span>
                      </p>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setEditingId(listing._id);
                          setEditPrice(String(listing.monthlyRent));
                        }}
                        className="px-1.5 py-0.5 text-xs rounded border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--background-secondary)] transition-colors btn-press"
                        aria-label={`Edit price for ${listing.title}`}
                      >
                        ✎
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-[var(--text-muted)] mt-2">
                  {listing.propertyType} · {new Date(listing.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
