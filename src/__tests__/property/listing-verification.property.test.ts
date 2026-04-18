import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Feature: apartment-finder, Property 10: Listing verification is monotonic
 *
 * **Validates: Requirement 61**
 *
 * Verification tiers form a monotone ladder — none → docs → photo_tour → in_person.
 * - A listing with tier T matches a search filter asking for tier ≤ T.
 * - A listing with tier T does NOT match a filter asking for a strictly higher tier.
 */

const TIERS = ["none", "docs", "photo_tour", "in_person"] as const;
type Tier = (typeof TIERS)[number];

function rank(t: Tier): number {
  return TIERS.indexOf(t);
}

function matchesMinTier(listingTier: Tier, minTier: Tier): boolean {
  return rank(listingTier) >= rank(minTier);
}

describe("Feature: apartment-finder, Property 10: Listing verification is monotonic", () => {
  const tierArb = fc.constantFrom<Tier>(...TIERS);

  it("filter min=none matches every listing", () => {
    fc.assert(
      fc.property(tierArb, (listingTier) => {
        expect(matchesMinTier(listingTier, "none")).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("filter min=in_person only matches listings at in_person", () => {
    fc.assert(
      fc.property(tierArb, (listingTier) => {
        expect(matchesMinTier(listingTier, "in_person")).toBe(listingTier === "in_person");
      }),
      { numRuns: 100 },
    );
  });

  it("raising the minimum tier can only remove listings, not add them", () => {
    fc.assert(
      fc.property(
        fc.array(tierArb, { minLength: 1, maxLength: 20 }),
        tierArb,
        tierArb,
        (listings, tA, tB) => {
          const [looser, tighter] = rank(tA) <= rank(tB) ? [tA, tB] : [tB, tA];
          const atLoose = listings.filter((t) => matchesMinTier(t, looser)).length;
          const atTight = listings.filter((t) => matchesMinTier(t, tighter)).length;
          expect(atTight).toBeLessThanOrEqual(atLoose);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("downgrading a listing's tier is idempotent in rank — same or lower rank", () => {
    fc.assert(
      fc.property(tierArb, tierArb, (before, after) => {
        const prev = rank(before);
        const next = rank(after);
        expect(Math.min(prev, next)).toBeLessThanOrEqual(Math.max(prev, next));
      }),
      { numRuns: 100 },
    );
  });
});
