"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/search/MapView"), { ssr: false });

interface Listing {
  _id: string;
  title: string;
  description: string;
  propertyType: string;
  purpose: string;
  monthlyRent: number;
  currency: string;
  availableDate: string;
  photos: string[];
  tags: string[];
  isSharedAccommodation: boolean;
  address: { street: string; city: string; neighborhood?: string; postalCode: string; country: string };
  location: { type: string; coordinates: [number, number] };
}

interface SearchResult {
  listings: Listing[];
  totalCount: number;
  page: number;
  totalPages: number;
}

const PROPERTY_TYPES = ["apartment", "room", "house"] as const;
const PURPOSES = ["rent", "share", "sublet"] as const;
const CITIES = ["Berlin", "Paris", "London", "Amsterdam", "Barcelona", "Rome", "Lisbon", "Vienna"];

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Filter state from URL
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [propertyType, setPropertyType] = useState(searchParams.get("propertyType") || "");
  const [purpose, setPurpose] = useState(searchParams.get("purpose") || "");
  const [priceMin, setPriceMin] = useState(searchParams.get("priceMin") || "");
  const [priceMax, setPriceMax] = useState(searchParams.get("priceMax") || "");
  const [bedrooms, setBedrooms] = useState(searchParams.get("bedrooms") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [isShared, setIsShared] = useState(searchParams.get("isSharedAccommodation") === "true");
  const [showMap, setShowMap] = useState(false);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (propertyType) params.set("propertyType", propertyType);
    if (purpose) params.set("purpose", purpose);
    if (priceMin) params.set("priceMin", priceMin);
    if (priceMax) params.set("priceMax", priceMax);
    if (bedrooms) params.set("bedrooms", bedrooms);
    if (city) params.set("city", city);
    if (isShared) params.set("isSharedAccommodation", "true");
    return params.toString();
  }, [query, propertyType, purpose, priceMin, priceMax, bedrooms, city, isShared]);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryString();
      const res = await fetch(`/api/search?${qs}`);
      const data = await res.json();
      setResults(data);
      router.replace(`/search?${qs}`, { scroll: false });
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [buildQueryString, router]);

  useEffect(() => { fetchResults(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilters = () => {
    setQuery(""); setPropertyType(""); setPurpose("");
    setPriceMin(""); setPriceMax(""); setBedrooms("");
    setCity(""); setIsShared(false);
    router.replace("/search");
  };

  const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' fill='%23dce4ff'%3E%3Crect width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%233b5bdb' font-size='18'%3ENo Image%3C/text%3E%3C/svg%3E";

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Filter Sidebar */}
        <aside className="w-full lg:w-72 shrink-0">
          <div className="glass-card space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Filters</h2>

            <input type="text" placeholder="Search listings..." value={query} onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />

            <div>
              <label className="text-xs text-[var(--text-secondary)] font-medium">Property Type</label>
              <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm">
                <option value="">All</option>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--text-secondary)] font-medium">Purpose</label>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm">
                <option value="">All</option>
                {PURPOSES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-[var(--text-secondary)] font-medium">Min Price</label>
                <input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="0"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-[var(--text-secondary)] font-medium">Max Price</label>
                <input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="10000"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--text-secondary)] font-medium">Bedrooms</label>
              <input type="number" min="0" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
            </div>

            <div>
              <label className="text-xs text-[var(--text-secondary)] font-medium">City</label>
              <select value={city} onChange={(e) => setCity(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm">
                <option value="">All Cities</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)}
                className="rounded border-[var(--border)]" />
              Shared Accommodation
            </label>

            <div className="flex gap-2">
              <button onClick={fetchResults}
                className="flex-1 px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 transition-colors">
                Search
              </button>
              <button onClick={clearFilters}
                className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm hover:bg-[var(--background-secondary)] transition-colors">
                Clear
              </button>
            </div>

            <button onClick={() => setShowMap(!showMap)}
              className="w-full px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm hover:bg-[var(--background-secondary)] transition-colors">
              {showMap ? "Hide Map" : "Show Map"}
            </button>
          </div>
        </aside>

        {/* Results */}
        <main className="flex-1">
          {showMap && (
            <div className="mb-6 rounded-xl overflow-hidden border border-[var(--border)]" style={{ height: 400 }}>
              <MapView listings={results?.listings || []} />
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              {loading ? "Searching..." : `${results?.totalCount ?? 0} listings found`}
            </h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {results?.listings.map((listing) => (
              <a key={listing._id} href={`/listings/${listing._id}`} className="glass-card hover:scale-[1.02] transition-transform block">
                <img
                  src={listing.photos?.[0] || placeholderImg}
                  alt={listing.title}
                  className="w-full h-40 object-cover rounded-lg mb-3"
                  onError={(e) => { (e.target as HTMLImageElement).src = placeholderImg; }}
                />
                <h3 className="font-semibold text-[var(--text-primary)] truncate">{listing.title}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{listing.address.city}, {listing.address.country}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-lg font-bold text-navy-500">{listing.currency} {listing.monthlyRent}/mo</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-navy-100 text-navy-700 dark:bg-navy-800 dark:text-navy-200">
                    {listing.propertyType}
                  </span>
                </div>
                {listing.isSharedAccommodation && (
                  <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                    Shared
                  </span>
                )}
              </a>
            ))}
          </div>

          {results && results.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: Math.min(results.totalPages, 5) }, (_, i) => (
                <button key={i} className={`px-3 py-1 rounded-lg text-sm ${results.page === i + 1 ? "bg-navy-500 text-white" : "border border-[var(--border)] text-[var(--text-secondary)]"}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
