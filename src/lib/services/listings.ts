import Listing from "@/lib/db/models/Listing";
import type { IListing } from "@/lib/db/models/Listing";
import { supabaseAdmin } from "@/lib/supabase/server";
import { LISTING_PHOTOS_BUCKET } from "@/lib/supabase/storage";
import {
  createListingSchema,
  updateListingSchema,
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_SIZE,
} from "@/lib/validations/listing";
import type { CreateListingInput, UpdateListingInput } from "@/lib/validations/listing";

// --- Types ---

export interface ListingServiceResult {
  listing: IListing | null;
  error: string | null;
}

export interface PhotoUploadResult {
  urls: string[];
  hashes: string[];
  error: string | null;
}

export interface PhotoFile {
  name: string;
  size: number;
  type: string;
  buffer: Buffer;
}

// --- Simple perceptual hash (simulated) ---

/**
 * Generate a simple hash for a photo buffer.
 * In production this would use a real pHash library;
 * here we use a deterministic hex digest based on buffer content.
 */
export function generatePhotoHash(buffer: Buffer): string {
  let hash = 0;
  for (let i = 0; i < buffer.length; i++) {
    hash = ((hash << 5) - hash + buffer[i]) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

// --- Photo validation ---

export function validatePhoto(file: { size: number; type: string }): {
  valid: boolean;
  error?: string;
} {
  if (file.size > MAX_PHOTO_SIZE) {
    return { valid: false, error: "Photo must be under 5MB" };
  }
  if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return { valid: false, error: "Only JPEG, PNG, and WebP formats are supported" };
  }
  return { valid: true };
}

// --- Listing Service ---

export async function create(
  data: CreateListingInput,
  userId: string
): Promise<ListingServiceResult> {
  const parsed = createListingSchema.safeParse(data);
  if (!parsed.success) {
    return { listing: null, error: parsed.error.errors[0].message };
  }

  try {
    const listing = await Listing.create({
      ...parsed.data,
      posterId: userId,
      status: "draft",
      photos: [],
      photoHashes: [],
    });
    return { listing, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create listing";
    return { listing: null, error: msg };
  }
}

export async function update(
  listingId: string,
  data: UpdateListingInput,
  userId: string
): Promise<ListingServiceResult> {
  const parsed = updateListingSchema.safeParse(data);
  if (!parsed.success) {
    return { listing: null, error: parsed.error.errors[0].message };
  }

  try {
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return { listing: null, error: "Listing not found" };
    }
    if (listing.posterId.toString() !== userId) {
      return { listing: null, error: "Not authorized to update this listing" };
    }

    Object.assign(listing, parsed.data);
    await listing.save();
    return { listing, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update listing";
    return { listing: null, error: msg };
  }
}


export async function publish(
  listingId: string,
  userId: string
): Promise<ListingServiceResult> {
  try {
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return { listing: null, error: "Listing not found" };
    }
    if (listing.posterId.toString() !== userId) {
      return { listing: null, error: "Not authorized to publish this listing" };
    }
    if (listing.status !== "draft") {
      return { listing: null, error: "Only draft listings can be published" };
    }

    listing.status = "active";
    await listing.save();
    return { listing, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to publish listing";
    return { listing: null, error: msg };
  }
}

export async function deleteListing(
  listingId: string,
  userId: string
): Promise<{ error: string | null }> {
  try {
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return { error: "Listing not found" };
    }
    if (listing.posterId.toString() !== userId) {
      return { error: "Not authorized to delete this listing" };
    }

    listing.status = "archived";
    await listing.save();
    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete listing";
    return { error: msg };
  }
}

export async function getById(
  listingId: string,
  requestingUserId?: string
): Promise<ListingServiceResult> {
  try {
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return { listing: null, error: "Listing not found" };
    }

    // Draft listings are only visible to the owner
    if (listing.status === "draft") {
      if (!requestingUserId || listing.posterId.toString() !== requestingUserId) {
        return { listing: null, error: "Listing not found" };
      }
    }

    return { listing, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to get listing";
    return { listing: null, error: msg };
  }
}

export async function getByUser(
  userId: string,
  status?: string
): Promise<{ listings: IListing[]; error: string | null }> {
  try {
    const query: Record<string, unknown> = { posterId: userId };
    if (status) {
      query.status = status;
    }
    const listings = await Listing.find(query).sort({ createdAt: -1 });
    return { listings, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to get listings";
    return { listings: [], error: msg };
  }
}

export async function uploadPhotos(
  listingId: string,
  userId: string,
  files: PhotoFile[]
): Promise<PhotoUploadResult> {
  // Validate all files first
  for (const file of files) {
    const validation = validatePhoto(file);
    if (!validation.valid) {
      return { urls: [], hashes: [], error: validation.error! };
    }
  }

  try {
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return { urls: [], hashes: [], error: "Listing not found" };
    }
    if (listing.posterId.toString() !== userId) {
      return { urls: [], hashes: [], error: "Not authorized to upload photos to this listing" };
    }

    const urls: string[] = [];
    const hashes: string[] = [];

    for (const file of files) {
      const hash = generatePhotoHash(file.buffer);
      const filePath = `${listingId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(LISTING_PHOTOS_BUCKET)
        .upload(filePath, file.buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        return { urls: [], hashes: [], error: `Failed to upload ${file.name}: ${uploadError.message}` };
      }

      const { data: urlData } = supabaseAdmin.storage
        .from(LISTING_PHOTOS_BUCKET)
        .getPublicUrl(filePath);

      urls.push(urlData.publicUrl);
      hashes.push(hash);
    }

    // Update listing with new photos
    listing.photos.push(...urls);
    listing.photoHashes.push(...hashes);
    await listing.save();

    return { urls, hashes, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to upload photos";
    return { urls: [], hashes: [], error: msg };
  }
}
