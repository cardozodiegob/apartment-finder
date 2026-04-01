import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for rate limiter
 * Validates: Requirements 9.1, 9.2, 9.3, 10.3
 */

// --- Mock RateLimit model ---

const mockStore = new Map<string, { count: number; expiresAt: Date }>();

const mockFindOneAndUpdate = vi.fn();

vi.mock("@/lib/db/models/RateLimit", () => ({
  default: {
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args),
  },
}));

function setupMongoMock() {
  mockFindOneAndUpdate.mockImplementation(
    (
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      _options: Record<string, unknown>
    ) => {
      const key = filter.key as string;
      const now = new Date();

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
        return Promise.resolve(null);
      }

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

function setupMongoThrows() {
  mockFindOneAndUpdate.mockRejectedValue(new Error("MongoDB connection failed"));
}

// --- Tests ---

describe("Rate Limiter — Unit Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStore.clear();
  });

  describe("rate limiting enforcement", () => {
    /**
     * Validates: Requirement 9.1
     * After maxRequests calls to /api/auth/login, subsequent calls return allowed=false.
     */
    it("blocks requests after login limit (10/min) is exceeded", async () => {
      setupMongoMock();
      const { checkRateLimit } = await import("@/lib/api/rate-limit");

      const ip = "192.168.1.1";
      const route = "/api/auth/login";

      // Make 10 allowed requests
      for (let i = 0; i < 10; i++) {
        const result = await checkRateLimit(ip, route);
        expect(result.allowed).toBe(true);
      }

      // 11th request should be blocked
      const blocked = await checkRateLimit(ip, route);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    /**
     * Validates: Requirement 9.4
     * When rate limited, retryAfterSeconds is set and positive.
     */
    it("returns retryAfterSeconds when rate limited", async () => {
      setupMongoMock();
      const { checkRateLimit } = await import("@/lib/api/rate-limit");

      const ip = "10.0.0.1";
      const route = "/api/auth/register"; // 5 req/min

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(ip, route);
      }

      const blocked = await checkRateLimit(ip, route);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBeDefined();
      expect(blocked.retryAfterSeconds!).toBeGreaterThan(0);
      expect(blocked.retryAfterSeconds!).toBeLessThanOrEqual(60);
    });
  });

  describe("route-specific limits", () => {
    /**
     * Validates: Requirements 9.1, 9.2, 9.3
     * Different auth routes have different rate limits.
     */
    it("applies different limits per route", async () => {
      setupMongoMock();
      const { checkRateLimit } = await import("@/lib/api/rate-limit");

      const ip = "172.16.0.1";

      // /api/auth/reset-password has the strictest limit: 3/min
      for (let i = 0; i < 3; i++) {
        const result = await checkRateLimit(ip, "/api/auth/reset-password");
        expect(result.allowed).toBe(true);
      }
      const resetBlocked = await checkRateLimit(ip, "/api/auth/reset-password");
      expect(resetBlocked.allowed).toBe(false);

      // /api/auth/register: 5/min — same IP, different route should have its own counter
      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimit(ip, "/api/auth/register");
        expect(result.allowed).toBe(true);
      }
      const registerBlocked = await checkRateLimit(ip, "/api/auth/register");
      expect(registerBlocked.allowed).toBe(false);

      // /api/auth/login: 10/min — same IP, different route
      for (let i = 0; i < 10; i++) {
        const result = await checkRateLimit(ip, "/api/auth/login");
        expect(result.allowed).toBe(true);
      }
      const loginBlocked = await checkRateLimit(ip, "/api/auth/login");
      expect(loginBlocked.allowed).toBe(false);
    });
  });

  describe("in-memory fallback", () => {
    /**
     * Validates: Requirement 10.3
     * When MongoDB throws, the rate limiter falls back to in-memory storage.
     */
    it("falls back to in-memory when MongoDB is unavailable", async () => {
      setupMongoThrows();
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { checkRateLimit } = await import("@/lib/api/rate-limit");

      const ip = "10.10.10.10";
      const route = "/api/auth/register"; // 5 req/min

      // Should still work via in-memory fallback
      const result = await checkRateLimit(ip, route);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);

      // Verify warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("falling back"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    /**
     * Validates: Requirement 10.3
     * In-memory fallback still enforces rate limits correctly.
     */
    it("in-memory fallback enforces limits after MongoDB failure", async () => {
      setupMongoThrows();
      vi.spyOn(console, "warn").mockImplementation(() => {});

      const { checkRateLimit } = await import("@/lib/api/rate-limit");

      const ip = "10.10.10.11";
      const route = "/api/auth/reset-password"; // 3 req/min

      // Exhaust the in-memory limit
      for (let i = 0; i < 3; i++) {
        const result = await checkRateLimit(ip, route);
        expect(result.allowed).toBe(true);
      }

      // 4th request should be blocked even in fallback mode
      const blocked = await checkRateLimit(ip, route);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeDefined();
      expect(blocked.retryAfterSeconds!).toBeGreaterThan(0);
    });
  });

  describe("TTL-based expiry", () => {
    /**
     * Validates: Requirement 10.2
     * When the TTL window expires, counters reset and requests are allowed again.
     */
    it("resets counters after the time window expires", async () => {
      // Use a custom mock that simulates expired entries
      mockFindOneAndUpdate.mockImplementation(
        (
          filter: Record<string, unknown>,
          update: Record<string, unknown>,
          _options: Record<string, unknown>
        ) => {
          const key = filter.key as string;
          const now = new Date();

          if (update.$inc) {
            const entry = mockStore.get(key);
            // If entry exists but is expired, return null (simulates TTL deletion)
            if (entry && entry.expiresAt <= now) {
              mockStore.delete(key);
              return Promise.resolve(null);
            }
            if (entry && entry.expiresAt > now) {
              entry.count += 1;
              return Promise.resolve({
                key,
                count: entry.count,
                expiresAt: entry.expiresAt,
              });
            }
            return Promise.resolve(null);
          }

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

      const { checkRateLimit } = await import("@/lib/api/rate-limit");

      const ip = "192.168.50.1";
      const route = "/api/auth/reset-password"; // 3 req/min

      // Exhaust the limit
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(ip, route);
      }
      const blocked = await checkRateLimit(ip, route);
      expect(blocked.allowed).toBe(false);

      // Simulate TTL expiry by setting expiresAt to the past
      const storeKey = `${ip}:${route}`;
      const entry = mockStore.get(storeKey);
      if (entry) {
        entry.expiresAt = new Date(Date.now() - 1000);
      }

      // After expiry, requests should be allowed again
      const afterExpiry = await checkRateLimit(ip, route);
      expect(afterExpiry.allowed).toBe(true);
      expect(afterExpiry.remaining).toBeGreaterThan(0);
    });
  });
});
