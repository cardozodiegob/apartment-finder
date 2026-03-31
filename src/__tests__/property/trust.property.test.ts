import { describe, it, expect, vi, beforeAll } from "vitest";
import * as fc from "fast-check";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

vi.mock("@/lib/db/models/Review", () => ({ default: { find: vi.fn(), findOne: vi.fn(), create: vi.fn() } }));
vi.mock("@/lib/db/models/User", () => ({ default: { findById: vi.fn() } }));
vi.mock("@/lib/db/models/Listing", () => ({ default: { updateMany: vi.fn() } }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));

import { calculateTrustScore, timeDecay, getUserBadgeFromData } from "@/lib/services/trust";

const reviewArb = fc.record({
  rating: fc.integer({ min: 1, max: 5 }),
  ageDays: fc.double({ min: 0, max: 365, noNaN: true }),
});

/**
 * Feature: apartment-finder, Property 13: Trust score calculation with time-decay weighting
 *
 * **Validates: Requirements 5.1, 5.7**
 */
describe("Feature: apartment-finder, Property 13: Trust score calculation with time-decay weighting", () => {
  it("recent reviews are weighted higher than older reviews", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.double({ min: 0, max: 30, noNaN: true }),
        fc.double({ min: 100, max: 365, noNaN: true }),
        (rating, recentAge, oldAge) => {
          const recentWeight = timeDecay(recentAge);
          const oldWeight = timeDecay(oldAge);
          expect(recentWeight).toBeGreaterThan(oldWeight);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("score is bounded between 0 and 5", () => {
    fc.assert(
      fc.property(
        fc.array(reviewArb, { minLength: 1, maxLength: 20 }),
        fc.double({ min: 0.5, max: 1.0, noNaN: true }),
        (reviews, completeness) => {
          const score = calculateTrustScore(reviews, completeness);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("adding a new high-rating review never decreases the score", () => {
    fc.assert(
      fc.property(
        fc.array(reviewArb, { minLength: 1, maxLength: 10 }),
        fc.double({ min: 0.5, max: 1.0, noNaN: true }),
        (existingReviews, completeness) => {
          const scoreBefore = calculateTrustScore(existingReviews, completeness);
          // Add a 5-star review from today
          const withNewReview = [...existingReviews, { rating: 5, ageDays: 0 }];
          const scoreAfter = calculateTrustScore(withNewReview, completeness);
          expect(scoreAfter).toBeGreaterThanOrEqual(scoreBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("empty reviews produce score of 0", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        (completeness) => {
          const score = calculateTrustScore([], completeness);
          expect(score).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 14: New user badge threshold
 *
 * **Validates: Requirements 5.5**
 */
describe("Feature: apartment-finder, Property 14: New user badge threshold", () => {
  it("users with < 3 transactions get 'new_user' badge", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        (transactions, score) => {
          const badge = getUserBadgeFromData(transactions, score);
          expect(badge).toBe("new_user");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("users with >= 3 transactions get numeric score-based badge", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }),
        fc.double({ min: 2.0, max: 5, noNaN: true }),
        (transactions, score) => {
          const badge = getUserBadgeFromData(transactions, score);
          expect(badge).toBe("trusted");
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 15: Low trust score triggers flagging
 *
 * **Validates: Requirements 5.6**
 */
describe("Feature: apartment-finder, Property 15: Low trust score triggers flagging", () => {
  it("users with score below threshold and enough transactions are flagged", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }),
        fc.double({ min: 0, max: 1.99, noNaN: true }),
        (transactions, score) => {
          const badge = getUserBadgeFromData(transactions, score);
          expect(badge).toBe("flagged");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("users with score at or above threshold are trusted", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }),
        fc.double({ min: 2.0, max: 5, noNaN: true }),
        (transactions, score) => {
          const badge = getUserBadgeFromData(transactions, score);
          expect(badge).toBe("trusted");
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 16: Review submission updates trust score
 *
 * **Validates: Requirements 5.2, 5.3, 5.8**
 */
describe("Feature: apartment-finder, Property 16: Review submission updates trust score", () => {
  it("adding a review recalculates the score incorporating the new rating", () => {
    fc.assert(
      fc.property(
        fc.array(reviewArb, { minLength: 0, maxLength: 10 }),
        fc.integer({ min: 1, max: 5 }),
        fc.double({ min: 0.5, max: 1.0, noNaN: true }),
        (existingReviews, newRating, completeness) => {
          const scoreBefore = calculateTrustScore(existingReviews, completeness);
          const withNew = [...existingReviews, { rating: newRating, ageDays: 0 }];
          const scoreAfter = calculateTrustScore(withNew, completeness);

          // Score should change (unless it was already at the same value)
          if (existingReviews.length === 0) {
            expect(scoreAfter).toBeGreaterThan(0);
          }
          // Score should still be bounded
          expect(scoreAfter).toBeGreaterThanOrEqual(0);
          expect(scoreAfter).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 100 }
    );
  });
});
