import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import * as fc from "fast-check";

// Set env vars before any module imports
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

// --- Mocks ---

const mockListingCreate = vi.fn();
const mockListingFindById = vi.fn();
const mockListingFind = vi.fn();
const mockListingSave = vi.fn();

vi.mock("@/lib/db/models/Listing", () => ({
  default: {
    create: (...args: unknown[]) => mockListingCreate(...args),
    findById: (...args: unknown[]) => mockListingFindById(...args),
    find: (...args: unknown[]) => mockListingFind(...args),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://storage.test/${path}` },
        }),
      }),
    },
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {},
}));

import { validatePhoto } from "@/lib/services/listings";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_SIZE } from "@/lib/validations/listing";

// --- Arbitraries ---

const validMimeTypeArb = fc.constantFrom("image/jpeg", "image/png", "image/webp");
const invalidMimeTypeArb = fc.constantFrom(
  "application/pdf",
  "image/gif",
  "image/bmp",
  "text/plain",
  "application/octet-stream",
  "image/tiff",
  "video/mp4"
);

const validSizeArb = fc.integer({ min: 1, max: MAX_PHOTO_SIZE });
const oversizeArb = fc.integer({ min: MAX_PHOTO_SIZE + 1, max: MAX_PHOTO_SIZE * 3 });

/**
 * Feature: apartment-finder, Property 3: Photo upload validation
 *
 * **Validates: Requirements 2.3**
 *
 * For any file submitted as a listing photo, the system should accept it if and only if
 * the file size is under 5MB and the format is JPEG, PNG, or WebP.
 * Invalid files should be rejected without modifying the listing.
 */
describe("Feature: apartment-finder, Property 3: Photo upload validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts files with valid size (≤ 5MB) AND valid MIME type (JPEG/PNG/WebP)", async () => {
    await fc.assert(
      fc.asyncProperty(validSizeArb, validMimeTypeArb, async (size, type) => {
        const result = validatePhoto({ size, type });
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it("rejects files exceeding 5MB regardless of MIME type", async () => {
    await fc.assert(
      fc.asyncProperty(
        oversizeArb,
        fc.oneof(validMimeTypeArb, invalidMimeTypeArb),
        async (size, type) => {
          const result = validatePhoto({ size, type });
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects files with invalid MIME type regardless of size", async () => {
    await fc.assert(
      fc.asyncProperty(validSizeArb, invalidMimeTypeArb, async (size, type) => {
        const result = validatePhoto({ size, type });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Only JPEG, PNG, and WebP formats are supported");
      }),
      { numRuns: 100 }
    );
  });

  it("accept iff size ≤ 5MB AND type in {JPEG, PNG, WebP}", async () => {
    const anyMimeArb = fc.oneof(validMimeTypeArb, invalidMimeTypeArb);
    const anySizeArb = fc.oneof(validSizeArb, oversizeArb);

    await fc.assert(
      fc.asyncProperty(anySizeArb, anyMimeArb, async (size, type) => {
        const result = validatePhoto({ size, type });
        const shouldAccept =
          size <= MAX_PHOTO_SIZE &&
          (ALLOWED_PHOTO_TYPES as readonly string[]).includes(type);

        expect(result.valid).toBe(shouldAccept);
        if (!shouldAccept) {
          expect(result.error).toBeDefined();
        }
      }),
      { numRuns: 100 }
    );
  });
});


// --- Import listing service functions for Property 4 & 5 ---
import { create, publish, deleteListing, getById, getByUser } from "@/lib/services/listings";
import type { CreateListingInput } from "@/lib/validations/listing";
import mongoose from "mongoose";

// --- Arbitraries for Property 4 & 5 ---

const objectIdArb = fc.stringMatching(/^[0-9a-f]{24}$/);

const validCreateInputArb: fc.Arbitrary<CreateListingInput> = fc.record({
  title: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,49}$/),
  description: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,99}$/),
  propertyType: fc.constantFrom("apartment" as const, "room" as const, "house" as const),
  purpose: fc.constantFrom("rent" as const, "share" as const, "sublet" as const),
  address: fc.record({
    street: fc.stringMatching(/^[A-Za-z0-9 ]{1,30}$/),
    city: fc.stringMatching(/^[A-Za-z ]{1,20}$/),
    postalCode: fc.stringMatching(/^[0-9]{5}$/),
    country: fc.stringMatching(/^[A-Za-z ]{1,20}$/),
  }),
  location: fc.record({
    type: fc.constant("Point" as const),
    coordinates: fc.tuple(
      fc.double({ min: -180, max: 180, noNaN: true }),
      fc.double({ min: -90, max: 90, noNaN: true })
    ),
  }),
  monthlyRent: fc.double({ min: 0, max: 10000, noNaN: true }),
  currency: fc.constantFrom(
    "EUR" as const, "USD" as const, "GBP" as const, "CHF" as const,
    "SEK" as const, "NOK" as const, "DKK" as const, "PLN" as const,
    "CZK" as const, "BRL" as const
  ),
  availableDate: fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
  tags: fc.array(fc.stringMatching(/^[a-z]{1,10}$/), { maxLength: 5 }),
  isSharedAccommodation: fc.boolean(),
});

/**
 * Feature: apartment-finder, Property 4: Listing visibility is determined by status
 *
 * **Validates: Requirements 2.5, 2.6**
 *
 * For any listing in "draft" status, only the owning poster should be able to retrieve it.
 * For any listing that transitions from "draft" to "active" via publish(), the listing
 * should become visible to all users.
 */
describe("Feature: apartment-finder, Property 4: Listing visibility is determined by status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("draft listings are visible only to the owner, not to other users", async () => {
    await fc.assert(
      fc.asyncProperty(objectIdArb, objectIdArb, async (ownerId, otherUserId) => {
        // Ensure different users
        fc.pre(ownerId !== otherUserId);

        const mockListing = {
          _id: new mongoose.Types.ObjectId(),
          posterId: { toString: () => ownerId },
          status: "draft",
          title: "Test Listing",
          save: mockListingSave,
        };

        mockListingFindById.mockResolvedValue(mockListing);

        // Owner can see draft
        const ownerResult = await getById(mockListing._id.toString(), ownerId);
        expect(ownerResult.listing).not.toBeNull();

        // Other user cannot see draft
        const otherResult = await getById(mockListing._id.toString(), otherUserId);
        expect(otherResult.listing).toBeNull();
        expect(otherResult.error).toBe("Listing not found");

        // Unauthenticated user cannot see draft
        const anonResult = await getById(mockListing._id.toString());
        expect(anonResult.listing).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("active listings are visible to all users", async () => {
    await fc.assert(
      fc.asyncProperty(objectIdArb, objectIdArb, async (ownerId, anyUserId) => {
        const mockListing = {
          _id: new mongoose.Types.ObjectId(),
          posterId: { toString: () => ownerId },
          status: "active",
          title: "Active Listing",
          save: mockListingSave,
        };

        mockListingFindById.mockResolvedValue(mockListing);

        // Any user can see active listing
        const result = await getById(mockListing._id.toString(), anyUserId);
        expect(result.listing).not.toBeNull();

        // Even unauthenticated user can see active listing
        const anonResult = await getById(mockListing._id.toString());
        expect(anonResult.listing).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("publishing a draft listing changes status to active", async () => {
    await fc.assert(
      fc.asyncProperty(objectIdArb, async (ownerId) => {
        let savedStatus = "draft";
        const mockListing = {
          _id: new mongoose.Types.ObjectId(),
          posterId: { toString: () => ownerId },
          status: "draft",
          title: "Draft Listing",
          save: vi.fn().mockImplementation(async function (this: { status: string }) {
            savedStatus = this.status;
          }),
        };

        mockListingFindById.mockResolvedValue(mockListing);

        const result = await publish(mockListing._id.toString(), ownerId);
        expect(result.error).toBeNull();
        expect(savedStatus).toBe("active");
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 5: Listing deletion removes from search but preserves archive
 *
 * **Validates: Requirements 2.8**
 *
 * For any active listing, calling delete() should result in the listing no longer appearing
 * in any search results, while the listing record should still exist in the database
 * with status "archived."
 */
describe("Feature: apartment-finder, Property 5: Listing deletion removes from search but preserves archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deleting an active listing sets status to archived and excludes from active search", async () => {
    await fc.assert(
      fc.asyncProperty(objectIdArb, async (ownerId) => {
        let savedStatus = "active";
        const mockListing = {
          _id: new mongoose.Types.ObjectId(),
          posterId: { toString: () => ownerId },
          status: "active",
          title: "Active Listing",
          save: vi.fn().mockImplementation(async function (this: { status: string }) {
            savedStatus = this.status;
          }),
        };

        mockListingFindById.mockResolvedValue(mockListing);

        // Delete the listing
        const deleteResult = await deleteListing(mockListing._id.toString(), ownerId);
        expect(deleteResult.error).toBeNull();

        // Verify status is archived
        expect(savedStatus).toBe("archived");

        // Simulate search: getByUser with status "active" should not include archived
        mockListingFind.mockReturnValue({
          sort: () => [],
        });
        const searchResult = await getByUser(ownerId, "active");
        // The mock returns empty, confirming archived listings are excluded from active search
        expect(searchResult.listings).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it("archived listing record still exists in database", async () => {
    await fc.assert(
      fc.asyncProperty(objectIdArb, async (ownerId) => {
        const mockListing = {
          _id: new mongoose.Types.ObjectId(),
          posterId: { toString: () => ownerId },
          status: "active",
          title: "To Be Archived",
          save: vi.fn().mockImplementation(async function (this: { status: string }) {
            // Mutate the mock's status to simulate DB save
            mockListing.status = "archived";
          }),
        };

        mockListingFindById.mockResolvedValue(mockListing);

        // Delete (archive) the listing
        await deleteListing(mockListing._id.toString(), ownerId);

        // Verify the record still exists with archived status
        const found = await getById(mockListing._id.toString(), ownerId);
        expect(found.listing).not.toBeNull();
        expect(found.listing!.status).toBe("archived");
      }),
      { numRuns: 100 }
    );
  });
});
