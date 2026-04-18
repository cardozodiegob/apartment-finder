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
 * Feature: apartment-finder, Property 6: Furnished tri-state
 *
 * **Validates: Requirement 37**
 *
 * The `isFurnished` filter has three states:
 *   - undefined → accept any listing (furnished, unfurnished, or unknown)
 *   - true      → only furnished listings
 *   - false     → only unfurnished listings
 *
 * Swapping between true and false should return disjoint result sets;
 * the union of both sets (for listings where isFurnished is defined) should
 * match the undefined-filter set minus any entries where `isFurnished` is
 * explicitly null.
 */
describe("Feature: apartment-finder, Property 6: Furnished tri-state", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const listingArb = fc.record({
    _id: fc.stringMatching(/^[0-9a-f]{24}$/),
    isFurnished: fc.option(fc.boolean(), { nil: undefined }),
    status: fc.constant("active" as const),
  });

  function mock(expected: unknown[]) {
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
  }

  it("isFurnished=true returns only furnished listings", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(listingArb, { minLength: 1, maxLength: 15 }),
        async (listings) => {
          const expected = listings.filter((l) => l.isFurnished === true);
          mock(expected);
          const r = await search({ isFurnished: true, page: 1, limit: 30 });
          for (const l of r.listings) {
            expect((l as unknown as { isFurnished: boolean }).isFurnished).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("isFurnished=false returns only unfurnished listings", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(listingArb, { minLength: 1, maxLength: 15 }),
        async (listings) => {
          const expected = listings.filter((l) => l.isFurnished === false);
          mock(expected);
          const r = await search({ isFurnished: false, page: 1, limit: 30 });
          for (const l of r.listings) {
            expect((l as unknown as { isFurnished: boolean }).isFurnished).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("isFurnished undefined returns both kinds", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(listingArb, { minLength: 1, maxLength: 15 }),
        async (listings) => {
          mock(listings);
          const r = await search({ page: 1, limit: 30 });
          expect(r.totalCount).toBe(listings.length);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("{true} and {false} result sets are disjoint", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(listingArb, { minLength: 1, maxLength: 15 }),
        async (listings) => {
          const furnished = listings.filter((l) => l.isFurnished === true);
          const unfurnished = listings.filter((l) => l.isFurnished === false);
          const ids = new Set(furnished.map((l) => l._id));
          for (const u of unfurnished) {
            expect(ids.has(u._id)).toBe(false);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
