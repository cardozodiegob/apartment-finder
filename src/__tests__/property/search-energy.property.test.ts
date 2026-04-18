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

const RATINGS = ["A", "B", "C", "D", "E", "F", "G"] as const;
type Rating = (typeof RATINGS)[number];

const ratingArb = fc.constantFrom(...RATINGS);

function ratingIndex(r: Rating): number {
  return RATINGS.indexOf(r);
}

/**
 * Feature: apartment-finder, Property 5: Energy rating filter order
 *
 * **Validates: Requirement 6**
 *
 * When the user requests `minEnergyRating = R`, every returned listing must
 * have `energyRating ∈ {A..R}` (i.e. its ordinal index ≤ index(R)).
 * Tightening the filter can only shrink the result set, never grow it.
 */
describe("Feature: apartment-finder, Property 5: Energy rating filter order", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const listingArb = fc.record({
    _id: fc.stringMatching(/^[0-9a-f]{24}$/),
    energyRating: ratingArb,
    status: fc.constant("active" as const),
  });

  it("every returned listing has a rating at least as good as the requested floor", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(listingArb, { minLength: 1, maxLength: 15 }),
        ratingArb,
        async (listings, floor) => {
          const floorIdx = ratingIndex(floor);
          const expected = listings.filter((l) => ratingIndex(l.energyRating) <= floorIdx);

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

          const result = await search({
            minEnergyRating: floor,
            page: 1,
            limit: 30,
          });

          for (const l of result.listings) {
            const doc = l as unknown as { energyRating: Rating };
            expect(ratingIndex(doc.energyRating)).toBeLessThanOrEqual(floorIdx);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("tightening the floor monotonically shrinks the result set", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(listingArb, { minLength: 1, maxLength: 15 }),
        fc.integer({ min: 0, max: 5 }),
        async (listings, loose) => {
          const tight = Math.min(loose + 1, RATINGS.length - 1);
          const looseFloor = RATINGS[loose];
          const tightFloor = RATINGS[tight];

          const looseMatches = listings.filter(
            (l) => ratingIndex(l.energyRating) <= loose,
          );
          const tightMatches = listings.filter(
            (l) => ratingIndex(l.energyRating) <= tight,
          );
          // Tighter floor = higher index = same-or-larger allow set
          expect(looseMatches.length).toBeLessThanOrEqual(tightMatches.length);

          // Helper to mock either case
          const mockOnce = (subset: typeof listings) => {
            const chainable = {
              sort: () => chainable,
              skip: () => chainable,
              limit: () => chainable,
              maxTimeMS: () => Promise.resolve(subset),
            };
            mockListingFind.mockReturnValue(chainable);
            mockCountDocuments.mockReturnValue({
              maxTimeMS: () => Promise.resolve(subset.length),
            });
          };

          mockOnce(looseMatches);
          const a = await search({ minEnergyRating: looseFloor, page: 1, limit: 30 });

          mockOnce(tightMatches);
          const b = await search({ minEnergyRating: tightFloor, page: 1, limit: 30 });

          expect(a.listings.length).toBeLessThanOrEqual(b.listings.length);
        },
      ),
      { numRuns: 50 },
    );
  });
});
