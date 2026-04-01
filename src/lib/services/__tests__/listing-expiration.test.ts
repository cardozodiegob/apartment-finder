import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for listing expiration
 * Validates: Requirements 18.1, 18.3, 18.4
 */

// --- Mock Listing model ---

const mockFind = vi.fn();
const mockCountDocuments = vi.fn();
const mockFindById = vi.fn();

vi.mock("@/lib/db/models/Listing", () => ({
  default: {
    find: (...args: unknown[]) => mockFind(...args),
    countDocuments: (...args: unknown[]) => mockCountDocuments(...args),
    findById: (...args: unknown[]) => mockFindById(...args),
  },
}));

vi.mock("@/lib/services/notifications", () => ({
  send: vi.fn().mockResolvedValue({ notification: {}, error: null }),
}));

// --- Helpers ---

function createChainable(resolveValue: unknown) {
  const chain: Record<string, unknown> = {};
  chain.sort = vi.fn().mockReturnValue(chain);
  chain.skip = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.maxTimeMS = vi.fn().mockResolvedValue(resolveValue);
  return chain;
}

// --- Tests ---

describe("Listing Expiration — Unit Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Expired listings excluded from search", () => {
    /**
     * Validates: Requirement 18.4
     * The buildQuery in search.ts adds an $or filter for expiresAt
     * so that expired listings are excluded from results.
     */
    it("search query includes expiresAt filter to exclude expired listings", async () => {
      const findChain = createChainable([]);
      mockFind.mockReturnValue(findChain);

      const countChain: Record<string, unknown> = {};
      countChain.maxTimeMS = vi.fn().mockResolvedValue(0);
      mockCountDocuments.mockReturnValue(countChain);

      const { search } = await import("@/lib/services/search");

      await search({ page: 1, limit: 20 });

      // Verify the query passed to find() includes the $or expiresAt filter
      const query = mockFind.mock.calls[0][0];
      expect(query.status).toBe("active");
      expect(query.$or).toBeDefined();
      expect(query.$or).toHaveLength(2);

      // First condition: expiresAt > now
      expect(query.$or[0]).toHaveProperty("expiresAt");
      expect(query.$or[0].expiresAt).toHaveProperty("$gt");
      expect(query.$or[0].expiresAt.$gt).toBeInstanceOf(Date);

      // Second condition: expiresAt doesn't exist (legacy listings)
      expect(query.$or[1]).toHaveProperty("expiresAt");
      expect(query.$or[1].expiresAt).toHaveProperty("$exists", false);
    });

    /**
     * Validates: Requirement 18.4
     * The count query also includes the expiresAt filter.
     */
    it("count query also excludes expired listings", async () => {
      const findChain = createChainable([]);
      mockFind.mockReturnValue(findChain);

      const countChain: Record<string, unknown> = {};
      countChain.maxTimeMS = vi.fn().mockResolvedValue(0);
      mockCountDocuments.mockReturnValue(countChain);

      const { search } = await import("@/lib/services/search");

      await search({ page: 1, limit: 20 });

      const countQuery = mockCountDocuments.mock.calls[0][0];
      expect(countQuery.$or).toBeDefined();
      expect(countQuery.$or).toHaveLength(2);
    });
  });

  describe("Renewal resets expiration timer", () => {
    /**
     * Validates: Requirement 18.3
     * Renewing a listing sets expiresAt to ~90 days from now and sets renewedAt.
     */
    it("renewListing sets expiresAt to 90 days from now and sets renewedAt", async () => {
      const now = Date.now();
      const mockListing = {
        _id: "listing123",
        posterId: { toString: () => "user456" },
        expiresAt: new Date(now - 1000), // expired
        renewedAt: undefined as Date | undefined,
        save: vi.fn().mockResolvedValue(undefined),
      };
      mockFindById.mockResolvedValue(mockListing);

      const { renewListing } = await import("@/lib/services/listing-expiration");

      const result = await renewListing("listing123", "user456");

      expect(result.error).toBeNull();
      expect(result.listing).toBeTruthy();
      expect(mockListing.save).toHaveBeenCalled();

      // expiresAt should be approximately 90 days from now
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      const expectedExpiry = now + ninetyDaysMs;
      const actualExpiry = mockListing.expiresAt!.getTime();
      // Allow 5 seconds tolerance for test execution time
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(5000);

      // renewedAt should be set to approximately now
      expect(mockListing.renewedAt).toBeInstanceOf(Date);
      expect(Math.abs(mockListing.renewedAt!.getTime() - now)).toBeLessThan(5000);
    });

    /**
     * Validates: Requirement 18.3
     * Renewal fails if the user is not the listing owner.
     */
    it("renewListing rejects non-owner", async () => {
      const mockListing = {
        _id: "listing123",
        posterId: { toString: () => "user456" },
        save: vi.fn(),
      };
      mockFindById.mockResolvedValue(mockListing);

      const { renewListing } = await import("@/lib/services/listing-expiration");

      const result = await renewListing("listing123", "differentUser");

      expect(result.error).toBe("Not authorized to renew this listing");
      expect(result.listing).toBeNull();
      expect(mockListing.save).not.toHaveBeenCalled();
    });

    /**
     * Validates: Requirement 18.3
     * Renewal fails if the listing doesn't exist.
     */
    it("renewListing returns error for non-existent listing", async () => {
      mockFindById.mockResolvedValue(null);

      const { renewListing } = await import("@/lib/services/listing-expiration");

      const result = await renewListing("nonexistent", "user456");

      expect(result.error).toBe("Listing not found");
      expect(result.listing).toBeNull();
    });
  });

  describe("isExpired helper", () => {
    /**
     * Validates: Requirement 18.1
     */
    it("returns true for listings past their expiresAt date", async () => {
      const { isExpired } = await import("@/lib/services/listing-expiration");

      const expiredListing = {
        expiresAt: new Date(Date.now() - 1000),
      } as never;

      expect(isExpired(expiredListing)).toBe(true);
    });

    it("returns false for listings not yet expired", async () => {
      const { isExpired } = await import("@/lib/services/listing-expiration");

      const activeListing = {
        expiresAt: new Date(Date.now() + 86400000),
      } as never;

      expect(isExpired(activeListing)).toBe(false);
    });

    it("returns false for listings without expiresAt (legacy)", async () => {
      const { isExpired } = await import("@/lib/services/listing-expiration");

      const legacyListing = {} as never;

      expect(isExpired(legacyListing)).toBe(false);
    });
  });
});
