import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { nextTheme, resolveTheme, type Theme } from "@/lib/context/ThemeContext";

const themeArb = fc.constantFrom<Theme | null | undefined>(
  "light",
  "dark",
  "system",
  null,
  undefined,
);

/**
 * Feature: apartment-finder, Property 1: Theme resolution is pure
 *
 * **Validates: Requirement 1**
 *
 * `resolveTheme(stored, prefersDark)` is a total pure function: it always
 * returns "light" or "dark", never throws, and produces identical output
 * for identical inputs.
 */
describe("Feature: apartment-finder, Property 1: Theme resolution is pure", () => {
  it("returns only light|dark for every possible (stored, prefersDark) pair", () => {
    fc.assert(
      fc.property(themeArb, fc.boolean(), (stored, prefersDark) => {
        const resolved = resolveTheme(stored, prefersDark);
        expect(resolved === "light" || resolved === "dark").toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("is deterministic — the same inputs always produce the same output", () => {
    fc.assert(
      fc.property(themeArb, fc.boolean(), (stored, prefersDark) => {
        const a = resolveTheme(stored, prefersDark);
        const b = resolveTheme(stored, prefersDark);
        expect(a).toBe(b);
      }),
      { numRuns: 200 },
    );
  });

  it("honours an explicit light/dark preference regardless of system preference", () => {
    fc.assert(
      fc.property(fc.boolean(), (prefersDark) => {
        expect(resolveTheme("light", prefersDark)).toBe("light");
        expect(resolveTheme("dark", prefersDark)).toBe("dark");
      }),
      { numRuns: 50 },
    );
  });

  it("falls back to prefers-color-scheme when stored is system/null/undefined", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme | null | undefined>("system", null, undefined),
        fc.boolean(),
        (stored, prefersDark) => {
          const resolved = resolveTheme(stored, prefersDark);
          expect(resolved).toBe(prefersDark ? "dark" : "light");
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: apartment-finder, Property 1b: nextTheme toggle is involutive
 *
 * **Validates: Requirement 1**
 *
 * Applying nextTheme twice with the same system preference and the just-returned
 * theme as the new stored value must restore the original resolved theme.
 */
describe("Feature: apartment-finder, Property 1b: nextTheme toggle is involutive", () => {
  it("toggling twice returns to the original resolved theme", () => {
    fc.assert(
      fc.property(themeArb, fc.boolean(), (stored, prefersDark) => {
        const initial = resolveTheme(stored, prefersDark);
        const once = nextTheme(stored, prefersDark);
        const twice = nextTheme(once, prefersDark);
        expect(twice).toBe(initial);
      }),
      { numRuns: 200 },
    );
  });

  it("always returns a concrete light|dark preference (never system)", () => {
    fc.assert(
      fc.property(themeArb, fc.boolean(), (stored, prefersDark) => {
        const next = nextTheme(stored, prefersDark);
        expect(next === "light" || next === "dark").toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
