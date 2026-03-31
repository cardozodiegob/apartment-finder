import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { makeStore } from "@/lib/store/store";
import { setUser, clearUser, SessionUser } from "@/lib/store/slices/sessionSlice";
import {
  setPropertyType,
  setPriceRange,
  setBedrooms,
  setTags,
  setPurpose,
  setCity,
  setIsSharedAccommodation,
  setQuery,
  setPage,
} from "@/lib/store/slices/filtersSlice";

/**
 * Feature: apartment-finder, Property 36: Redux state persistence round-trip
 *
 * Validates: Requirements 13.3
 *
 * For any valid Redux state containing user session and filter selections,
 * persisting the state to localStorage and creating a new store should
 * restore an equivalent state object.
 */

// --- Arbitraries ---

const sessionUserArb: fc.Arbitrary<SessionUser> = fc.record({
  id: fc.uuid(),
  email: fc.emailAddress(),
  fullName: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  role: fc.constantFrom("seeker" as const, "poster" as const, "admin" as const),
  preferredLanguage: fc.constantFrom("en", "es", "fr", "de", "pt", "it"),
  preferredCurrency: fc.constantFrom("EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "BRL"),
});

const priceRangeArb = fc.option(
  fc.record({
    min: fc.integer({ min: 0, max: 10000 }),
    max: fc.integer({ min: 0, max: 50000 }),
  }).filter((r) => r.min <= r.max),
  { nil: null }
);

const filtersArb = fc.record({
  propertyType: fc.option(fc.constantFrom("apartment", "room", "house"), { nil: null }),
  priceRange: priceRangeArb,
  bedrooms: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0), { maxLength: 5 }),
  purpose: fc.option(fc.constantFrom("rent" as const, "share" as const, "sublet" as const), { nil: null }),
  city: fc.option(fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0), { nil: null }),
  isSharedAccommodation: fc.boolean(),
  query: fc.string({ maxLength: 50 }),
  page: fc.integer({ min: 1, max: 100 }),
});

// Generate either an authenticated session (with user) or unauthenticated (null user)
const sessionArb = fc.oneof(
  sessionUserArb.map((user) => ({ user, hasUser: true as const })),
  fc.constant({ user: null as SessionUser | null, hasUser: false as const })
);

describe("Feature: apartment-finder, Property 36: Redux state persistence round-trip", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persisting Redux state and restoring it produces an equivalent session and filters state", () => {
    fc.assert(
      fc.property(sessionArb, filtersArb, (session, filters) => {
        // Clear localStorage for a clean slate
        localStorage.clear();

        // 1. Create a store and populate it with generated state
        const store1 = makeStore();

        // Set session state
        if (session.hasUser && session.user) {
          store1.dispatch(setUser(session.user));
        } else {
          store1.dispatch(clearUser());
        }

        // Set filter state
        store1.dispatch(setPropertyType(filters.propertyType));
        store1.dispatch(setPriceRange(filters.priceRange));
        store1.dispatch(setBedrooms(filters.bedrooms));
        store1.dispatch(setTags(filters.tags));
        store1.dispatch(setPurpose(filters.purpose));
        store1.dispatch(setCity(filters.city));
        store1.dispatch(setIsSharedAccommodation(filters.isSharedAccommodation));
        store1.dispatch(setQuery(filters.query));
        store1.dispatch(setPage(filters.page));

        // Capture the state after dispatching
        const state1 = store1.getState();

        // 2. Verify localStorage was written
        const raw = localStorage.getItem("apartment-finder-state");
        expect(raw).not.toBeNull();

        // 3. Create a new store — it should restore from localStorage
        const store2 = makeStore();
        const state2 = store2.getState();

        // 4. Verify session equivalence
        expect(state2.session).toEqual(state1.session);

        // 5. Verify filters equivalence
        expect(state2.filters).toEqual(state1.filters);
      }),
      { numRuns: 100 }
    );
  });
});
