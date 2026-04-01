import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for favorites service
 * Validates: Requirements 15.1, 15.2, 15.3
 */

// --- Mocks ---

vi.mock("@/lib/db/connection", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

const mockUpdateOne = vi.fn();
const mockDeleteOne = vi.fn();
const mockFind = vi.fn();
const mockFindOne = vi.fn();

vi.mock("@/lib/db/models/Favorite", () => ({
  default: {
    updateOne: (...args: unknown[]) => mockUpdateOne(...args),
    deleteOne: (...args: unknown[]) => mockDeleteOne(...args),
    find: (...args: unknown[]) => mockFind(...args),
    findOne: (...args: unknown[]) => mockFindOne(...args),
  },
}));

// --- Tests ---

describe("Favorites Service — Unit Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Validates: Requirement 15.1
   * Adding a favorite stores the listing reference.
   */
  it("addFavorite creates a favorite entry", async () => {
    mockUpdateOne.mockResolvedValue({ upsertedCount: 1 });

    const { addFavorite } = await import("@/lib/services/favorites");
    const result = await addFavorite("user1", "listing1");

    expect(result.error).toBeNull();
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { userId: "user1", listingId: "listing1" },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          userId: "user1",
          listingId: "listing1",
        }),
      }),
      { upsert: true }
    );
  });

  /**
   * Validates: Requirement 15.1
   * Duplicate favorite is idempotent — no error on second add.
   */
  it("addFavorite is idempotent for duplicate entries", async () => {
    mockUpdateOne.mockResolvedValue({ upsertedCount: 0, matchedCount: 1 });

    const { addFavorite } = await import("@/lib/services/favorites");
    const result = await addFavorite("user1", "listing1");

    expect(result.error).toBeNull();
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
  });

  /**
   * Validates: Requirement 15.2
   * Removing a favorite deletes the entry.
   */
  it("removeFavorite deletes the favorite entry", async () => {
    mockDeleteOne.mockResolvedValue({ deletedCount: 1 });

    const { removeFavorite } = await import("@/lib/services/favorites");
    const result = await removeFavorite("user1", "listing1");

    expect(result.error).toBeNull();
    expect(mockDeleteOne).toHaveBeenCalledWith({
      userId: "user1",
      listingId: "listing1",
    });
  });

  /**
   * Validates: Requirement 15.2
   * Removing a non-existent favorite does not error.
   */
  it("removeFavorite succeeds even if favorite does not exist", async () => {
    mockDeleteOne.mockResolvedValue({ deletedCount: 0 });

    const { removeFavorite } = await import("@/lib/services/favorites");
    const result = await removeFavorite("user1", "nonexistent");

    expect(result.error).toBeNull();
  });

  /**
   * Validates: Requirement 15.3
   * getFavorites returns favorites sorted by savedAt desc.
   */
  it("getFavorites returns user favorites", async () => {
    const fakeFavorites = [
      { userId: "user1", listingId: "listing2", savedAt: new Date("2024-02-01") },
      { userId: "user1", listingId: "listing1", savedAt: new Date("2024-01-01") },
    ];
    mockFind.mockReturnValue({
      sort: vi.fn().mockResolvedValue(fakeFavorites),
    });

    const { getFavorites } = await import("@/lib/services/favorites");
    const result = await getFavorites("user1");

    expect(result.error).toBeNull();
    expect(result.favorites).toEqual(fakeFavorites);
    expect(mockFind).toHaveBeenCalledWith({ userId: "user1" });
  });

  /**
   * Validates: Requirement 15.1
   * isFavorited returns true when a favorite exists.
   */
  it("isFavorited returns true when favorite exists", async () => {
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ userId: "user1", listingId: "listing1" }),
    });

    const { isFavorited } = await import("@/lib/services/favorites");
    const result = await isFavorited("user1", "listing1");

    expect(result).toBe(true);
  });

  /**
   * Validates: Requirement 15.1
   * isFavorited returns false when no favorite exists.
   */
  it("isFavorited returns false when favorite does not exist", async () => {
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const { isFavorited } = await import("@/lib/services/favorites");
    const result = await isFavorited("user1", "listing999");

    expect(result).toBe(false);
  });

  /**
   * Validates: Requirement 15.1
   * addFavorite returns error on database failure.
   */
  it("addFavorite returns error on database failure", async () => {
    mockUpdateOne.mockRejectedValue(new Error("DB connection lost"));

    const { addFavorite } = await import("@/lib/services/favorites");
    const result = await addFavorite("user1", "listing1");

    expect(result.error).toBe("DB connection lost");
  });
});
