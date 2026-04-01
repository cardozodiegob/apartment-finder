import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

/**
 * Property 2: After maxRequests calls within windowMs, all subsequent calls return allowed=false
 * Validates: Requirements 9.1, 9.2, 9.3
 *
 * For any route with a configured maxRequests limit, once maxRequests calls
 * have been made for a given IP within the time window, every subsequent call
 * must return { allowed: false }.
 */

// --- Mock RateLimit model ---

// Simulates MongoDB findOneAndUpdate behavior in-memory
const mockStore = new Map<string, { count: number; expiresAt: Date }>();

const mockFindOneAndUpdate = vi.fn();

vi.mock("@/lib/db/models/RateLimit", () => ({
  default: {
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args),
  },
}));

/**
 * Configure the mock to simulate MongoDB atomic findOneAndUpdate behavior.
 * Each call increments the counter or creates a new entry, mirroring the
 * real rate-limit.ts logic.
 */
function setupMongoMock() {
  mockFindOneAndUpdate.mockImplementation(
    (
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      options: Record<string, unknown>
    ) => {
      const key = filter.key as string;
      const now = new Date();

      // Case 1: $inc update — incrementing an existing, non-expired entry
      if (update.$inc) {
        const entry = mockStore.get(key);
        if (entry && entry.expiresAt > now) {
          entry.count += 1;
          return Promise.resolve({
            key,
            count: entry.count,
            expiresAt: entry.expiresAt,
          });
        }
        // No valid entry found — return null so the caller creates one
        return Promise.resolve(null);
      }

      // Case 2: $set update — upsert to create/reset an entry
      if (update.$set) {
        const setData = update.$set as { count: number; expiresAt: Date };
        mockStore.set(key, {
          count: setData.count,
          expiresAt: setData.expiresAt,
        });
        return Promise.resolve({
          key,
          count: setData.count,
          expiresAt: setData.expiresAt,
        });
      }

      return Promise.resolve(null);
    }
  );
}

// --- Route config (mirrors rate-limit.ts) ---

const ROUTE_LIMITS: Record<string, number> = {
  "/api/auth/login": 10,
  "/api/auth/register": 5,
  "/api/auth/reset-password": 3,
  default: 100,
};

const ROUTES = Object.keys(ROUTE_LIMITS).filter((r) => r !== "default");

// --- Arbitraries ---

/** Pick a route from the auth endpoints (where limits are small enough to test efficiently) */
const arbRoute = fc.constantFrom(...ROUTES);

/** Generate an IP address string */
const arbIp = fc.tuple(
  fc.integer({ min: 1, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 1, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

/** Number of extra requests beyond the limit to verify */
const arbExtraRequests = fc.integer({ min: 1, max: 5 });

// --- Property test ---

describe("Rate Limiter — Property Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStore.clear();
  });

  it("Property 2: after maxRequests calls, all subsequent calls return allowed=false", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbRoute,
        arbIp,
        arbExtraRequests,
        async (route, ip, extraRequests) => {
          // Reset state for each property run
          mockStore.clear();
          mockFindOneAndUpdate.mockReset();
          setupMongoMock();

          const { checkRateLimit } = await import("@/lib/api/rate-limit");

          const maxRequests = ROUTE_LIMITS[route];

          // Phase 1: Make exactly maxRequests calls (should all be allowed)
          for (let i = 0; i < maxRequests; i++) {
            const result = await checkRateLimit(ip, route);
            expect(result.allowed).toBe(true);
          }

          // Phase 2: Make extraRequests more calls — all must be denied
          for (let i = 0; i < extraRequests; i++) {
            const result = await checkRateLimit(ip, route);
            expect(
              result.allowed,
              `Request ${maxRequests + i + 1} should be denied for route ${route} (limit: ${maxRequests})`
            ).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.retryAfterSeconds).toBeDefined();
            expect(result.retryAfterSeconds!).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
