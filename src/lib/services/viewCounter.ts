/**
 * View / inquiry counter helpers. Uses a 24-hour de-duplication window keyed
 * on (listingId, userOrIpHash) to avoid counting refreshes.
 */

import { createHash } from "crypto";
import dbConnect from "@/lib/db/connection";
import Listing from "@/lib/db/models/Listing";
import mongoose, { Schema, type Document, type Model } from "mongoose";

interface IListingView extends Document {
  listingId: mongoose.Types.ObjectId;
  viewerHash: string;
  day: string; // YYYY-MM-DD
}

const ListingViewSchema = new Schema<IListingView>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    viewerHash: { type: String, required: true },
    day: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
ListingViewSchema.index({ listingId: 1, viewerHash: 1, day: 1 }, { unique: true });

const ListingView: Model<IListingView> =
  mongoose.models.ListingView ||
  mongoose.model<IListingView>("ListingView", ListingViewSchema);

function hashViewer(viewer: string): string {
  return createHash("sha256").update(viewer).digest("hex").slice(0, 24);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Records a view, deduplicating against same-day views from the same viewer.
 * Returns true if the counter was incremented.
 */
export async function recordListingView(listingId: string, viewer: string): Promise<boolean> {
  await dbConnect();
  const viewerHash = hashViewer(viewer);
  const day = today();

  try {
    await ListingView.create({ listingId, viewerHash, day });
    await Listing.updateOne({ _id: listingId }, { $inc: { viewCount: 1 } });
    return true;
  } catch (err: unknown) {
    // Duplicate key — already counted today
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
      return false;
    }
    throw err;
  }
}

/** Increment the inquiry counter atomically. */
export async function incrementInquiry(listingId: string): Promise<void> {
  await dbConnect();
  await Listing.updateOne({ _id: listingId }, { $inc: { inquiryCount: 1 } });
}
