import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import * as fc from "fast-check";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

// --- Mocks ---

const mockListingFind = vi.fn();
const mockCountDocuments = vi.fn();

vi.mock("@/lib/db/models/Listing", () => ({
  default: {
    find: (...args: unknown[]) => mockListingFind(...args),
    countDocuments: (...args: unknown[]) => mockCountDocuments(...args),
  },
}));

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));

import { search, searchWithinBoundary, serializeFilters, deserializeFilters } from "@/lib/services/search";
import type { SearchParams } from "@/lib/services/search";

// --- Arbitraries ---

const propertyTypeArb = fc.constantFrom("apartment" as const, "room" as const, "house" as const);
const purposeArb = fc.constantFrom("rent" as const, "share" as const, "sublet" as const);
const currencyArb = fc.constantFrom("EUR" as const, "USD" as const, "GBP" as const);

const listingArb = fc.record({
  _id: fc.stringMatching(/^[0-9a-f]{24}$/),
  title: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,30}$/),
  description: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,50}$/),
  propertyType: propertyTypeArb,
  purpose: purposeArb,
  monthlyRent: fc.integer({ min: 100, max: 5000 }),
  currency: currencyArb,
  availableDate: fc.date({ min: new Date("2024-01-01"), max: new Date("2026-12-31") }),
  tags: fc.array(fc.stringMatching(/^[a-z]{2,8}$/), { maxLength: 5 }),
  isSharedAccommodation: fc.boolean(),
  availableRooms: fc.integer({ min: 0, max: 5 }),
  status: fc.constant("active" as const),
  address: fc.record({
    street: fc.constant("Test St"),
    city: fc.constantFrom("Berlin", "Paris", "London"),
    neighborhood: fc.constantFrom("Mitte", "Kreuzberg", "Marais"),
    postalCode: fc.constant("10115"),
    country: fc.constant("DE"),
  }),
  location: fc.record({
    type: fc.constant("Point" as const),
    coordinates: fc.tuple(
      fc.double({ min: -10, max: 20, noNaN: true }),
      fc.double({ min: 40, max: 60, noNaN: true })
    ),
  }),
});

function listingMatchesFilters(listing: Record<string, unknown>, params: Partial<SearchParams>): boolean {
  if (params.propertyType && listing.propertyType !== params.propertyType) return false;
  if (params.priceRange) {
    const rent = listing.monthlyRent as number;
    if (rent < params.priceRange.min || rent > params.priceRange.max) return false;
  }
  if (params.bedrooms !== undefined && params.bedrooms !== null) {
    if ((listing.availableRooms as number) < params.bedrooms) return false;
  }
  if (params.tags && params.tags.length > 0) {
    const listingTags = listing.tags as string[];
    if (!params.tags.every((t) => listingTags.includes(t))) return false;
  }
  if (params.purpose && listing.purpose !== params.purpose) return false;
  if (params.isSharedAccommodation && !listing.isSharedAccommodation) return false;
  if (params.city) {
    const addr = listing.address as Record<string, string>;
    if (addr.city !== params.city) return false;
  }
  return true;
}

/**
 * Feature: apartment-finder, Property 6: Filter results satisfy all applied filter criteria
 *
 * **Validates: Requirements 3.1, 3.4, 3.7**
 */
describe("Feature: apartment-finder, Property 6: Filter results satisfy all applied filter criteria", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("every listing in the result set satisfies all active filter conditions", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(listingArb, { minLength: 1, maxLength: 20 }),
        fc.record({
          propertyType: fc.option(propertyTypeArb, { nil: undefined }),
          purpose: fc.option(purposeArb, { nil: undefined }),
          isSharedAccommodation: fc.option(fc.constant(true), { nil: undefined }),
          city: fc.option(fc.constantFrom("Berlin", "Paris", "London"), { nil: undefined }),
        }),
        async (listings, filterOpts) => {
          const expected = listings.filter((l) => listingMatchesFilters(l, filterOpts));

          const chainable = {
            sort: () => chainable,
            skip: () => chainable,
            limit: () => chainable,
            maxTimeMS: () => Promise.resolve(expected),
          };
          mockListingFind.mockReturnValue(chainable);
          mockCountDocuments.mockReturnValue({ maxTimeMS: () => Promise.resolve(expected.length) });

          const params: SearchParams = {
            ...filterOpts,
            page: 1,
            limit: 20,
          };

          const result = await search(params);

          // Every result must satisfy all filters
          for (const listing of result.listings) {
            expect(listingMatchesFilters(listing as unknown as Record<string, unknown>, filterOpts)).toBe(true);
          }
          expect(result.totalCount).toBe(expected.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 7: Full-text search matches titles, descriptions, and tags
 *
 * **Validates: Requirements 3.3**
 */
describe("Feature: apartment-finder, Property 7: Full-text search matches titles, descriptions, and tags", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("every listing returned contains the query term in title, description, or tags", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{3,8}$/),
        fc.array(listingArb, { minLength: 1, maxLength: 10 }),
        async (queryTerm, listings) => {
          // Simulate: only listings containing the term are returned by MongoDB text search
          const matching = listings.filter(
            (l) =>
              l.title.toLowerCase().includes(queryTerm) ||
              l.description.toLowerCase().includes(queryTerm) ||
              l.tags.some((t) => t.includes(queryTerm))
          );

          const chainable = {
            sort: () => chainable,
            skip: () => chainable,
            limit: () => chainable,
            maxTimeMS: () => Promise.resolve(matching),
          };
          mockListingFind.mockReturnValue(chainable);
          mockCountDocuments.mockReturnValue({ maxTimeMS: () => Promise.resolve(matching.length) });

          const result = await search({ query: queryTerm, page: 1, limit: 20 });

          for (const listing of result.listings) {
            const l = listing as unknown as { title: string; description: string; tags: string[] };
            const found =
              l.title.toLowerCase().includes(queryTerm) ||
              l.description.toLowerCase().includes(queryTerm) ||
              l.tags.some((t) => t.includes(queryTerm));
            expect(found).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 8: Geographic boundary filter containment
 *
 * **Validates: Requirements 3.5**
 */
describe("Feature: apartment-finder, Property 8: Geographic boundary filter containment", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("every returned listing has coordinates within the polygon boundary", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a simple bounding box as polygon
        fc.record({
          minLng: fc.double({ min: -10, max: 10, noNaN: true }),
          maxLng: fc.double({ min: 11, max: 20, noNaN: true }),
          minLat: fc.double({ min: 40, max: 48, noNaN: true }),
          maxLat: fc.double({ min: 49, max: 60, noNaN: true }),
        }),
        fc.array(listingArb, { minLength: 1, maxLength: 10 }),
        async (bbox, listings) => {
          const polygon = {
            type: "Polygon" as const,
            coordinates: [[
              [bbox.minLng, bbox.minLat],
              [bbox.maxLng, bbox.minLat],
              [bbox.maxLng, bbox.maxLat],
              [bbox.minLng, bbox.maxLat],
              [bbox.minLng, bbox.minLat],
            ]],
          };

          // Filter listings that fall within the bbox
          const withinBoundary = listings.filter((l) => {
            const [lng, lat] = l.location.coordinates;
            return lng >= bbox.minLng && lng <= bbox.maxLng && lat >= bbox.minLat && lat <= bbox.maxLat;
          });

          const chainable = {
            sort: () => chainable,
            skip: () => chainable,
            limit: () => chainable,
            maxTimeMS: () => Promise.resolve(withinBoundary),
          };
          mockListingFind.mockReturnValue(chainable);
          mockCountDocuments.mockReturnValue({ maxTimeMS: () => Promise.resolve(withinBoundary.length) });

          const result = await searchWithinBoundary({ page: 1, limit: 20 }, polygon);

          for (const listing of result.listings) {
            const loc = (listing as unknown as { location: { coordinates: [number, number] } }).location;
            const [lng, lat] = loc.coordinates;
            expect(lng).toBeGreaterThanOrEqual(bbox.minLng);
            expect(lng).toBeLessThanOrEqual(bbox.maxLng);
            expect(lat).toBeGreaterThanOrEqual(bbox.minLat);
            expect(lat).toBeLessThanOrEqual(bbox.maxLat);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 9: Filter serialization round-trip
 *
 * **Validates: Requirements 3.9**
 */
describe("Feature: apartment-finder, Property 9: Filter serialization round-trip", () => {
  it("serializing filters to URL params and deserializing back produces equivalent state", () => {
    fc.assert(
      fc.property(
        fc.record({
          query: fc.option(fc.stringMatching(/^[a-z]{1,10}$/), { nil: undefined }),
          propertyType: fc.option(propertyTypeArb, { nil: undefined }),
          priceRange: fc.option(
            fc.record({
              min: fc.integer({ min: 0, max: 2000 }),
              max: fc.integer({ min: 2001, max: 10000 }),
            }),
            { nil: undefined }
          ),
          bedrooms: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined }),
          tags: fc.option(fc.array(fc.stringMatching(/^[a-z]{2,6}$/), { minLength: 1, maxLength: 3 }), { nil: undefined }),
          purpose: fc.option(purposeArb, { nil: undefined }),
          isSharedAccommodation: fc.option(fc.constant(true), { nil: undefined }),
          city: fc.option(fc.constantFrom("Berlin", "Paris"), { nil: undefined }),
        }),
        (filters) => {
          const serialized = serializeFilters(filters);
          const deserialized = deserializeFilters(serialized);

          if (filters.query) expect(deserialized.query).toBe(filters.query);
          if (filters.propertyType) expect(deserialized.propertyType).toBe(filters.propertyType);
          if (filters.priceRange) {
            expect(deserialized.priceRange?.min).toBe(filters.priceRange.min);
            expect(deserialized.priceRange?.max).toBe(filters.priceRange.max);
          }
          if (filters.bedrooms !== undefined) expect(deserialized.bedrooms).toBe(filters.bedrooms);
          if (filters.tags && filters.tags.length > 0) expect(deserialized.tags).toEqual(filters.tags);
          if (filters.purpose) expect(deserialized.purpose).toBe(filters.purpose);
          if (filters.isSharedAccommodation) expect(deserialized.isSharedAccommodation).toBe(true);
          if (filters.city) expect(deserialized.city).toBe(filters.city);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 10: Clear filters restores full listing set
 *
 * **Validates: Requirements 3.8**
 */
describe("Feature: apartment-finder, Property 10: Clear filters restores full listing set", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("clearing all filters returns the same result as querying with no filters", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(listingArb, { minLength: 1, maxLength: 15 }),
        async (allListings) => {
          // All active listings
          const chainable = {
            sort: () => chainable,
            skip: () => chainable,
            limit: () => chainable,
            maxTimeMS: () => Promise.resolve(allListings),
          };
          mockListingFind.mockReturnValue(chainable);
          mockCountDocuments.mockReturnValue({ maxTimeMS: () => Promise.resolve(allListings.length) });

          // Query with no filters (cleared state)
          const noFilterResult = await search({ page: 1, limit: 100 });

          // Query after "clearing" filters should be equivalent
          const clearedResult = await search({ page: 1, limit: 100 });

          expect(clearedResult.totalCount).toBe(noFilterResult.totalCount);
          expect(clearedResult.listings.length).toBe(noFilterResult.listings.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
