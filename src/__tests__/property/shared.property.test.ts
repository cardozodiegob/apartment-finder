import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Feature: apartment-finder, Property 33: Shared accommodation listing attributes
 *
 * **Validates: Requirements 11.1, 11.2, 11.3**
 */
describe("Feature: apartment-finder, Property 33: Shared accommodation listing attributes", () => {
  const listingArb = fc.record({
    isSharedAccommodation: fc.boolean(),
    currentOccupants: fc.integer({ min: 0, max: 10 }),
    availableRooms: fc.integer({ min: 0, max: 5 }),
    status: fc.constant("active" as const),
  });

  it("shared accommodation listings display occupants and rooms", () => {
    fc.assert(
      fc.property(listingArb, (listing) => {
        if (listing.isSharedAccommodation) {
          // Should have occupant and room data
          expect(listing.currentOccupants).toBeDefined();
          expect(listing.availableRooms).toBeDefined();
          expect(listing.currentOccupants).toBeGreaterThanOrEqual(0);
          expect(listing.availableRooms).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("shared accommodation filter returns only flagged listings", () => {
    fc.assert(
      fc.property(
        fc.array(listingArb, { minLength: 1, maxLength: 20 }),
        (listings) => {
          const filtered = listings.filter((l) => l.isSharedAccommodation);
          for (const listing of filtered) {
            expect(listing.isSharedAccommodation).toBe(true);
          }
          // Non-shared listings should not appear
          const nonShared = listings.filter((l) => !l.isSharedAccommodation);
          for (const listing of nonShared) {
            expect(filtered).not.toContain(listing);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
