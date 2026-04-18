"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { type PhotoValue } from "@/lib/listings/photoUrl";
import PosterCard from "@/components/listings/PosterCard";
import ListingActionIcons from "@/components/listings/ListingActionIcons";
import ListingFacts from "@/components/listings/ListingFacts";
import PriceBreakdown from "@/components/listings/PriceBreakdown";
import PhotoGallery from "@/components/listings/PhotoGallery";
import SimilarListings from "@/components/listings/SimilarListings";
import NearbyPOIList from "@/components/listings/NearbyPOIList";
import { recordView } from "@/lib/listings/recentlyViewed";
import type { Amenity } from "@/lib/constants/amenities";

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
  photos: PhotoValue[];
  tags: string[];
  isSharedAccommodation: boolean;
  currentOccupants?: number;
  availableRooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  beds?: number;
  floorArea?: number;
  floor?: number;
  totalFloors?: number;
  yearBuilt?: number;
  heatingType?: string;
  energyRating?: string;
  leaseType?: string;
  minStayMonths?: number;
  maxStayMonths?: number;
  deposit?: number;
  billsEstimate?: number;
  utilitiesIncluded?: boolean;
  amenities?: Amenity[];
  houseRules?: string[];
  isFurnished?: boolean;
  isPetFriendly?: boolean;
  hasParking?: boolean;
  hasBalcony?: boolean;
  floorPlanUrl?: string;
  virtualTourUrl?: string;
  nearbyTransit?: { kind: string; name: string; distanceMeters: number }[];
  nearbyAmenities?: { kind: string; name: string; distanceMeters: number }[];
  verificationTier?: "none" | "docs" | "photo_tour" | "in_person";
  status: string;
  posterId: string;
  createdAt: string;
  priceHistory?: PriceHistoryEntry[];
}

const PLACEHOLDER_IMG = "https://placehold.co/400x300/e2e8f0/64748b?text=No+Photo";

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

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<ListingData | null>(null);
  const [poster, setPoster] = useState<PosterCardData | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [error, setError] = useState("");
  const [viewingDate, setViewingDate] = useState("");
  const [viewingMsg, setViewingMsg] = useState("");
  const [viewingLoading, setViewingLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/listings/${id}`);
        const data = await res.json();
        if (!res.ok) { setError(data.message || "Listing not found"); return; }
        setListing(data.listing);
        setPoster(data.poster ?? null);
        setFavorited(Boolean(data.isFavorited));

        // Gate the edit button — only owner or admin
        try {
          const sessionRes = await fetch("/api/auth/session");
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            const me = sessionData.user;
            if (me && (me.role === "admin" || me.mongoId === data.listing.posterId)) {
              setCanEdit(true);
            }
          }
        } catch { /* non-auth users don't see the button */ }
      } catch { setError("Failed to load listing"); }
    }
    if (id) load();
  }, [id]);

  useEffect(() => {
    if (id) recordView(String(id));
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

  const photos = photoUrls(listing.photos).length > 0 ? photoUrls(listing.photos) : [PLACEHOLDER_IMG];

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] flex-wrap">
            <li>
              <Link href="/" className="hover:text-[var(--text-primary)] hover:underline">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/search?country=${encodeURIComponent(listing.address.country)}`} className="hover:text-[var(--text-primary)] hover:underline">
                {listing.address.country}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href={`/search?country=${encodeURIComponent(listing.address.country)}&city=${encodeURIComponent(listing.address.city)}`}
                className="hover:text-[var(--text-primary)] hover:underline"
              >
                {listing.address.city}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-[var(--text-primary)] truncate" aria-current="page">{listing.title}</li>
          </ol>
        </nav>

        {/* Photo gallery */}
        <div className="relative mb-6">
          <PhotoGallery
            photos={listing.photos}
            title={listing.title}
            floorPlanUrl={listing.floorPlanUrl}
            virtualTourUrl={listing.virtualTourUrl}
          />
          {listing.status !== "active" && (
            <div className="absolute top-4 left-4 pointer-events-none">
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
              <div className="flex items-start justify-between mb-4 gap-3">
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold text-[var(--text-primary)]">{listing.title}</h1>
                  <p className="text-[var(--text-secondary)]">
                    {listing.address.city}, {listing.address.country}
                    {listing.address.neighborhood && ` · ${listing.address.neighborhood}`}
                  </p>
                </div>
                <div className="flex items-start gap-2 shrink-0">
                  <ListingActionIcons
                    listingId={String(id)}
                    listingTitle={listing.title}
                    initialFavorited={favorited}
                  />
                  <Link href={`/listings/${id}/edit`}
                    className={`px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors ${canEdit ? "" : "hidden"}`}>
                    Edit
                  </Link>
                </div>
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

            <ListingFacts
              data={{
                bedrooms: listing.bedrooms,
                bathrooms: listing.bathrooms,
                beds: listing.beds,
                floorArea: listing.floorArea,
                floor: listing.floor,
                totalFloors: listing.totalFloors,
                yearBuilt: listing.yearBuilt,
                heatingType: listing.heatingType,
                energyRating: listing.energyRating,
                leaseType: listing.leaseType,
                minStayMonths: listing.minStayMonths,
                maxStayMonths: listing.maxStayMonths,
                utilitiesIncluded: listing.utilitiesIncluded,
                isFurnished: listing.isFurnished,
                isPetFriendly: listing.isPetFriendly,
                hasParking: listing.hasParking,
                hasBalcony: listing.hasBalcony,
                amenities: listing.amenities,
                houseRules: listing.houseRules,
              }}
            />

            {listing.nearbyTransit && listing.nearbyTransit.length > 0 && (
              <NearbyPOIList title="Nearby transit" items={listing.nearbyTransit} />
            )}
            {listing.nearbyAmenities && listing.nearbyAmenities.length > 0 && (
              <NearbyPOIList title="Nearby amenities" items={listing.nearbyAmenities} />
            )}

            {/* Poster card */}
            {poster ? (
              <PosterCard poster={poster} listingId={String(id)} />
            ) : (
              <div className="glass-card">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Poster</h2>
                <p className="text-sm text-[var(--text-muted)]">Poster information unavailable.</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="glass-card">
              <p className="text-3xl font-bold text-[var(--text-primary)]">
                {listing.monthlyRent.toLocaleString()} {listing.currency}
              </p>
              <p className="text-sm text-[var(--text-muted)]">per month</p>
              <Link
                href="/move-in-guarantee"
                className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-navy-100 dark:bg-navy-900/40 text-navy-700 dark:text-navy-200 text-xs font-medium hover:bg-navy-200 dark:hover:bg-navy-900/60"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                </svg>
                Move-in guaranteed
              </Link>
              {listing.verificationTier && listing.verificationTier !== "none" && (
                <span className="mt-2 ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200 text-xs font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5-3v11a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h8l4 4z" />
                  </svg>
                  Verified listing
                </span>
              )}
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

            <PriceBreakdown
              monthlyRent={listing.monthlyRent}
              currency={listing.currency}
              deposit={listing.deposit}
              billsEstimate={listing.billsEstimate}
              utilitiesIncluded={listing.utilitiesIncluded}
            />

            {/* Map */}
            <div className="glass-card">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Location</h3>
              <div className="rounded-lg overflow-hidden border border-[var(--border)]" style={{ minHeight: 400, height: 400 }}>
                {listing.location?.coordinates ? (
                  <ListingDetailMap
                    lng={listing.location.coordinates[0]}
                    lat={listing.location.coordinates[1]}
                    obscurePin
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[var(--surface)]">
                    <p className="text-xs text-[var(--text-muted)]">No location data</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Exact location shared after booking. A 500 m area is shown for privacy.
              </p>
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

        {/* Similar listings */}
        <SimilarListings listingId={String(id)} />
      </div>
    </div>
  );
}
