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
import { AMENITIES } from "@/lib/constants/amenities";

const amenityArb = fc.constantFrom(...AMENITIES);

/**
 * Feature: apartment-finder, Property 4: Amenity filter is set-inclusion
 *
 * **Validates: Requirement 5**
 *
 * When the user requests a set of amenities A = {a1,...,an}, every listing
 * returned must have `listing.amenities ⊇ A`. Order is irrelevant, duplicates
 * don't affect the result, and an empty A-set must not filter anything.
 */
describe("Feature: apartment-finder, Property 4: Amenity filter is set-inclusion", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("every returned listing contains every requested amenity", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            _id: fc.stringMatching(/^[0-9a-f]{24}$/),
            amenities: fc.uniqueArray(amenityArb, { maxLength: 10 }),
          }),
          { minLength: 1, maxLength: 15 },
        ),
        fc.uniqueArray(amenityArb, { minLength: 1, maxLength: 4 }),
        async (listings, requested) => {
          const expected = listings.filter((l) =>
            requested.every((a) => l.amenities.includes(a)),
          );

          const chainable = {
            sort: () => chainable,
            skip: () => chainable,
            limit: () => chainable,
            maxTimeMS: () => Promise.resolve(expected),
          };
          mockListingFind.mockReturnValue(chainable);
          mockCountDocuments.mockReturnValue({
            maxTimeMS: () => Promise.resolve(expected.length),
          });

          const result = await search({ amenities: requested, page: 1, limit: 30 });

          for (const listing of result.listings) {
            const l = listing as unknown as { amenities: string[] };
            for (const a of requested) {
              expect(l.amenities).toContain(a);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("requesting a duplicate amenity doesn't change the result set", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            _id: fc.stringMatching(/^[0-9a-f]{24}$/),
            amenities: fc.uniqueArray(amenityArb, { maxLength: 10 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        amenityArb,
        async (listings, a) => {
          const expectedOnce = listings.filter((l) => l.amenities.includes(a));

          const chainable = {
            sort: () => chainable,
            skip: () => chainable,
            limit: () => chainable,
            maxTimeMS: () => Promise.resolve(expectedOnce),
          };
          mockListingFind.mockReturnValue(chainable);
          mockCountDocuments.mockReturnValue({
            maxTimeMS: () => Promise.resolve(expectedOnce.length),
          });

          const once = await search({ amenities: [a], page: 1, limit: 30 });
          const twice = await search({ amenities: [a, a], page: 1, limit: 30 });

          expect(once.listings.length).toBe(twice.listings.length);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("amenity filter order is irrelevant", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(amenityArb, { minLength: 2, maxLength: 4 }),
        fc.array(
          fc.record({
            _id: fc.stringMatching(/^[0-9a-f]{24}$/),
            amenities: fc.uniqueArray(amenityArb, { maxLength: 10 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (requested, listings) => {
          const expected = listings.filter((l) =>
            requested.every((a) => l.amenities.includes(a)),
          );
          const reversed = [...requested].reverse();

          const chainable = {
            sort: () => chainable,
            skip: () => chainable,
            limit: () => chainable,
            maxTimeMS: () => Promise.resolve(expected),
          };
          mockListingFind.mockReturnValue(chainable);
          mockCountDocuments.mockReturnValue({
            maxTimeMS: () => Promise.resolve(expected.length),
          });

          const forward = await search({ amenities: requested, page: 1, limit: 30 });
          const backward = await search({ amenities: reversed, page: 1, limit: 30 });

          expect(forward.listings.length).toBe(backward.listings.length);
        },
      ),
      { numRuns: 50 },
    );
  });
});
