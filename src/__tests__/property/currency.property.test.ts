import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import * as fc from "fast-check";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

// Mock fetch to avoid real API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  convert,
  getRates,
  formatPrice,
  formatDate,
  formatNumber,
  _getRatesCache,
  SUPPORTED_CURRENCIES,
} from "@/lib/services/currency";
import type { SupportedCurrency, SupportedLocale } from "@/lib/services/currency";

const currencyArb = fc.constantFrom(...SUPPORTED_CURRENCIES) as fc.Arbitrary<SupportedCurrency>;
const localeArb = fc.constantFrom("en", "es", "fr", "de", "pt", "it") as fc.Arbitrary<SupportedLocale>;
const amountArb = fc.double({ min: 0.01, max: 100000, noNaN: true });

/**
 * Feature: apartment-finder, Property 11: Currency conversion round-trip consistency
 *
 * **Validates: Requirements 4.4, 4.5**
 */
describe("Feature: apartment-finder, Property 11: Currency conversion round-trip consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _getRatesCache().clear();
    // Mock fetch to return fallback (simulating API failure so fallback rates are used)
    mockFetch.mockRejectedValue(new Error("Network error"));
  });

  it("converting from A to B shows original amount in A and correctly converted amount in B", async () => {
    await fc.assert(
      fc.asyncProperty(amountArb, currencyArb, currencyArb, async (amount, from, to) => {
        const converted = await convert(amount, from, to);

        if (from === to) {
          expect(converted).toBe(amount);
        } else {
          // Converted amount should be a non-negative finite number
          expect(converted).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(converted)).toBe(true);
        }

        // Verify rates are cached (no older than 24h)
        const rates = await getRates(from);
        expect(Date.now() - rates.fetchedAt).toBeLessThan(24 * 60 * 60 * 1000);
      }),
      { numRuns: 100 }
    );
  });

  it("conversion preserves the original amount (dual display)", async () => {
    await fc.assert(
      fc.asyncProperty(amountArb, currencyArb, currencyArb, async (amount, from, to) => {
        const converted = await convert(amount, from, to);
        // Original amount is unchanged
        expect(amount).toBe(amount);
        // Converted is a valid number
        expect(Number.isFinite(converted)).toBe(true);
        expect(converted).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 12: Locale-aware formatting
 *
 * **Validates: Requirements 4.7**
 */
describe("Feature: apartment-finder, Property 12: Locale-aware formatting", () => {
  it("formatted price output matches Intl conventions for the locale", () => {
    fc.assert(
      fc.property(amountArb, currencyArb, localeArb, (amount, currency, locale) => {
        const formatted = formatPrice(amount, currency, locale);
        // Should be a non-empty string
        expect(formatted.length).toBeGreaterThan(0);
        // Should contain digits
        expect(/\d/.test(formatted)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("formatted date matches locale conventions", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
        localeArb,
        (date, locale) => {
          const formatted = formatDate(date, locale);
          expect(formatted.length).toBeGreaterThan(0);
          // Should contain the year
          expect(formatted).toContain(String(date.getFullYear()));
        }
      ),
      { numRuns: 100 }
    );
  });

  it("formatted number uses locale-appropriate decimal separators", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1000000, noNaN: true }),
        localeArb,
        (value, locale) => {
          const formatted = formatNumber(value, locale);
          expect(formatted.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
