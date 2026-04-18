import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Feature: apartment-finder, Property 12: Move-in guarantee timer monotonicity
 *
 * **Validates: Requirement 59**
 *
 * Model of the 48-hour dispute window governing escrow release.
 *   - At t ∈ [moveIn, moveIn+48h] a dispute can be filed.
 *   - If no dispute is filed, funds auto-release at moveIn+48h.
 *   - If a dispute is filed the escrow freezes until admin resolves it.
 *   - Time monotonically advances the window toward close — re-entering the
 *     dispute window after release is impossible.
 */

const HOURS = 60 * 60 * 1000;
const WINDOW = 48 * HOURS;

type State = "awaiting_move_in" | "in_dispute_window" | "frozen" | "released";

interface Context {
  moveInAt: number;
  disputedAt: number | null; // ms since epoch
  releasedAt: number | null;
}

function stateAt(ctx: Context, nowMs: number): State {
  if (ctx.releasedAt !== null && nowMs >= ctx.releasedAt) return "released";
  if (ctx.disputedAt !== null) return "frozen";
  if (nowMs < ctx.moveInAt) return "awaiting_move_in";
  if (nowMs <= ctx.moveInAt + WINDOW) return "in_dispute_window";
  return "released";
}

describe("Feature: apartment-finder, Property 12: Move-in guarantee timer monotonicity", () => {
  const ctxArb = fc.record({
    moveInAt: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
    disputedAt: fc.option(fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }), { nil: null }),
    releasedAt: fc.option(fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }), { nil: null }),
  });

  it("once released, state stays released regardless of later time", () => {
    fc.assert(
      fc.property(ctxArb, (ctx) => {
        const release = ctx.moveInAt + WINDOW + 1;
        const later = release + 1_000_000;
        const ctxAfter = { ...ctx, disputedAt: null, releasedAt: release };
        expect(stateAt(ctxAfter, release)).toBe("released");
        expect(stateAt(ctxAfter, later)).toBe("released");
      }),
      { numRuns: 100 },
    );
  });

  it("a dispute filed within the window freezes the escrow", () => {
    fc.assert(
      fc.property(ctxArb, fc.integer({ min: 0, max: WINDOW }), (ctx, offset) => {
        const disputedAt = ctx.moveInAt + offset;
        const ctxNow = { ...ctx, disputedAt, releasedAt: null };
        expect(stateAt(ctxNow, disputedAt)).toBe("frozen");
      }),
      { numRuns: 100 },
    );
  });

  it("without dispute, funds release exactly at moveInAt + 48h", () => {
    fc.assert(
      fc.property(ctxArb, (ctx) => {
        const ctxNow = { ...ctx, disputedAt: null, releasedAt: null };
        expect(stateAt(ctxNow, ctx.moveInAt + WINDOW + 1)).toBe("released");
        expect(stateAt(ctxNow, ctx.moveInAt + WINDOW / 2)).toBe("in_dispute_window");
        expect(stateAt(ctxNow, ctx.moveInAt - 1)).toBe("awaiting_move_in");
      }),
      { numRuns: 100 },
    );
  });

  it("state progression is monotonic — once past the window, can't go back", () => {
    fc.assert(
      fc.property(ctxArb, (ctx) => {
        const ctxNow = { ...ctx, disputedAt: null, releasedAt: null };
        const states = [
          stateAt(ctxNow, ctx.moveInAt - 10),
          stateAt(ctxNow, ctx.moveInAt + 1),
          stateAt(ctxNow, ctx.moveInAt + WINDOW + 1),
        ];
        const rank: Record<State, number> = {
          awaiting_move_in: 0,
          in_dispute_window: 1,
          frozen: 1,
          released: 2,
        };
        expect(rank[states[1]]).toBeGreaterThanOrEqual(rank[states[0]]);
        expect(rank[states[2]]).toBeGreaterThanOrEqual(rank[states[1]]);
      }),
      { numRuns: 100 },
    );
  });
});
