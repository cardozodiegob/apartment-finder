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
const EUROPEAN_COUNTRIES = [
  "Germany", "France", "Spain", "Italy", "Portugal", "Netherlands", "Belgium",
  "Austria", "Switzerland", "Sweden", "Norway", "Denmark", "Finland", "Poland",
  "Czech Republic", "Ireland", "United Kingdom", "Greece", "Romania", "Hungary",
  "Croatia", "Bulgaria",
];

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filter state from URL
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [propertyType, setPropertyType] = useState(searchParams.get("propertyType") || "");
  const [purpose, setPurpose] = useState(searchParams.get("purpose") || "");
  const [priceMin, setPriceMin] = useState(searchParams.get("priceMin") || "");
  const [priceMax, setPriceMax] = useState(searchParams.get("priceMax") || "");
  const [bedrooms, setBedrooms] = useState(searchParams.get("bedrooms") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [country, setCountry] = useState(searchParams.get("country") || "");
  const [isShared, setIsShared] = useState(searchParams.get("isSharedAccommodation") === "true");
  const [showMap, setShowMap] = useState(false);
  const [boundary, setBoundary] = useState<number[][][] | null>(null);
  const [boundaryResults, setBoundaryResults] = useState<SearchResult | null>(null);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (propertyType) params.set("propertyType", propertyType);
    if (purpose) params.set("purpose", purpose);
    if (priceMin) params.set("priceMin", priceMin);
    if (priceMax) params.set("priceMax", priceMax);
    if (bedrooms) params.set("bedrooms", bedrooms);
    if (city) params.set("city", city);
    if (country) params.set("country", country);
    if (isShared) params.set("isSharedAccommodation", "true");
    return params.toString();
  }, [query, propertyType, purpose, priceMin, priceMax, bedrooms, city, country, isShared]);

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
    setCity(""); setCountry(""); setIsShared(false);
    setBoundary(null); setBoundaryResults(null);
    router.replace("/search");
  };

  const handleBoundaryChange = useCallback(async (newBoundary: number[][][] | null) => {
    setBoundary(newBoundary);
    if (!newBoundary) {
      setBoundaryResults(null);
      return;
    }
    try {
      const qs = buildQueryString();
      const params = Object.fromEntries(new URLSearchParams(qs));
      const res = await fetch("/api/search/boundary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...params,
          boundary: {
            type: "Polygon",
            coordinates: newBoundary,
          },
        }),
      });
      const data = await res.json();
      setBoundaryResults(data);
    } catch {
      setBoundaryResults(null);
    }
  }, [buildQueryString]);

  const clearBoundary = () => {
    setBoundary(null);
    setBoundaryResults(null);
  };

  // Use boundary results when a boundary is active, otherwise normal results
  const displayResults = boundary ? boundaryResults : results;

  const placeholderImg = "https://placehold.co/400x300/e2e8f0/64748b?text=No+Photo";

  /* Shared filter form content used in both sidebar and drawer */
  const filterContent = (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Filters</h2>

      <div>
        <label htmlFor="search-query" className="text-xs text-[var(--text-secondary)] font-medium">Search</label>
        <input id="search-query" type="text" placeholder="Search listings..." value={query} onChange={(e) => setQuery(e.target.value)}
          className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
      </div>

      <div>
        <label htmlFor="property-type" className="text-xs text-[var(--text-secondary)] font-medium">Property Type</label>
        <select id="property-type" value={propertyType} onChange={(e) => setPropertyType(e.target.value)}
          className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm">
          <option value="">All</option>
          {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="purpose-select" className="text-xs text-[var(--text-secondary)] font-medium">Purpose</label>
        <select id="purpose-select" value={purpose} onChange={(e) => setPurpose(e.target.value)}
          className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm">
          <option value="">All</option>
          {PURPOSES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor="price-min" className="text-xs text-[var(--text-secondary)] font-medium">Min Price</label>
          <input id="price-min" type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="0"
            className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
        </div>
        <div className="flex-1">
          <label htmlFor="price-max" className="text-xs text-[var(--text-secondary)] font-medium">Max Price</label>
          <input id="price-max" type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="10000"
            className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
        </div>
      </div>

      <div>
        <label htmlFor="bedrooms-input" className="text-xs text-[var(--text-secondary)] font-medium">Bedrooms</label>
        <input id="bedrooms-input" type="number" min="0" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}
          className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
      </div>

      <div>
        <label htmlFor="country-select" className="text-xs text-[var(--text-secondary)] font-medium">Country</label>
        <select id="country-select" value={country} onChange={(e) => { setCountry(e.target.value); setCity(""); }}
          className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm">
          <option value="">All Countries</option>
          {EUROPEAN_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="city-select" className="text-xs text-[var(--text-secondary)] font-medium">City</label>
        <select id="city-select" value={city} onChange={(e) => setCity(e.target.value)}
          className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm">
          <option value="">All Cities</option>
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] min-h-[44px]">
        <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)}
          className="rounded border-[var(--border)] w-5 h-5" />
        Shared Accommodation
      </label>

      <div className="flex gap-2">
        <button onClick={() => { fetchResults(); setDrawerOpen(false); }}
          className="flex-1 px-4 py-2 min-h-[44px] bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 transition-colors btn-press">
          Search
        </button>
        <button onClick={() => { clearFilters(); setDrawerOpen(false); }}
          className="px-4 py-2 min-h-[44px] border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm hover:bg-[var(--background-secondary)] transition-colors btn-press">
          Clear
        </button>
      </div>

      <button onClick={() => setShowMap(!showMap)}
        className="w-full px-4 py-2 min-h-[44px] border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm hover:bg-[var(--background-secondary)] transition-colors btn-press">
        {showMap ? "Hide Map" : "Show Map"}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">

        {/* Mobile: Filters toggle button (visible < 1024px) */}
        <div className="lg:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-full px-4 py-3 min-h-[44px] bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 transition-colors flex items-center justify-center gap-2 btn-press"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm3 6a1 1 0 011-1h10a1 1 0 010 2H7a1 1 0 01-1-1zm4 6a1 1 0 011-1h2a1 1 0 010 2h-2a1 1 0 01-1-1z" />
            </svg>
            Filters
          </button>
        </div>

        {/* Mobile: Slide-in drawer overlay (visible < 1024px) */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer panel */}
            <div className="relative w-80 max-w-[85vw] bg-[var(--background)] h-full overflow-y-auto p-4 shadow-xl z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Filters</h2>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--background-secondary)]"
                  aria-label="Close filters"
                >
                  <svg className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {filterContent}
            </div>
          </div>
        )}

        {/* Desktop: Filter Sidebar (visible >= 1024px) */}
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="glass-card">
            {filterContent}
          </div>
        </aside>

        {/* Results */}
        <main className="flex-1">
          {showMap && (
            <div className="mb-6 rounded-xl overflow-hidden border border-[var(--border)]" style={{ height: 400 }}>
              <MapView listings={displayResults?.listings || []} onBoundaryChange={handleBoundaryChange} />
            </div>
          )}

          {boundary && (
            <div className="mb-4 flex items-center gap-3">
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Area filter active</span>
              <button
                onClick={clearBoundary}
                className="text-sm px-3 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
              >
                Clear area filter
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              {loading ? "Searching..." : `${displayResults?.totalCount ?? 0} listings found`}
            </h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayResults?.listings.map((listing) => (
              <a key={listing._id} href={`/listings/${listing._id}`} className="glass-card card-hover block">
                <img
                  src={listing.photos?.[0] || placeholderImg}
                  alt={`Photo of ${listing.title}`}
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

          {displayResults && displayResults.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: Math.min(displayResults.totalPages, 5) }, (_, i) => (
                <button key={i} className={`px-3 py-1 min-h-[44px] min-w-[44px] rounded-lg text-sm ${displayResults.page === i + 1 ? "bg-navy-500 text-white" : "border border-[var(--border)] text-[var(--text-secondary)]"}`}>
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
