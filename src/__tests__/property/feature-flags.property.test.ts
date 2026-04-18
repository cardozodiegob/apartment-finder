import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { hashToBucket } from "@/lib/services/featureFlags";

/**
 * Feature: apartment-finder, Property 11: Feature-flag evaluation is deterministic per user
 *
 * **Validates: Requirement 58**
 *
 * `hashToBucket(input)` must always return the same 0..99 integer for the
 * same input, must be uniformly distributed in [0, 100), and must produce
 * a stable rollout decision when combined with a rollout percentage.
 */
describe("Feature: apartment-finder, Property 11: Feature-flag evaluation is deterministic per user", () => {
  it("hashToBucket is deterministic — same input yields same bucket", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (s) => {
        const a = hashToBucket(s);
        const b = hashToBucket(s);
        expect(a).toBe(b);
      }),
      { numRuns: 200 },
    );
  });

  it("hashToBucket output is always in [0, 100)", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const b = hashToBucket(s);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(100);
        expect(Number.isInteger(b)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it("rollout decision is stable for a (flag, user) pair", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 15 }),
        fc.string({ minLength: 3, maxLength: 15 }),
        fc.integer({ min: 0, max: 100 }),
        (flag, user, pct) => {
          const first = hashToBucket(`${flag}:${user}`) < pct;
          const second = hashToBucket(`${flag}:${user}`) < pct;
          expect(first).toBe(second);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("raising the rollout % can only include more users (monotonic)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 15 }),
        fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 51, max: 100 }),
        (flag, users, lowPct, highPct) => {
          const atLow = users.filter((u) => hashToBucket(`${flag}:${u}`) < lowPct).length;
          const atHigh = users.filter((u) => hashToBucket(`${flag}:${u}`) < highPct).length;
          expect(atHigh).toBeGreaterThanOrEqual(atLow);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("bucket is reasonably uniform across random strings", () => {
    const buckets: number[] = [];
    for (let i = 0; i < 1000; i++) {
      buckets.push(hashToBucket(`user-${i}`));
    }
    const histogram = new Array(10).fill(0);
    for (const b of buckets) histogram[Math.floor(b / 10)] += 1;
    // Each decile should have at least 60 samples out of 1000 (expected ~100)
    for (const count of histogram) {
      expect(count).toBeGreaterThanOrEqual(60);
    }
  });
});
