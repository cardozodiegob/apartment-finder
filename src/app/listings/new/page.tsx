"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createListingSchema } from "@/lib/validations/listing";

const LocationPickerMap = dynamic(() => import("@/components/listings/LocationPickerMap"), { ssr: false });

type Step = "details" | "address" | "photos" | "tags";

const EUROPEAN_COUNTRIES = [
  "Germany", "France", "Spain", "Italy", "Portugal", "Netherlands", "Belgium",
  "Austria", "Switzerland", "Sweden", "Norway", "Denmark", "Finland", "Poland",
  "Czech Republic", "Ireland", "United Kingdom", "Greece", "Romania", "Hungary",
  "Croatia", "Bulgaria",
] as const;

// Map country names to ISO country codes for Nominatim filtering
const COUNTRY_CODES: Record<string, string> = {
  Germany: "de", France: "fr", Spain: "es", Italy: "it", Portugal: "pt",
  Netherlands: "nl", Belgium: "be", Austria: "at", Switzerland: "ch",
  Sweden: "se", Norway: "no", Denmark: "dk", Finland: "fi", Poland: "pl",
  "Czech Republic": "cz", Ireland: "ie", "United Kingdom": "gb",
  Greece: "gr", Romania: "ro", Hungary: "hu", Croatia: "hr", Bulgaria: "bg",
};

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    neighbourhood?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
    state?: string;
  };
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const STEPS: Step[] = ["details", "address", "photos", "tags"];

const PROPERTY_TYPES = ["apartment", "room", "house"] as const;
const PURPOSES = ["rent", "share", "sublet"] as const;
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "BRL"] as const;

export default function NewListingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  // Address search state
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<NominatimResult[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const addressRef = useRef<HTMLDivElement>(null);

  // City search state
  const [cityQuery, setCityQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<NominatimResult[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);

  const debouncedAddressQuery = useDebounce(addressQuery, 300);
  const debouncedCityQuery = useDebounce(cityQuery, 300);

  const [form, setForm] = useState({
    title: "",
    description: "",
    propertyType: "apartment" as (typeof PROPERTY_TYPES)[number],
    purpose: "rent" as (typeof PURPOSES)[number],
    monthlyRent: 0,
    currency: "EUR" as (typeof CURRENCIES)[number],
    availableDate: "",
    isSharedAccommodation: false,
    currentOccupants: 0,
    availableRooms: 0,
    isFurnished: false,
    isPetFriendly: false,
    hasParking: false,
    hasBalcony: false,
    floorArea: 0,
    floor: 0,
    totalFloors: 0,
    street: "",
    city: "",
    neighborhood: "",
    postalCode: "",
    country: "",
    lng: 0,
    lat: 0,
    tags: "",
  });

  function updateField(field: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const stepIndex = STEPS.indexOf(step);

  function nextStep() {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  }

  function prevStep() {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1]);
  }

  // Nominatim address search
  useEffect(() => {
    if (!debouncedAddressQuery || debouncedAddressQuery.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    let cancelled = false;
    setAddressLoading(true);
    const countryCode = form.country ? COUNTRY_CODES[form.country] : "";
    const countryParam = countryCode ? `&countrycodes=${countryCode}` : "";
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedAddressQuery)}&addressdetails=1&limit=5${countryParam}&email=noreply@apartmentfinder.eu`
    )
      .then((r) => r.json())
      .then((data: NominatimResult[]) => {
        if (!cancelled) {
          setAddressSuggestions(data);
          setShowAddressSuggestions(data.length > 0);
        }
      })
      .catch(() => { if (!cancelled) setAddressSuggestions([]); })
      .finally(() => { if (!cancelled) setAddressLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedAddressQuery, form.country]);

  // Nominatim city search (filtered by country)
  useEffect(() => {
    if (!debouncedCityQuery || debouncedCityQuery.length < 2) {
      setCitySuggestions([]);
      return;
    }
    let cancelled = false;
    setCityLoading(true);
    const countryCode = form.country ? COUNTRY_CODES[form.country] : "";
    const countryParam = countryCode ? `&countrycodes=${countryCode}` : "";
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedCityQuery)}&addressdetails=1&limit=5&type=city${countryParam}&email=noreply@apartmentfinder.eu`
    )
      .then((r) => r.json())
      .then((data: NominatimResult[]) => {
        if (!cancelled) {
          setCitySuggestions(data);
          setShowCitySuggestions(data.length > 0);
        }
      })
      .catch(() => { if (!cancelled) setCitySuggestions([]); })
      .finally(() => { if (!cancelled) setCityLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedCityQuery, form.country]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addressRef.current && !addressRef.current.contains(e.target as Node)) {
        setShowAddressSuggestions(false);
      }
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setShowCitySuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectAddressSuggestion = useCallback((result: NominatimResult) => {
    const addr = result.address || {};
    const street = [addr.road, addr.house_number].filter(Boolean).join(" ");
    const city = addr.city || addr.town || addr.village || "";
    const neighborhood = addr.suburb || addr.neighbourhood || "";
    const postalCode = addr.postcode || "";
    // Find matching country name from our list
    const countryName = EUROPEAN_COUNTRIES.find(
      (c) => COUNTRY_CODES[c] === addr.country_code
    ) || addr.country || "";

    setForm((prev) => ({
      ...prev,
      street,
      city,
      neighborhood,
      postalCode,
      country: countryName,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    }));
    setCityQuery(city);
    setAddressQuery(result.display_name);
    setShowAddressSuggestions(false);
  }, []);

  const selectCitySuggestion = useCallback((result: NominatimResult) => {
    const addr = result.address || {};
    const city = addr.city || addr.town || addr.village || result.display_name.split(",")[0];
    setCityQuery(city);
    setForm((prev) => ({ ...prev, city }));
    setShowCitySuggestions(false);
  }, []);

  const handleMapLocationChange = useCallback((lat: number, lng: number) => {
    setForm((prev) => ({ ...prev, lat, lng }));

    // Reverse geocode to auto-populate address fields
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&email=noreply@apartmentfinder.eu`
    )
      .then((r) => r.json())
      .then((data: NominatimResult) => {
        if (!data.address) return;
        const addr = data.address;
        const street = [addr.road, addr.house_number].filter(Boolean).join(" ");
        const city = addr.city || addr.town || addr.village || "";
        const neighborhood = addr.suburb || addr.neighbourhood || "";
        const postalCode = addr.postcode || "";
        const countryName = EUROPEAN_COUNTRIES.find(
          (c) => COUNTRY_CODES[c] === addr.country_code
        ) || addr.country || "";

        setForm((prev) => ({
          ...prev,
          street: street || prev.street,
          city: city || prev.city,
          neighborhood: neighborhood || prev.neighborhood,
          postalCode: postalCode || prev.postalCode,
          country: countryName || prev.country,
        }));
        if (city) setCityQuery(city);
        if (data.display_name) setAddressQuery(data.display_name);
      })
      .catch(() => { /* ignore reverse geocode errors */ });
  }, []);

  async function handleSubmit() {
    setServerError("");
    setIsLoading(true);

    const data = {
      title: form.title,
      description: form.description,
      propertyType: form.propertyType,
      purpose: form.purpose,
      monthlyRent: form.monthlyRent,
      currency: form.currency,
      availableDate: form.availableDate,
      isSharedAccommodation: form.isSharedAccommodation,
      currentOccupants: form.isSharedAccommodation ? form.currentOccupants : undefined,
      availableRooms: form.isSharedAccommodation ? form.availableRooms : undefined,
      isFurnished: form.isFurnished || undefined,
      isPetFriendly: form.isPetFriendly || undefined,
      hasParking: form.hasParking || undefined,
      hasBalcony: form.hasBalcony || undefined,
      floorArea: form.floorArea > 0 ? form.floorArea : undefined,
      floor: form.floor > 0 ? form.floor : undefined,
      totalFloors: form.totalFloors > 0 ? form.totalFloors : undefined,
      address: {
        street: form.street,
        city: form.city,
        neighborhood: form.neighborhood || undefined,
        postalCode: form.postalCode,
        country: form.country,
      },
      location: { type: "Point" as const, coordinates: [form.lng, form.lat] as [number, number] },
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };

    const parsed = createListingSchema.safeParse(data);
    if (!parsed.success) {
      setServerError(parsed.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        setServerError(result.message || "Failed to create listing");
        setIsLoading(false);
        return;
      }

      // Upload photos if any
      if (photos.length > 0 && result.listing?._id) {
        const formData = new FormData();
        photos.forEach((p) => formData.append("photos", p));
        await fetch(`/api/listings/${result.listing._id}/photos`, {
          method: "POST",
          body: formData,
        });
      }

      router.push(`/listings/${result.listing._id}`);
    } catch {
      setServerError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">
          Create New Listing
        </h1>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full transition-colors ${
                i <= stepIndex ? "bg-navy-500" : "bg-[var(--border)]"
              }`}
            />
          ))}
        </div>

        {serverError && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm" role="alert">
            {serverError}
          </div>
        )}

        <div className="glass-card">
          {/* Step: Details */}
          {step === "details" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Listing Details</h2>
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Title</label>
                <input id="title" type="text" value={form.title} onChange={(e) => updateField("title", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                  placeholder="Cozy apartment in city center" />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Description</label>
                <textarea id="description" rows={4} value={form.description} onChange={(e) => updateField("description", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                  placeholder="Describe your property..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="propertyType" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Property Type</label>
                  <select id="propertyType" value={form.propertyType} onChange={(e) => updateField("propertyType", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500">
                    {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="purpose" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Purpose</label>
                  <select id="purpose" value={form.purpose} onChange={(e) => updateField("purpose", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500">
                    {PURPOSES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="monthlyRent" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Monthly Rent</label>
                  <input id="monthlyRent" type="number" min={0} value={form.monthlyRent} onChange={(e) => updateField("monthlyRent", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
                </div>
                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Currency</label>
                  <select id="currency" value={form.currency} onChange={(e) => updateField("currency", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500">
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="availableDate" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Available Date</label>
                <input id="availableDate" type="date" value={form.availableDate} onChange={(e) => updateField("availableDate", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
              </div>
              {/* Shared accommodation toggle */}
              <div className="flex items-center gap-3">
                <input id="shared" type="checkbox" checked={form.isSharedAccommodation} onChange={(e) => updateField("isSharedAccommodation", e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)] text-navy-500 focus:ring-navy-500" />
                <label htmlFor="shared" className="text-sm font-medium text-[var(--text-primary)]">Looking for roommates</label>
              </div>
              {form.isSharedAccommodation && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="currentOccupants" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Current Occupants</label>
                    <input id="currentOccupants" type="number" min={0} value={form.currentOccupants} onChange={(e) => updateField("currentOccupants", Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
                  </div>
                  <div>
                    <label htmlFor="availableRooms" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Available Rooms</label>
                    <input id="availableRooms" type="number" min={0} value={form.availableRooms} onChange={(e) => updateField("availableRooms", Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
                  </div>
                </div>
              )}

              {/* Property features */}
              <div className="border-t border-[var(--border)] pt-4 mt-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Property Features</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3">
                    <input id="isFurnished" type="checkbox" checked={form.isFurnished} onChange={(e) => updateField("isFurnished", e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border)] text-navy-500 focus:ring-navy-500" />
                    <label htmlFor="isFurnished" className="text-sm font-medium text-[var(--text-primary)]">Furnished</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input id="isPetFriendly" type="checkbox" checked={form.isPetFriendly} onChange={(e) => updateField("isPetFriendly", e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border)] text-navy-500 focus:ring-navy-500" />
                    <label htmlFor="isPetFriendly" className="text-sm font-medium text-[var(--text-primary)]">Pet Friendly</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input id="hasParking" type="checkbox" checked={form.hasParking} onChange={(e) => updateField("hasParking", e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border)] text-navy-500 focus:ring-navy-500" />
                    <label htmlFor="hasParking" className="text-sm font-medium text-[var(--text-primary)]">Parking</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input id="hasBalcony" type="checkbox" checked={form.hasBalcony} onChange={(e) => updateField("hasBalcony", e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border)] text-navy-500 focus:ring-navy-500" />
                    <label htmlFor="hasBalcony" className="text-sm font-medium text-[var(--text-primary)]">Balcony</label>
                  </div>
                </div>
              </div>

              {/* Floor details */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="floorArea" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Floor Area (m²)</label>
                  <input id="floorArea" type="number" min={0} value={form.floorArea} onChange={(e) => updateField("floorArea", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
                </div>
                <div>
                  <label htmlFor="floor" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Floor</label>
                  <input id="floor" type="number" min={0} value={form.floor} onChange={(e) => updateField("floor", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
                </div>
                <div>
                  <label htmlFor="totalFloors" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Total Floors</label>
                  <input id="totalFloors" type="number" min={0} value={form.totalFloors} onChange={(e) => updateField("totalFloors", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
                </div>
              </div>
            </div>
          )}

          {/* Step: Address */}
          {step === "address" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Address & Location</h2>

              {/* Address search autocomplete */}
              <div ref={addressRef} className="relative">
                <label htmlFor="addressSearch" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Search Address</label>
                <input
                  id="addressSearch"
                  type="text"
                  value={addressQuery}
                  onChange={(e) => { setAddressQuery(e.target.value); setShowAddressSuggestions(true); }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                  placeholder="Start typing an address…"
                  autoComplete="off"
                />
                {addressLoading && (
                  <div className="absolute right-3 top-9 text-xs text-[var(--text-muted)]">Searching…</div>
                )}
                {showAddressSuggestions && addressSuggestions.length > 0 && (
                  <ul className="absolute z-50 w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {addressSuggestions.map((s) => (
                      <li key={s.place_id}>
                        <button
                          type="button"
                          onClick={() => selectAddressSuggestion(s)}
                          className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors"
                        >
                          {s.display_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Country dropdown */}
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Country</label>
                <select
                  id="country"
                  value={form.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                >
                  <option value="">Select a country</option>
                  {EUROPEAN_COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Street */}
              <div>
                <label htmlFor="street" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Street</label>
                <input id="street" type="text" value={form.street} onChange={(e) => updateField("street", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                  placeholder="123 Main Street" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* City with autocomplete */}
                <div ref={cityRef} className="relative">
                  <label htmlFor="city" className="block text-sm font-medium text-[var(--text-primary)] mb-1">City</label>
                  <input
                    id="city"
                    type="text"
                    value={cityQuery || form.city}
                    onChange={(e) => {
                      setCityQuery(e.target.value);
                      updateField("city", e.target.value);
                      setShowCitySuggestions(true);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="Berlin"
                    autoComplete="off"
                  />
                  {cityLoading && (
                    <div className="absolute right-3 top-9 text-xs text-[var(--text-muted)]">…</div>
                  )}
                  {showCitySuggestions && citySuggestions.length > 0 && (
                    <ul className="absolute z-50 w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {citySuggestions.map((s) => (
                        <li key={s.place_id}>
                          <button
                            type="button"
                            onClick={() => selectCitySuggestion(s)}
                            className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors"
                          >
                            {s.display_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <label htmlFor="neighborhood" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Neighborhood (optional)</label>
                  <input id="neighborhood" type="text" value={form.neighborhood} onChange={(e) => updateField("neighborhood", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="Mitte" />
                </div>
              </div>

              <div>
                <label htmlFor="postalCode" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Postal Code</label>
                <input id="postalCode" type="text" value={form.postalCode} onChange={(e) => updateField("postalCode", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                  placeholder="10115" />
              </div>

              {/* Lat/Lng display (read-only, set by map or search) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Latitude</label>
                  <div className="px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--text-secondary)]">
                    {form.lat !== 0 ? form.lat.toFixed(6) : "—"}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Longitude</label>
                  <div className="px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--text-secondary)]">
                    {form.lng !== 0 ? form.lng.toFixed(6) : "—"}
                  </div>
                </div>
              </div>

              {/* Map picker */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Pin Location</label>
                <p className="text-xs text-[var(--text-muted)] mb-2">Click on the map to adjust the pin position.</p>
                <div className="rounded-xl overflow-hidden border border-[var(--border)]" style={{ height: 300 }}>
                  <LocationPickerMap lat={form.lat} lng={form.lng} onLocationChange={handleMapLocationChange} />
                </div>
              </div>
            </div>
          )}

          {/* Step: Photos */}
          {step === "photos" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Photos</h2>
              <div className="border-2 border-dashed border-[var(--border)] rounded-lg p-8 text-center">
                <input
                  id="photos"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setPhotos(Array.from(e.target.files || []))}
                  className="hidden"
                />
                <label htmlFor="photos" className="cursor-pointer">
                  <div className="text-[var(--text-muted)] mb-2">
                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0l-3 3m3-3l3 3M3 16.5V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-1.5M3 16.5l4.72-4.72a2.25 2.25 0 013.18 0l4.72 4.72M21 16.5l-2.47-2.47a2.25 2.25 0 00-3.18 0L12 17.25" />
                    </svg>
                  </div>
                  <p className="text-sm text-[var(--text-primary)]">Click to upload photos</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">JPEG, PNG, or WebP — max 5MB each</p>
                </label>
              </div>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative aspect-video rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center overflow-hidden">
                      <img src={URL.createObjectURL(p)} alt={`Preview ${i + 1}`} className="object-cover w-full h-full" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Tags */}
          {step === "tags" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Tags & Review</h2>
              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Tags (comma-separated)</label>
                <input id="tags" type="text" value={form.tags} onChange={(e) => updateField("tags", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                  placeholder="furnished, pet-friendly, balcony" />
              </div>
              <div className="glass-card mt-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Summary</h3>
                <p className="text-sm text-[var(--text-secondary)]">{form.title || "Untitled"} — {form.propertyType} for {form.purpose}</p>
                <p className="text-sm text-[var(--text-secondary)]">{form.monthlyRent} {form.currency}/month</p>
                <p className="text-sm text-[var(--text-secondary)]">{form.city}, {form.country}</p>
                {form.isSharedAccommodation && (
                  <p className="text-sm text-[var(--text-muted)]">Shared: {form.currentOccupants} occupants, {form.availableRooms} rooms available</p>
                )}
                <p className="text-sm text-[var(--text-muted)]">{photos.length} photo(s)</p>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={prevStep}
              disabled={stepIndex === 0}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Back
            </button>
            {stepIndex < STEPS.length - 1 ? (
              <button type="button" onClick={nextStep}
                className="px-6 py-2 rounded-lg bg-navy-600 hover:bg-navy-700 text-white font-medium transition-colors">
                Next
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={isLoading}
                className="px-6 py-2 rounded-lg bg-navy-600 hover:bg-navy-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {isLoading ? "Creating…" : "Create Listing"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
