import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchParamsSchema } from "@/lib/services/search";

/**
 * Unit tests for search timeout and pagination
 * Validates: Requirements 14.2, 14.3, 14.4
 */

// --- Mock Listing model with chainable query methods ---

const mockListings: Array<{ _id: string; title: string }> = [];
let capturedLimit: number | undefined;
let capturedMaxTimeMS: number | undefined;

function createChainable(resolveValue: unknown) {
  const chain: Record<string, unknown> = {};
  chain.sort = vi.fn().mockReturnValue(chain);
  chain.skip = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn((n: number) => {
    capturedLimit = n;
    return chain;
  });
  chain.maxTimeMS = vi.fn((ms: number) => {
    capturedMaxTimeMS = ms;
    return Promise.resolve(resolveValue);
  });
  return chain;
}

const mockFind = vi.fn();
const mockCountDocuments = vi.fn();

vi.mock("@/lib/db/models/Listing", () => ({
  default: {
    find: (...args: unknown[]) => mockFind(...args),
    countDocuments: (...args: unknown[]) => mockCountDocuments(...args),
  },
}));

// --- Tests ---

describe("Search — Unit Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    capturedLimit = undefined;
    capturedMaxTimeMS = undefined;
  });

  describe("searchParamsSchema validation", () => {
    /**
     * Validates: Requirement 14.3
     * The schema rejects limit values greater than 100.
     */
    it("rejects limit > 100", () => {
      const result = searchParamsSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    /**
     * Validates: Requirement 14.3
     * The schema accepts limit = 100 (the maximum allowed).
     */
    it("accepts limit = 100", () => {
      const result = searchParamsSchema.safeParse({ limit: 100 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
      }
    });

    /**
     * Validates: Requirement 14.4
     * The schema accepts an optional cursor parameter for cursor-based pagination.
     */
    it("accepts cursor parameter", () => {
      const result = searchParamsSchema.safeParse({
        cursor: "507f1f77bcf86cd799439011",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cursor).toBe("507f1f77bcf86cd799439011");
      }
    });
  });

  describe("search function behavior", () => {
    /**
     * Validates: Requirement 14.3
     * The search function caps the effective limit at 100 via Math.min.
     */
    it("caps limit at 100 even if a larger value is passed", async () => {
      const fakeListing = { _id: "abc123", title: "Test" };
      const findChain = createChainable([fakeListing]);
      mockFind.mockReturnValue(findChain);

      const countChain: Record<string, unknown> = {};
      countChain.maxTimeMS = vi.fn().mockResolvedValue(1);
      mockCountDocuments.mockReturnValue(countChain);

      const { search } = await import("@/lib/services/search");

      // Pass limit=200 directly to the search function (bypassing schema)
      await search({ page: 1, limit: 200 });

      // The chain's .limit() should have been called with 100 (capped)
      expect(capturedLimit).toBe(100);
    });

    /**
     * Validates: Requirement 14.2
     * When MongoDB throws a timeout error, search returns { timeout: true }.
     */
    it("returns timeout: true when MongoDB throws a timeout error", async () => {
      const timeoutError = new Error("operation exceeded time limit");

      const findChain: Record<string, unknown> = {};
      findChain.sort = vi.fn().mockReturnValue(findChain);
      findChain.skip = vi.fn().mockReturnValue(findChain);
      findChain.limit = vi.fn().mockReturnValue(findChain);
      findChain.maxTimeMS = vi.fn().mockRejectedValue(timeoutError);
      mockFind.mockReturnValue(findChain);

      const countChain: Record<string, unknown> = {};
      countChain.maxTimeMS = vi.fn().mockRejectedValue(timeoutError);
      mockCountDocuments.mockReturnValue(countChain);

      const { search } = await import("@/lib/services/search");

      const result = await search({ page: 1, limit: 20 });

      expect(result.timeout).toBe(true);
      expect(result.listings).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    /**
     * Validates: Requirement 14.4
     * Search returns a cursor (last listing _id) for cursor-based pagination.
     */
    it("returns cursor as last listing _id in results", async () => {
      const fakeListings = [
        { _id: "id1", title: "First" },
        { _id: "id2", title: "Second" },
        { _id: "id3", title: "Third" },
      ];

      const findChain = createChainable(fakeListings);
      mockFind.mockReturnValue(findChain);

      const countChain: Record<string, unknown> = {};
      countChain.maxTimeMS = vi.fn().mockResolvedValue(3);
      mockCountDocuments.mockReturnValue(countChain);

      const { search } = await import("@/lib/services/search");

      const result = await search({ page: 1, limit: 20 });

      expect(result.cursor).toBe("id3");
      expect(result.listings).toEqual(fakeListings);
      expect(result.totalCount).toBe(3);
    });
  });
});
