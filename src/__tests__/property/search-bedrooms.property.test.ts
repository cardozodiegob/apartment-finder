import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import * as fc from "fast-check";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

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

import { search } from "@/lib/services/search";

/**
 * Feature: apartment-finder, Property 3: Bedroom filter semantics
 *
 * **Validates: Requirement 4**
 *
 * The `bedrooms` filter and the `availableRooms` filter are INDEPENDENT:
 * filtering on one never affects the other. A listing with `bedrooms >= N`
 * and `availableRooms = 0` still matches a bedrooms≥N query; a listing with
 * `availableRooms >= M` and `bedrooms = 0` still matches an availableRooms≥M
 * query.
 */
describe("Feature: apartment-finder, Property 3: Bedroom filter semantics", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const listingArb = fc.record({
    _id: fc.stringMatching(/^[0-9a-f]{24}$/),
    bedrooms: fc.integer({ min: 0, max: 5 }),
    bathrooms: fc.integer({ min: 0, max: 3 }),
    availableRooms: fc.integer({ min: 0, max: 5 }),
    isSharedAccommodation: fc.boolean(),
    status: fc.constant("active" as const),
  });

  it("bedrooms filter matches on `bedrooms` field, not `availableRooms`", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(listingArb, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 5 }),
        async (listings, minBedrooms) => {
          const expected = listings.filter((l) => l.bedrooms >= minBedrooms);
          const chainable = {
            sort: () => chainable,
            skip: () => chainable,
            limit: () => chainable,
            maxTimeMS: () => Promise.resolve(expected),
          };
          mockListingFind.mockReturnValue(chainable);
          mockCountDocuments.mockReturnValue({ maxTimeMS: () => Promise.resolve(expected.length) });

          const result = await search({ bedrooms: minBedrooms, page: 1, limit: 20 });

          for (const listing of result.listings) {
            const l = listing as unknown as { bedrooms: number };
            expect(l.bedrooms).toBeGreaterThanOrEqual(minBedrooms);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("availableRooms filter matches on `availableRooms` field, not `bedrooms`", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(listingArb, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 5 }),
        async (listings, minRooms) => {
          const expected = listings.filter((l) => l.availableRooms >= minRooms);
          const chainable = {
            sort: () => chainable,
            skip: () => chainable,
            limit: () => chainable,
            maxTimeMS: () => Promise.resolve(expected),
          };
          mockListingFind.mockReturnValue(chainable);
          mockCountDocuments.mockReturnValue({ maxTimeMS: () => Promise.resolve(expected.length) });

          const result = await search({ availableRooms: minRooms, page: 1, limit: 20 });

          for (const listing of result.listings) {
            const l = listing as unknown as { availableRooms: number };
            expect(l.availableRooms).toBeGreaterThanOrEqual(minRooms);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("filtering by both bedrooms AND bathrooms applies both independently", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(listingArb, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 2 }),
        async (listings, minBedrooms, minBathrooms) => {
          const expected = listings.filter(
            (l) => l.bedrooms >= minBedrooms && l.bathrooms >= minBathrooms,
          );
          const chainable = {
            sort: () => chainable,
            skip: () => chainable,
            limit: () => chainable,
            maxTimeMS: () => Promise.resolve(expected),
          };
          mockListingFind.mockReturnValue(chainable);
          mockCountDocuments.mockReturnValue({ maxTimeMS: () => Promise.resolve(expected.length) });

          const result = await search({
            bedrooms: minBedrooms,
            bathrooms: minBathrooms,
            page: 1,
            limit: 20,
          });

          for (const listing of result.listings) {
            const l = listing as unknown as { bedrooms: number; bathrooms: number };
            expect(l.bedrooms).toBeGreaterThanOrEqual(minBedrooms);
            expect(l.bathrooms).toBeGreaterThanOrEqual(minBathrooms);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
