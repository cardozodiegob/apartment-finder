/**
 * Geography service — single source of truth for country + city data.
 *
 * Responsibilities:
 * - Expose the canonical European country list and their ISO codes
 * - Provide a Nominatim-backed city autocomplete scoped by country
 * - Cache successful country → cities lookups in sessionStorage for 24h
 *
 * All Nominatim requests include an `email` param per their usage policy.
 */

export const EUROPEAN_COUNTRIES = [
  "Germany", "France", "Spain", "Italy", "Portugal", "Netherlands", "Belgium",
  "Austria", "Switzerland", "Sweden", "Norway", "Denmark", "Finland", "Poland",
  "Czech Republic", "Ireland", "United Kingdom", "Greece", "Romania", "Hungary",
  "Croatia", "Bulgaria",
] as const;

export type EuropeanCountry = (typeof EUROPEAN_COUNTRIES)[number];

export const COUNTRY_CODES: Record<string, string> = {
  Germany: "de", France: "fr", Spain: "es", Italy: "it", Portugal: "pt",
  Netherlands: "nl", Belgium: "be", Austria: "at", Switzerland: "ch",
  Sweden: "se", Norway: "no", Denmark: "dk", Finland: "fi", Poland: "pl",
  "Czech Republic": "cz", Ireland: "ie", "United Kingdom": "gb",
  Greece: "gr", Romania: "ro", Hungary: "hu", Croatia: "hr", Bulgaria: "bg",
};

export interface NominatimCity {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    country?: string;
    country_code?: string;
    state?: string;
  };
}

const CACHE_KEY_PREFIX = "geo:cities:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_EMAIL = "noreply@apartmentfinder.eu";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

function cacheGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expiresAt) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

function cacheSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    window.sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* quota exceeded or disabled — safe to ignore */
  }
}

/**
 * Extract a display-name friendly city string from a Nominatim result.
 */
export function extractCityName(result: NominatimCity): string {
  const addr = result.address ?? {};
  return addr.city || addr.town || addr.village || result.display_name.split(",")[0];
}

/**
 * Autocomplete cities given a query string, scoped to a country when provided.
 * Returns Nominatim rows with `type=city` bias. Results are cached per
 * (country, queryLower) for the session.
 */
export async function autocompleteCity(
  query: string,
  country?: string,
  signal?: AbortSignal,
): Promise<NominatimCity[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const countryCode = country ? COUNTRY_CODES[country] : undefined;
  const cacheKey = `${CACHE_KEY_PREFIX}${countryCode ?? "all"}:${trimmed.toLowerCase()}`;
  const cached = cacheGet<NominatimCity[]>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    format: "json",
    q: trimmed,
    addressdetails: "1",
    limit: "5",
    type: "city",
    email: NOMINATIM_EMAIL,
  });
  if (countryCode) params.set("countrycodes", countryCode);

  const res = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as NominatimCity[];
  const cities = Array.isArray(data) ? data : [];
  cacheSet(cacheKey, cities);
  return cities;
}

/**
 * Convenience wrapper — fetch a shortlist of representative cities for a country.
 * Used for country → city dropdown bootstrapping.
 */
export async function citiesForCountry(country: string): Promise<string[]> {
  if (!COUNTRY_CODES[country]) return [];
  const results = await autocompleteCity("", country);
  const names = new Set<string>();
  for (const r of results) {
    const name = extractCityName(r);
    if (name) names.add(name);
  }
  return Array.from(names);
}
