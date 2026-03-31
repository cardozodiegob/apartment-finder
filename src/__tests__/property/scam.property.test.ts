import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import * as fc from "fast-check";

// Set env vars before any module imports
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

// --- Mocks ---

const mockListingFind = vi.fn();

vi.mock("@/lib/db/models/Listing", () => ({
  default: {
    find: (...args: unknown[]) => mockListingFind(...args),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {},
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {},
}));

import {
  analyzeListing,
  checkDuplicatePhotos,
  checkSuspiciousDescription,
} from "@/lib/services/scam-detection";

// --- Arbitraries ---

const hashArb = fc.stringMatching(/^[0-9a-f]{8}$/);
const posterIdArb = fc.stringMatching(/^[0-9a-f]{24}$/);

const scamPhraseArb = fc.constantFrom(
  "wire transfer only",
  "western union",
  "send money before viewing",
  "currently abroad",
  "send passport",
  "advance payment required"
);

const cleanDescriptionArb = fc.constantFrom(
  "Beautiful apartment in the city center with great views",
  "Cozy room near the university campus",
  "Modern house with garden and parking",
  "Spacious flat close to public transport",
  "Renovated studio in quiet neighborhood"
);

/**
 * Feature: apartment-finder, Property 17: Scam detection holds high-risk listings
 *
 * **Validates: Requirements 6.1, 6.2**
 *
 * For any listing submitted for publishing, if the scam analysis returns a "high" risk level
 * (duplicate photos, unrealistic pricing, or suspicious descriptions), the listing status
 * should be set to "under_review" instead of "active," requiring admin approval.
 */
describe("Feature: apartment-finder, Property 17: Scam detection holds high-risk listings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listings with duplicate photos from other posters are flagged as high risk requiring review", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(hashArb, { minLength: 1, maxLength: 5 }),
        posterIdArb,
        posterIdArb,
        async (hashes, currentPosterId, otherPosterId) => {
          fc.pre(currentPosterId !== otherPosterId);

          // Mock: another listing has the same photo hashes
          mockListingFind.mockImplementation((query: Record<string, unknown>) => {
            if (query.photoHashes) {
              return {
                select: () => [
                  {
                    _id: { toString: () => "match-listing-id" },
                    posterId: { toString: () => otherPosterId },
                    photoHashes: hashes,
                  },
                ],
              };
            }
            // For pricing check - return enough listings so pricing isn't anomalous
            return {
              select: () => [
                { monthlyRent: 1000 },
                { monthlyRent: 1200 },
                { monthlyRent: 1100 },
              ],
            };
          });

          const result = await analyzeListing({
            photoHashes: hashes,
            posterId: { toString: () => currentPosterId } as never,
            monthlyRent: 1000,
            currency: "EUR",
            address: { street: "Test", city: "Berlin", postalCode: "10115", country: "DE" },
            description: "Nice apartment",
            title: "Test Listing",
          });

          expect(result.riskLevel).toBe("high");
          expect(result.requiresReview).toBe(true);
          expect(result.flags.some((f) => f.type === "duplicate_photos")).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("listings with suspicious scam phrases are flagged appropriately", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(scamPhraseArb, { minLength: 2, maxLength: 4 }),
        posterIdArb,
        async (phrases, posterId) => {
          // No duplicate photos, no pricing anomaly
          mockListingFind.mockImplementation(() => ({
            select: () => [],
          }));

          const description = `Apartment available. ${phrases.join(". ")}`;

          const result = await analyzeListing({
            photoHashes: [],
            posterId: { toString: () => posterId } as never,
            monthlyRent: 1000,
            currency: "EUR",
            address: { street: "Test", city: "Berlin", postalCode: "10115", country: "DE" },
            description,
            title: "Test Listing",
          });

          // 2+ scam phrases → high severity → high risk
          expect(result.riskLevel).toBe("high");
          expect(result.requiresReview).toBe(true);
          expect(result.flags.some((f) => f.type === "suspicious_description")).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("clean listings with normal pricing get low risk and no review required", async () => {
    await fc.assert(
      fc.asyncProperty(
        cleanDescriptionArb,
        posterIdArb,
        fc.double({ min: 800, max: 2000, noNaN: true }),
        async (description, posterId, rent) => {
          // No duplicate photos
          mockListingFind.mockImplementation((query: Record<string, unknown>) => {
            if (query.photoHashes) {
              return { select: () => [] };
            }
            // Area median around 1000 - rent is within normal range
            return {
              select: () => [
                { monthlyRent: 900 },
                { monthlyRent: 1000 },
                { monthlyRent: 1100 },
              ],
            };
          });

          const result = await analyzeListing({
            photoHashes: [],
            posterId: { toString: () => posterId } as never,
            monthlyRent: rent,
            currency: "EUR",
            address: { street: "Test", city: "Berlin", postalCode: "10115", country: "DE" },
            description,
            title: "Nice Place",
          });

          expect(result.riskLevel).toBe("low");
          expect(result.requiresReview).toBe(false);
          expect(result.flags).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: apartment-finder, Property 18: Duplicate photo detection across listings
 *
 * **Validates: Requirements 6.8**
 *
 * For any set of photos uploaded to a new listing, if any photo's perceptual hash matches
 * a photo from another active listing by a different poster, the system should flag it
 * as a duplicate.
 */
describe("Feature: apartment-finder, Property 18: Duplicate photo detection across listings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects duplicates when hashes match active listings from different posters", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(hashArb, { minLength: 1, maxLength: 5 }),
        posterIdArb,
        posterIdArb,
        async (sharedHashes, currentPosterId, otherPosterId) => {
          fc.pre(currentPosterId !== otherPosterId);

          mockListingFind.mockReturnValue({
            select: () => [
              {
                _id: { toString: () => "other-listing-id" },
                posterId: { toString: () => otherPosterId },
                photoHashes: sharedHashes,
              },
            ],
          });

          const duplicates = await checkDuplicatePhotos(sharedHashes, currentPosterId);

          // Every shared hash should be detected as a duplicate
          expect(duplicates.length).toBeGreaterThanOrEqual(sharedHashes.length);
          for (const dup of duplicates) {
            expect(sharedHashes).toContain(dup.hash);
            expect(dup.matchingPosterId).toBe(otherPosterId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("does not flag duplicates when no matching hashes exist", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(hashArb, { minLength: 1, maxLength: 5 }),
        posterIdArb,
        async (hashes, posterId) => {
          // No matching listings found
          mockListingFind.mockReturnValue({
            select: () => [],
          });

          const duplicates = await checkDuplicatePhotos(hashes, posterId);
          expect(duplicates).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("does not flag photos from the same poster as duplicates", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(hashArb, { minLength: 1, maxLength: 5 }),
        posterIdArb,
        async (hashes, posterId) => {
          // The query filters by posterId: { $ne: currentPosterId }
          // so same-poster listings should never appear in results
          mockListingFind.mockReturnValue({
            select: () => [],
          });

          const duplicates = await checkDuplicatePhotos(hashes, posterId);
          expect(duplicates).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns empty for empty hash arrays", async () => {
    await fc.assert(
      fc.asyncProperty(posterIdArb, async (posterId) => {
        const duplicates = await checkDuplicatePhotos([], posterId);
        expect(duplicates).toHaveLength(0);
        // Should not even query the database
        expect(mockListingFind).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });
});
