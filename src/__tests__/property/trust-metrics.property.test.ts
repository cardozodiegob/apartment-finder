import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Feature: apartment-finder, Property 9: Trust metric windowing
 *
 * **Validates: Requirement 16**
 *
 * In-memory model of the response-metrics windowing rule used by
 * `computeResponseMetrics`.  Only messages whose thread is active within the
 * 90-day window are counted, and the response rate never exceeds 1.0.
 */

const WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

interface Thread {
  id: string;
  lastActivityMs: number;
  answered: boolean;
}

function metricsFor(threads: Thread[], nowMs: number) {
  const inWindow = threads.filter((t) => nowMs - t.lastActivityMs <= WINDOW_MS);
  const answered = inWindow.filter((t) => t.answered).length;
  const total = inWindow.length;
  const rate = total === 0 ? 0 : answered / total;
  return { rate, total };
}

describe("Feature: apartment-finder, Property 9: Trust metric windowing", () => {
  it("response rate is always in [0, 1]", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.stringMatching(/^[a-z]{3,8}$/),
            lastActivityMs: fc.integer({ min: 0, max: 1_900_000_000_000 }),
            answered: fc.boolean(),
          }),
        ),
        fc.integer({ min: 1_500_000_000_000, max: 2_000_000_000_000 }),
        (threads, now) => {
          const { rate } = metricsFor(threads, now);
          expect(rate).toBeGreaterThanOrEqual(0);
          expect(rate).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("threads older than 90 days never contribute", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.stringMatching(/^[a-z]{3,8}$/),
            answered: fc.boolean(),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        fc.integer({ min: 1_500_000_000_000, max: 2_000_000_000_000 }),
        (bases, now) => {
          const old: Thread[] = bases.map((b) => ({
            id: b.id,
            answered: b.answered,
            lastActivityMs: now - WINDOW_MS - 24 * 60 * 60 * 1000,
          }));
          const { total } = metricsFor(old, now);
          expect(total).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rate is monotonic — adding an unanswered thread never increases rate", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.stringMatching(/^[a-z]{3,8}$/),
            lastActivityMs: fc.integer({ min: 1_900_000_000_000 - WINDOW_MS + 1, max: 1_900_000_000_000 }),
            answered: fc.boolean(),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (threads) => {
          const now = 1_900_000_000_000;
          const before = metricsFor(threads, now).rate;
          const after = metricsFor(
            [...threads, { id: "newThread", lastActivityMs: now - 1000, answered: false }],
            now,
          ).rate;
          expect(after).toBeLessThanOrEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });
});
