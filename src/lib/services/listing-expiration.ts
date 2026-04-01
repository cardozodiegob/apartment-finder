import Listing from "@/lib/db/models/Listing";
import type { IListing } from "@/lib/db/models/Listing";
import { send } from "@/lib/services/notifications";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Renew a listing by resetting its expiresAt to now + 90 days.
 */
export async function renewListing(
  listingId: string,
  userId: string
): Promise<{ listing: IListing | null; error: string | null }> {
  try {
    const listing = await Listing.findById(listingId);
    if (!listing) return { listing: null, error: "Listing not found" };
    if (listing.posterId.toString() !== userId) {
      return { listing: null, error: "Not authorized to renew this listing" };
    }

    const now = new Date();
    listing.expiresAt = new Date(now.getTime() + NINETY_DAYS_MS);
    listing.renewedAt = now;
    await listing.save();

    return { listing, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to renew listing";
    return { listing: null, error: msg };
  }
}

/**
 * Find listings expiring within 7 days and send notifications to their posters.
 * Returns the number of notifications sent.
 */
export async function sendExpiryNotifications(): Promise<{
  notified: number;
  error: string | null;
}> {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const expiringListings = await Listing.find({
      status: "active",
      expiresAt: {
        $gt: now,
        $lte: sevenDaysFromNow,
      },
    });

    let notified = 0;
    for (const listing of expiringListings) {
      const daysLeft = Math.ceil(
        (listing.expiresAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      await send({
        userId: listing.posterId.toString(),
        type: "listing_status",
        title: "Listing Expiring Soon",
        body: `Your listing "${listing.title}" will expire in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Renew it to keep it visible in search results.`,
        metadata: { listingId: listing._id.toString(), daysLeft },
      });
      notified++;
    }

    return { notified, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send expiry notifications";
    return { notified: 0, error: msg };
  }
}

/**
 * Check if a listing is expired based on its expiresAt field.
 */
export function isExpired(listing: IListing): boolean {
  if (!listing.expiresAt) return false;
  return listing.expiresAt.getTime() < Date.now();
}
