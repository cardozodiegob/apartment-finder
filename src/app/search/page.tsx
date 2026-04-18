"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { SkeletonCard } from "@/components/ui/Skeleton";
import CompareButton from "@/components/compare/CompareButton";
import CompareBar from "@/components/compare/CompareBar";
import {
  EUROPEAN_COUNTRIES,
  autocompleteCity,
  extractCityName,
  type NominatimCity,
} from "@/lib/services/geography";
import { firstPhotoUrl, type PhotoValue } from "@/lib/listings/photoUrl";
import EnergyRatingBadge from "@/components/listings/EnergyRatingBadge";
import type { EnergyRating } from "@/lib/db/models/Listing";
import HorizontalListingStrip from "@/components/search/HorizontalListingStrip";
import { getRecentlyViewedIds } from "@/lib/listings/recentlyViewed";

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
  photos: PhotoValue[];
  tags: string[];
  isSharedAccommodation: boolean;
  address: { street: string; city: string; neighborhood?: string; postalCode: string; country: string };
  location: { type: string; coordinates: [number, number] };
  priceHistory?: { price: number; currency: string; changedAt: string }[];
  energyRating?: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  floorArea?: number;
}

interface SearchResult {
  listings: Listing[];
  totalCount: number;
  page: number;
  totalPages: number;
}

interface SavedSearchItem {
  _id: string;
  name: string;
  filters: Record<string, unknown>;
}

const PROPERTY_TYPES = ["apartment", "room", "house"] as const;
const PURPOSES = ["rent", "share", "sublet"] as const;

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
  const [bathrooms, setBathrooms] = useState(searchParams.get("bathrooms") || "");
  const [availableRooms, setAvailableRooms] = useState(searchParams.get("availableRooms") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [country, setCountry] = useState(searchParams.get("country") || "");
  const [isShared, setIsShared] = useState(searchParams.get("isSharedAccommodation") === "true");
  const [isFurnished, setIsFurnished] = useState<"" | "true" | "false">(
    (searchParams.get("isFurnished") as "" | "true" | "false") ?? "",
  );
  const [isPetFriendly, setIsPetFriendly] = useState(searchParams.get("isPetFriendly") === "true");
  const [hasParking, setHasParking] = useState(searchParams.get("hasParking") === "true");
  const [hasBalcony, setHasBalcony] = useState(searchParams.get("hasBalcony") === "true");
  const [minArea, setMinArea] = useState(searchParams.get("minArea") || "");
  const [maxArea, setMaxArea] = useState(searchParams.get("maxArea") || "");
  const [minEnergyRating, setMinEnergyRating] = useState(searchParams.get("minEnergyRating") || "");
  const [verifiedOnly, setVerifiedOnly] = useState(searchParams.get("verifiedOnly") === "true");
  const [sort, setSort] = useState(searchParams.get("sort") || "");
  const [limit, setLimit] = useState(searchParams.get("limit") || "20");
  const [showMap, setShowMap] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map" | "split">("list");

  // Hydrate preferred view mode from sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem("search:viewMode") as "list" | "map" | "split" | null;
    if (stored === "list" || stored === "map" || stored === "split") {
      setViewMode(stored);
      return;
    }
    // Default to split on wide screens
    if (window.matchMedia?.("(min-width: 1280px)").matches) {
      setViewMode("split");
    }
  }, []);

  // Recently viewed + trending strips
  const [recentlyViewed, setRecentlyViewed] = useState<Listing[]>([]);
  const [trending, setTrending] = useState<Listing[]>([]);

  useEffect(() => {
    const ids = getRecentlyViewedIds().slice(0, 8);
    if (ids.length > 0) {
      fetch(`/api/listings/batch?ids=${ids.join(",")}`)
        .then((r) => r.ok ? r.json() : { listings: [] })
        .then((d) => setRecentlyViewed(d.listings ?? []))
        .catch(() => setRecentlyViewed([]));
    }
    fetch("/api/listings/trending")
      .then((r) => r.ok ? r.json() : { listings: [] })
      .then((d) => setTrending(d.listings ?? []))
      .catch(() => setTrending([]));
  }, []);

  const updateViewMode = useCallback((next: "list" | "map" | "split") => {
    setViewMode(next);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("search:viewMode", next);
    }
    setShowMap(next !== "list");
  }, []);
  const [boundary, setBoundary] = useState<number[][][] | null>(null);
  const [boundaryResults, setBoundaryResults] = useState<SearchResult | null>(null);

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [saveEmailAlerts, setSaveEmailAlerts] = useState(false);

  // City autocomplete
  const [cityQuery, setCityQuery] = useState(searchParams.get("city") || "");
  const [citySuggestions, setCitySuggestions] = useState<NominatimCity[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);

  // Debounced city lookup scoped to the currently-selected country
  useEffect(() => {
    if (cityQuery.trim().length < 2) {
      setCitySuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setCityLoading(true);
      try {
        const results = await autocompleteCity(cityQuery, country || undefined, ctrl.signal);
        setCitySuggestions(results);
        setShowCitySuggestions(results.length > 0);
      } catch {
        /* ignore abort */
      } finally {
        setCityLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [cityQuery, country]);

  // Escape closes the mobile filter drawer
  useEffect(() => {
    if (!drawerOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [drawerOpen]);

  // Close city suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setShowCitySuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (propertyType) params.set("propertyType", propertyType);
    if (purpose) params.set("purpose", purpose);
    if (priceMin) params.set("priceMin", priceMin);
    if (priceMax) params.set("priceMax", priceMax);
    if (bedrooms) params.set("bedrooms", bedrooms);
    if (bathrooms) params.set("bathrooms", bathrooms);
    if (availableRooms) params.set("availableRooms", availableRooms);
    if (city) params.set("city", city);
    if (country) params.set("country", country);
    if (isShared) params.set("isSharedAccommodation", "true");
    if (isFurnished === "true") params.set("isFurnished", "true");
    else if (isFurnished === "false") params.set("isFurnished", "false");
    if (isPetFriendly) params.set("isPetFriendly", "true");
    if (hasParking) params.set("hasParking", "true");
    if (hasBalcony) params.set("hasBalcony", "true");
    if (minArea) params.set("minArea", minArea);
    if (maxArea) params.set("maxArea", maxArea);
    if (minEnergyRating) params.set("minEnergyRating", minEnergyRating);
    if (verifiedOnly) params.set("verifiedOnly", "true");
    if (sort) params.set("sort", sort);
    if (limit && limit !== "20") params.set("limit", limit);
    return params.toString();
  }, [query, propertyType, purpose, priceMin, priceMax, bedrooms, bathrooms, availableRooms, city, country, isShared, isFurnished, isPetFriendly, hasParking, hasBalcony, minArea, maxArea, minEnergyRating, verifiedOnly, sort, limit]);

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

  // Fetch saved searches
  const fetchSavedSearches = useCallback(async () => {
    try {
      const res = await fetch("/api/saved-searches");
      if (res.ok) {
        const data = await res.json();
        setSavedSearches(data.savedSearches || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSavedSearches(); }, [fetchSavedSearches]);

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) return;
    const filters: Record<string, unknown> = {};
    if (query) filters.query = query;
    if (propertyType) filters.propertyType = propertyType;
    if (purpose) filters.purpose = purpose;
    if (priceMin) filters.priceMin = priceMin;
    if (priceMax) filters.priceMax = priceMax;
    if (bedrooms) filters.bedrooms = bedrooms;
    if (bathrooms) filters.bathrooms = bathrooms;
    if (availableRooms) filters.availableRooms = availableRooms;
    if (city) filters.city = city;
    if (country) filters.country = country;
    if (isShared) filters.isSharedAccommodation = true;
    if (isFurnished === "true") filters.isFurnished = true;
    else if (isFurnished === "false") filters.isFurnished = false;
    if (isPetFriendly) filters.isPetFriendly = true;
    if (hasParking) filters.hasParking = true;
    if (hasBalcony) filters.hasBalcony = true;
    if (minArea) filters.minArea = minArea;
    if (maxArea) filters.maxArea = maxArea;
    if (minEnergyRating) filters.minEnergyRating = minEnergyRating;
    if (verifiedOnly) filters.verifiedOnly = true;
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveSearchName.trim(), filters, emailAlertsEnabled: saveEmailAlerts }),
      });
      if (res.ok) {
        setSaveSearchName("");
        setSaveEmailAlerts(false);
        setShowSaveModal(false);
        fetchSavedSearches();
      }
    } catch { /* ignore */ }
  };

  const applySavedSearch = (filters: Record<string, unknown>) => {
    setQuery((filters.query as string) || "");
    setPropertyType((filters.propertyType as string) || "");
    setPurpose((filters.purpose as string) || "");
    setPriceMin((filters.priceMin as string) || "");
    setPriceMax((filters.priceMax as string) || "");
    setBedrooms((filters.bedrooms as string) || "");
    setBathrooms((filters.bathrooms as string) || "");
    setAvailableRooms((filters.availableRooms as string) || "");
    setCity((filters.city as string) || "");
    setCountry((filters.country as string) || "");
    setIsShared(!!filters.isSharedAccommodation);
    setIsFurnished(filters.isFurnished === true ? "true" : filters.isFurnished === false ? "false" : "");
    setIsPetFriendly(!!filters.isPetFriendly);
    setHasParking(!!filters.hasParking);
    setHasBalcony(!!filters.hasBalcony);
    setMinArea((filters.minArea as string) || "");
    setMaxArea((filters.maxArea as string) || "");
    setMinEnergyRating((filters.minEnergyRating as string) || "");
    setVerifiedOnly(!!filters.verifiedOnly);
  };

  const deleteSavedSearch = async (id: string) => {
    try {
      await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
      fetchSavedSearches();
    } catch { /* ignore */ }
  };

  const clearFilters = () => {
    setQuery(""); setPropertyType(""); setPurpose("");
    setPriceMin(""); setPriceMax(""); setBedrooms("");
    setBathrooms(""); setAvailableRooms("");
    setCity(""); setCountry(""); setCityQuery(""); setIsShared(false);
    setIsFurnished(""); setIsPetFriendly(false);
    setHasParking(false); setHasBalcony(false);
    setMinArea(""); setMaxArea("");
    setMinEnergyRating(""); setVerifiedOnly(false);
    setSort(""); setLimit("20");
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
        <label htmlFor="bedrooms-input" className="text-xs text-[var(--text-secondary)] font-medium">Min Bedrooms</label>
        <input id="bedrooms-input" type="number" min="0" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}
          className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
      </div>

      <div>
        <label htmlFor="bathrooms-input" className="text-xs text-[var(--text-secondary)] font-medium">Min Bathrooms</label>
        <input id="bathrooms-input" type="number" min="0" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)}
          className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
      </div>

      <div>
        <label htmlFor="country-select" className="text-xs text-[var(--text-secondary)] font-medium">Country</label>
        <select id="country-select" value={country} onChange={(e) => { setCountry(e.target.value); setCity(""); setCityQuery(""); setCitySuggestions([]); }}
          className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm">
          <option value="">All Countries</option>
          {EUROPEAN_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div ref={cityRef} className="relative">
        <label htmlFor="city-input" className="text-xs text-[var(--text-secondary)] font-medium">City</label>
        <input
          id="city-input"
          type="text"
          value={cityQuery}
          onChange={(e) => { setCityQuery(e.target.value); setCity(e.target.value); setShowCitySuggestions(true); }}
          onFocus={() => setShowCitySuggestions(citySuggestions.length > 0)}
          placeholder={country ? `Cities in ${country}` : "Any city"}
          autoComplete="off"
          className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
        />
        {cityLoading && (
          <div className="absolute right-3 top-[34px] text-xs text-[var(--text-muted)]">…</div>
        )}
        {showCitySuggestions && citySuggestions.length > 0 && (
          <ul className="absolute z-50 w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {citySuggestions.map((s) => {
              const name = extractCityName(s);
              return (
                <li key={s.place_id}>
                  <button
                    type="button"
                    onClick={() => { setCity(name); setCityQuery(name); setShowCitySuggestions(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)]"
                  >
                    {name}
                    {s.address?.country ? <span className="text-xs text-[var(--text-muted)]"> — {s.address.country}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] min-h-[44px]">
        <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)}
          className="rounded border-[var(--border)] w-5 h-5" />
        Shared Accommodation
      </label>

      {isShared && (
        <div>
          <label htmlFor="available-rooms-input" className="text-xs text-[var(--text-secondary)] font-medium">Rooms available</label>
          <input id="available-rooms-input" type="number" min="0" value={availableRooms} onChange={(e) => setAvailableRooms(e.target.value)}
            className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
        </div>
      )}

      <div>
        <span className="text-xs text-[var(--text-secondary)] font-medium block mb-1">Furnished</span>
        <div role="radiogroup" aria-label="Furnished" className="flex gap-1 rounded-lg border border-[var(--border)] p-0.5">
          {([
            { v: "", label: "Any" },
            { v: "true", label: "Yes" },
            { v: "false", label: "No" },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              type="button"
              role="radio"
              aria-checked={isFurnished === opt.v}
              onClick={() => setIsFurnished(opt.v)}
              className={`flex-1 px-2 py-1.5 text-sm rounded-md transition-colors ${isFurnished === opt.v ? "bg-navy-500 text-white" : "text-[var(--text-secondary)] hover:bg-[var(--background-secondary)]"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] min-h-[44px]">
        <input type="checkbox" checked={isPetFriendly} onChange={(e) => setIsPetFriendly(e.target.checked)}
          className="rounded border-[var(--border)] w-5 h-5" />
        Pet Friendly
      </label>

      <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] min-h-[44px]">
        <input type="checkbox" checked={hasParking} onChange={(e) => setHasParking(e.target.checked)}
          className="rounded border-[var(--border)] w-5 h-5" />
        Parking
      </label>

      <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] min-h-[44px]">
        <input type="checkbox" checked={hasBalcony} onChange={(e) => setHasBalcony(e.target.checked)}
          className="rounded border-[var(--border)] w-5 h-5" />
        Balcony
      </label>

      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor="min-area" className="text-xs text-[var(--text-secondary)] font-medium">Min Area (m²)</label>
          <input id="min-area" type="number" value={minArea} onChange={(e) => setMinArea(e.target.value)} placeholder="0" min="0"
            className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
        </div>
        <div className="flex-1">
          <label htmlFor="max-area" className="text-xs text-[var(--text-secondary)] font-medium">Max Area (m²)</label>
          <input id="max-area" type="number" value={maxArea} onChange={(e) => setMaxArea(e.target.value)} placeholder="500" min="0"
            className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
        </div>
      </div>

      <div>
        <label htmlFor="min-energy-rating" className="text-xs text-[var(--text-secondary)] font-medium">Min Energy Rating</label>
        <select id="min-energy-rating" value={minEnergyRating} onChange={(e) => setMinEnergyRating(e.target.value)}
          className="w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm">
          <option value="">Any</option>
          {["A", "B", "C", "D", "E", "F", "G"].map((r) => <option key={r} value={r}>{r} or better</option>)}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] min-h-[44px]">
        <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)}
          className="rounded border-[var(--border)] w-5 h-5" />
        Verified listings only
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

      <button onClick={() => setShowSaveModal(true)}
        className="w-full px-4 py-2 min-h-[44px] border border-navy-500 text-navy-500 rounded-lg text-sm hover:bg-navy-50 dark:hover:bg-navy-900/20 transition-colors btn-press">
        Save Search
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
          {/* Recently viewed + trending strips (only on the initial state, without active filters) */}
          {recentlyViewed.length > 0 && (
            <HorizontalListingStrip title="Recently viewed" listings={recentlyViewed} />
          )}
          {trending.length > 0 && (
            <HorizontalListingStrip title="Trending now" listings={trending} />
          )}

          {/* Saved Searches */}
          {savedSearches.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-[var(--text-secondary)] font-medium mb-2">Saved Searches</p>
              <div className="flex flex-wrap gap-2">
                {savedSearches.map((ss) => (
                  <div key={ss._id} className="flex items-center gap-1 px-3 py-1 rounded-full bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-200 text-sm">
                    <button
                      onClick={() => { applySavedSearch(ss.filters); setTimeout(fetchResults, 0); }}
                      className="hover:underline"
                    >
                      {ss.name}
                    </button>
                    <button
                      onClick={() => deleteSavedSearch(ss._id)}
                      className="ml-1 text-navy-400 hover:text-red-500 text-xs"
                      aria-label={`Delete saved search ${ss.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save Search Modal */}
          {showSaveModal && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="save-search-title"
              onKeyDown={(e) => { if (e.key === "Escape") setShowSaveModal(false); }}
              className="fixed inset-0 z-50 flex items-center justify-center"
            >
              <div className="fixed inset-0 bg-black/40" onClick={() => setShowSaveModal(false)} aria-hidden="true" />
              <div className="relative glass-card w-full max-w-sm z-10">
                <h3 id="save-search-title" className="text-lg font-semibold text-[var(--text-primary)] mb-4">Save Search</h3>
                <input
                  type="text"
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  placeholder="Name your search..."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm mb-4"
                  autoFocus
                />
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveEmailAlerts}
                    onChange={(e) => setSaveEmailAlerts(e.target.checked)}
                    className="rounded border-[var(--border)] w-4 h-4"
                  />
                  Email me when new listings match
                </label>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm btn-press"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSearch}
                    disabled={!saveSearchName.trim()}
                    className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 disabled:opacity-50 btn-press"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
          {showMap && (
            <div className={`mb-6 rounded-xl overflow-hidden border border-[var(--border)] ${viewMode === "split" ? "xl:sticky xl:top-20" : ""}`} style={{ height: viewMode === "split" ? 500 : 400 }}>
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

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              {loading ? "Searching..." : `${displayResults?.totalCount ?? 0} listings found`}
            </h1>
            <div className="flex items-center gap-2">
              <div role="radiogroup" aria-label="View mode" className="flex rounded-lg border border-[var(--border)] p-0.5">
                {(["list", "split", "map"] as const).map((v) => (
                  <button
                    key={v}
                    role="radio"
                    aria-checked={viewMode === v}
                    onClick={() => updateViewMode(v)}
                    className={`px-2 py-1 text-xs rounded-md ${viewMode === v ? "bg-navy-500 text-white" : "text-[var(--text-secondary)] hover:bg-[var(--background-secondary)]"}`}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>

              <label className="text-xs text-[var(--text-muted)]" htmlFor="sort-select">Sort</label>
              <select
                id="sort-select"
                value={sort}
                onChange={(e) => { setSort(e.target.value); setTimeout(fetchResults, 0); }}
                className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs"
              >
                <option value="">Newest</option>
                <option value="price_asc">Price: low → high</option>
                <option value="price_desc">Price: high → low</option>
                <option value="available_soonest">Available soonest</option>
                <option value="relevance">Relevance</option>
              </select>

              <label className="text-xs text-[var(--text-muted)]" htmlFor="limit-select">Per page</label>
              <select
                id="limit-select"
                value={limit}
                onChange={(e) => { setLimit(e.target.value); setTimeout(fetchResults, 0); }}
                className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          {/* Active filter chips */}
          {(() => {
            const chips: Array<{ label: string; clear: () => void }> = [];
            if (query) chips.push({ label: `"${query}"`, clear: () => { setQuery(""); setTimeout(fetchResults, 0); } });
            if (propertyType) chips.push({ label: propertyType, clear: () => { setPropertyType(""); setTimeout(fetchResults, 0); } });
            if (purpose) chips.push({ label: purpose, clear: () => { setPurpose(""); setTimeout(fetchResults, 0); } });
            if (priceMin || priceMax) chips.push({ label: `Price ${priceMin || "0"}–${priceMax || "∞"}`, clear: () => { setPriceMin(""); setPriceMax(""); setTimeout(fetchResults, 0); } });
            if (bedrooms) chips.push({ label: `${bedrooms}+ bedrooms`, clear: () => { setBedrooms(""); setTimeout(fetchResults, 0); } });
            if (bathrooms) chips.push({ label: `${bathrooms}+ bathrooms`, clear: () => { setBathrooms(""); setTimeout(fetchResults, 0); } });
            if (city) chips.push({ label: city, clear: () => { setCity(""); setCityQuery(""); setTimeout(fetchResults, 0); } });
            if (country) chips.push({ label: country, clear: () => { setCountry(""); setTimeout(fetchResults, 0); } });
            if (isShared) chips.push({ label: "Shared", clear: () => { setIsShared(false); setTimeout(fetchResults, 0); } });
            if (isFurnished === "true") chips.push({ label: "Furnished", clear: () => { setIsFurnished(""); setTimeout(fetchResults, 0); } });
            if (isFurnished === "false") chips.push({ label: "Unfurnished", clear: () => { setIsFurnished(""); setTimeout(fetchResults, 0); } });
            if (isPetFriendly) chips.push({ label: "Pet friendly", clear: () => { setIsPetFriendly(false); setTimeout(fetchResults, 0); } });
            if (hasParking) chips.push({ label: "Parking", clear: () => { setHasParking(false); setTimeout(fetchResults, 0); } });
            if (hasBalcony) chips.push({ label: "Balcony", clear: () => { setHasBalcony(false); setTimeout(fetchResults, 0); } });
            if (minEnergyRating) chips.push({ label: `Energy ${minEnergyRating}+`, clear: () => { setMinEnergyRating(""); setTimeout(fetchResults, 0); } });
            if (verifiedOnly) chips.push({ label: "Verified only", clear: () => { setVerifiedOnly(false); setTimeout(fetchResults, 0); } });
            if (chips.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {chips.map((c) => (
                  <button
                    key={c.label}
                    onClick={c.clear}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-navy-100 dark:bg-navy-900/30 text-navy-700 dark:text-navy-200 text-xs hover:bg-navy-200 dark:hover:bg-navy-900/50 transition-colors"
                  >
                    {c.label}
                    <span aria-hidden="true">×</span>
                    <span className="sr-only">Remove filter</span>
                  </button>
                ))}
              </div>
            );
          })()}

          {!loading && displayResults && displayResults.totalCount === 0 && (
            <div className="glass-card text-center py-8 mb-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2">No listings match your filters</h2>
              <p className="text-sm text-[var(--text-muted)] mb-4">Try one of these to get more results:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {(priceMin || priceMax) && (
                  <button
                    type="button"
                    onClick={() => { setPriceMin(""); setPriceMax(""); setTimeout(fetchResults, 0); }}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)]"
                  >
                    Clear price range
                  </button>
                )}
                {city && (
                  <button
                    type="button"
                    onClick={() => { setCity(""); setCityQuery(""); setTimeout(fetchResults, 0); }}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)]"
                  >
                    Drop city filter
                  </button>
                )}
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(""); setTimeout(fetchResults, 0); }}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)]"
                  >
                    Clear keyword
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-3 py-1.5 rounded-lg bg-navy-500 text-white text-sm font-medium hover:bg-navy-600"
                >
                  Reset all filters
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              displayResults?.listings.map((listing) => (
              <a key={listing._id} href={`/listings/${listing._id}`} className="glass-card card-hover block">
                <img
                  src={firstPhotoUrl(listing.photos) || placeholderImg}
                  alt={`Photo of ${listing.title}`}
                  className="w-full h-40 object-cover rounded-lg mb-3"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).src = placeholderImg; }}
                />
                <h3 className="font-semibold text-[var(--text-primary)] truncate">{listing.title}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{listing.address.city}, {listing.address.country}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex flex-col">
                    <span className="text-lg font-bold text-navy-500">{listing.currency} {listing.monthlyRent}/mo</span>
                    {listing.floorArea && listing.floorArea > 0 && (
                      <span className="text-xs text-[var(--text-muted)]">
                        {listing.currency} {Math.round(listing.monthlyRent / listing.floorArea)}/m²
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {listing.energyRating && (
                      <EnergyRatingBadge rating={listing.energyRating as EnergyRating} size="sm" />
                    )}
                    <span className="text-xs px-2 py-1 rounded-full bg-navy-100 text-navy-700 dark:bg-navy-800 dark:text-navy-200">
                      {listing.propertyType}
                    </span>
                  </div>
                </div>
                {listing.priceHistory && listing.priceHistory.length > 0 && (() => {
                  const last = listing.priceHistory![listing.priceHistory!.length - 1];
                  if (last.price !== listing.monthlyRent) {
                    const reduced = listing.monthlyRent < last.price;
                    return (
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          reduced
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        }`}>
                          {reduced ? "↓ Price reduced" : "↑ Price increased"}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] line-through">
                          {last.currency} {last.price.toLocaleString()}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
                {listing.isSharedAccommodation && (
                  <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                    Shared
                  </span>
                )}
                <div className="mt-2">
                  <CompareButton listingId={listing._id} />
                </div>
              </a>
            ))
            )}
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
      <CompareBar />
    </div>
  );
}
