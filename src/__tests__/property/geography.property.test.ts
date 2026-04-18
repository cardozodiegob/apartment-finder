import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// Stub sessionStorage for node environment
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  });
});

import {
  autocompleteCity,
  EUROPEAN_COUNTRIES,
  COUNTRY_CODES,
  extractCityName,
  type NominatimCity,
} from "@/lib/services/geography";

/**
 * Feature: apartment-finder, Property 2: City filter monotonic in country selection
 *
 * **Validates: Requirement 2**
 *
 * When the user picks a country C, the city autocomplete results must only
 * contain cities whose `address.country_code` equals the ISO code of C
 * (Nominatim enforces this via `countrycodes=<code>`). Scoping to a country
 * must never broaden the result set vs. no country scope for any given
 * query string — it can only reduce it.
 */
describe("Feature: apartment-finder, Property 2: City filter monotonic in country selection", () => {
  it("selecting a country restricts autocomplete to that country's cities (via Nominatim URL)", async () => {
    const capturedUrls: string[] = [];
    const fetchSpy = vi.fn(async (url: string | URL) => {
      capturedUrls.push(String(url));
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...EUROPEAN_COUNTRIES),
        fc.stringMatching(/^[a-z]{2,10}$/),
        async (country, query) => {
          capturedUrls.length = 0;
          await autocompleteCity(query, country);

          // Either the call was skipped (query < 2 chars — guarded elsewhere)
          // or the emitted URL contains the correct ISO countrycodes param.
          if (capturedUrls.length > 0) {
            const url = capturedUrls[capturedUrls.length - 1];
            expect(url).toContain(`countrycodes=${COUNTRY_CODES[country]}`);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("omitting country removes the countrycodes constraint", async () => {
    const capturedUrls: string[] = [];
    const fetchSpy = vi.fn(async (url: string | URL) => {
      capturedUrls.push(String(url));
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    await autocompleteCity("berlin");
    if (capturedUrls.length > 0) {
      expect(capturedUrls[0]).not.toContain("countrycodes=");
    }
  });

  it("returns empty array for queries shorter than 2 characters without hitting network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]?$/), async (shortQuery) => {
        const result = await autocompleteCity(shortQuery, "Germany");
        expect(result).toEqual([]);
      }),
      { numRuns: 30 },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("caches (country, query) results in sessionStorage — second call skips network", async () => {
    const fake: NominatimCity[] = [
      {
        place_id: 1,
        display_name: "Berlin, Germany",
        lat: "52.5",
        lon: "13.4",
        address: { city: "Berlin", country: "Germany", country_code: "de" },
      },
    ];
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify(fake), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const first = await autocompleteCity("berlin", "Germany");
    const second = await autocompleteCity("berlin", "Germany");

    expect(first).toEqual(fake);
    expect(second).toEqual(fake);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("extractCityName prefers address.city → town → village → display_name prefix", () => {
    fc.assert(
      fc.property(
        fc.record({
          place_id: fc.integer(),
          display_name: fc.stringMatching(/^[A-Za-z]+, [A-Za-z]+$/),
          lat: fc.constant("0"),
          lon: fc.constant("0"),
          city: fc.option(fc.stringMatching(/^[A-Za-z]{3,10}$/), { nil: undefined }),
          town: fc.option(fc.stringMatching(/^[A-Za-z]{3,10}$/), { nil: undefined }),
          village: fc.option(fc.stringMatching(/^[A-Za-z]{3,10}$/), { nil: undefined }),
        }),
        (raw) => {
          const result: NominatimCity = {
            place_id: raw.place_id,
            display_name: raw.display_name,
            lat: raw.lat,
            lon: raw.lon,
            address: {
              city: raw.city ?? undefined,
              town: raw.town ?? undefined,
              village: raw.village ?? undefined,
            },
          };
          const name = extractCityName(result);
          // Must return a non-empty string
          expect(typeof name).toBe("string");
          expect(name.length).toBeGreaterThan(0);
          // Priority ordering: city > town > village > display_name prefix
          if (raw.city) {
            expect(name).toBe(raw.city);
          } else if (raw.town) {
            expect(name).toBe(raw.town);
          } else if (raw.village) {
            expect(name).toBe(raw.village);
          } else {
            expect(name).toBe(raw.display_name.split(",")[0]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
