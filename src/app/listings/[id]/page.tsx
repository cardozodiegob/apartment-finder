"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const ListingDetailMap = dynamic(() => import("@/components/listings/ListingDetailMap"), { ssr: false });

interface PriceHistoryEntry {
  price: number;
  currency: string;
  changedAt: string;
}

interface ListingData {
  _id: string;
  title: string;
  description: string;
  propertyType: string;
  purpose: string;
  address: { street: string; city: string; neighborhood?: string; postalCode: string; country: string };
  location: { type: string; coordinates: [number, number] };
  monthlyRent: number;
  currency: string;
  availableDate: string;
  photos: string[];
  tags: string[];
  isSharedAccommodation: boolean;
  currentOccupants?: number;
  availableRooms?: number;
  status: string;
  posterId: string;
  createdAt: string;
  priceHistory?: PriceHistoryEntry[];
}

const PLACEHOLDER_IMG = "https://placehold.co/400x300/e2e8f0/64748b?text=No+Photo";

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<ListingData | null>(null);
  const [error, setError] = useState("");
  const [activePhoto, setActivePhoto] = useState(0);
  const [viewingDate, setViewingDate] = useState("");
  const [viewingMsg, setViewingMsg] = useState("");
  const [viewingLoading, setViewingLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/listings/${id}`);
        const data = await res.json();
        if (!res.ok) { setError(data.message || "Listing not found"); return; }
        setListing(data.listing);
      } catch { setError("Failed to load listing"); }
    }
    if (id) load();
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="glass-card text-center">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Listing Not Found</h1>
          <p className="text-[var(--text-muted)]">{error}</p>
          <Link href="/" className="mt-4 inline-block text-navy-500 hover:underline">Back to home</Link>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading...</p>
      </div>
    );
  }

  const photos = listing.photos.length > 0 ? listing.photos : [PLACEHOLDER_IMG];

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Photo gallery */}
        <div className="relative aspect-video rounded-2xl overflow-hidden mb-6 bg-[var(--surface)]">
          <img
            src={photos[activePhoto]}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhoto(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i === activePhoto ? "bg-white" : "bg-white/50"
                  }`}
                  aria-label={`View photo ${i + 1}`}
                />
              ))}
            </div>
          )}
          {listing.status !== "active" && (
            <div className="absolute top-4 left-4">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                listing.status === "draft" ? "bg-yellow-100 text-yellow-800" :
                listing.status === "under_review" ? "bg-orange-100 text-orange-800" :
                "bg-gray-100 text-gray-800"
              }`}>
                {listing.status.replace("_", " ").toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)]">{listing.title}</h1>
                  <p className="text-[var(--text-secondary)]">
                    {listing.address.city}, {listing.address.country}
                    {listing.address.neighborhood && ` · ${listing.address.neighborhood}`}
                  </p>
                </div>
                <Link href={`/listings/${id}/edit`}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors">
                  Edit
                </Link>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-navy-100 dark:bg-navy-900/30 text-navy-700 dark:text-navy-300">
                  {listing.propertyType}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-navy-100 dark:bg-navy-900/30 text-navy-700 dark:text-navy-300">
                  {listing.purpose}
                </span>
                {listing.isSharedAccommodation && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                    Shared
                  </span>
                )}
              </div>

              <p className="text-[var(--text-primary)] whitespace-pre-wrap">{listing.description}</p>

              {listing.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {listing.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded text-xs bg-[var(--background-secondary)] text-[var(--text-muted)]">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {listing.isSharedAccommodation && (
              <div className="glass-card">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Shared Accommodation</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">Current Occupants</p>
                    <p className="text-lg font-medium text-[var(--text-primary)]">{listing.currentOccupants ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">Available Rooms</p>
                    <p className="text-lg font-medium text-[var(--text-primary)]">{listing.availableRooms ?? 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Poster trust score placeholder */}
            <div className="glass-card">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Poster</h2>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-navy-100 dark:bg-navy-900/30 flex items-center justify-center">
                  <span className="text-navy-600 dark:text-navy-300 font-medium text-sm">P</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Poster</p>
                  <p className="text-xs text-[var(--text-muted)]">Trust score coming soon</p>
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-3">Recent reviews will appear here.</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="glass-card">
              <p className="text-3xl font-bold text-[var(--text-primary)]">
                {listing.monthlyRent.toLocaleString()} {listing.currency}
              </p>
              <p className="text-sm text-[var(--text-muted)]">per month</p>
              {(() => {
                const history = listing.priceHistory;
                if (history && history.length > 0) {
                  const last = history[history.length - 1];
                  if (last.price !== listing.monthlyRent) {
                    const reduced = listing.monthlyRent < last.price;
                    return (
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          reduced
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        }`}>
                          {reduced ? "↓ Price reduced" : "↑ Price increased"}
                        </span>
                        <span className="text-sm text-[var(--text-muted)] line-through">
                          {last.price.toLocaleString()} {last.currency}
                        </span>
                      </div>
                    );
                  }
                }
                return null;
              })()}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Available</span>
                  <span className="text-[var(--text-primary)]">{new Date(listing.availableDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Address</span>
                  <span className="text-[var(--text-primary)]">{listing.address.street}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Postal Code</span>
                  <span className="text-[var(--text-primary)]">{listing.address.postalCode}</span>
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="glass-card">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Location</h3>
              <div className="aspect-square rounded-lg overflow-hidden border border-[var(--border)]">
                {listing.location?.coordinates ? (
                  <ListingDetailMap
                    lng={listing.location.coordinates[0]}
                    lat={listing.location.coordinates[1]}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[var(--surface)]">
                    <p className="text-xs text-[var(--text-muted)]">No location data</p>
                  </div>
                )}
              </div>
            </div>

            {/* Request Viewing */}
            {listing.status === "active" && listing.address.neighborhood && (
              <div className="glass-card">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Neighborhood Guide</h3>
                <Link
                  href={`/neighborhoods/${encodeURIComponent(listing.address.city)}/${encodeURIComponent(listing.address.neighborhood)}`}
                  className="text-sm text-navy-500 hover:underline"
                >
                  Explore {listing.address.neighborhood} →
                </Link>
              </div>
            )}

            {/* Request Viewing */}
            {listing.status === "active" && (
              <div className="glass-card">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Request a Viewing</h3>
                <input
                  type="datetime-local"
                  value={viewingDate}
                  onChange={(e) => setViewingDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] text-sm mb-2"
                />
                <button
                  onClick={async () => {
                    if (!viewingDate) { setViewingMsg("Please select a date and time"); return; }
                    setViewingLoading(true);
                    setViewingMsg("");
                    try {
                      const res = await fetch("/api/viewings", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ listingId: id, proposedDate: new Date(viewingDate).toISOString() }),
                      });
                      const data = await res.json();
                      if (!res.ok) setViewingMsg(data.message || "Failed to request viewing");
                      else setViewingMsg("Viewing request sent!");
                    } catch { setViewingMsg("Failed to request viewing"); }
                    finally { setViewingLoading(false); }
                  }}
                  disabled={viewingLoading}
                  className="w-full px-4 py-2 rounded-lg bg-navy-500 text-white text-sm font-medium hover:bg-navy-600 disabled:opacity-50 transition-colors"
                >
                  {viewingLoading ? "Requesting..." : "Request Viewing"}
                </button>
                {viewingMsg && (
                  <p className={`text-xs mt-2 ${viewingMsg.includes("sent") ? "text-green-600" : "text-red-500"}`}>{viewingMsg}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
