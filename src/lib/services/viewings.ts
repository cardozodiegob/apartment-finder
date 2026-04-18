import dbConnect from "@/lib/db/connection";
import Viewing from "@/lib/db/models/Viewing";
import Listing from "@/lib/db/models/Listing";
import { send as sendNotification } from "@/lib/services/notifications";
import type { IViewing } from "@/lib/db/models/Viewing";

export async function requestViewing(
  seekerId: string,
  listingId: string,
  proposedDate: Date
): Promise<{ viewing: IViewing | null; error: string | null }> {
  try {
    await dbConnect();

    // Validate date is in the future
    if (proposedDate <= new Date()) {
      return { viewing: null, error: "Proposed date must be in the future" };
    }

    // Look up listing to get poster
    const listing = await Listing.findById(listingId);
    if (!listing) return { viewing: null, error: "Listing not found" };

    const posterId = listing.posterId.toString();
    if (posterId === seekerId) {
      return { viewing: null, error: "Cannot request a viewing for your own listing" };
    }

    // Check for duplicate pending request
    const existing = await Viewing.findOne({
      listingId,
      seekerId,
      status: "pending",
    });
    if (existing) {
      return { viewing: null, error: "You already have a pending viewing request for this listing" };
    }

    const viewing = await Viewing.create({
      listingId,
      seekerId,
      posterId,
      proposedDate,
      status: "pending",
    });

    // Notify poster
    await sendNotification({
      userId: posterId,
      type: "listing_status",
      title: "New viewing request",
      body: `A seeker has requested a viewing for "${listing.title}" on ${proposedDate.toLocaleDateString()}`,
      metadata: { viewingId: viewing._id.toString(), listingId },
    });

    return { viewing, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to request viewing";
    return { viewing: null, error: msg };
  }
}

export async function confirmViewing(
  viewingId: string,
  posterId: string
): Promise<{ viewing: IViewing | null; error: string | null }> {
  try {
    await dbConnect();

    const viewing = await Viewing.findById(viewingId);
    if (!viewing) return { viewing: null, error: "Viewing not found" };
    if (viewing.posterId.toString() !== posterId) {
      return { viewing: null, error: "Not authorized to confirm this viewing" };
    }
    if (viewing.status !== "pending") {
      return { viewing: null, error: "Only pending viewings can be confirmed" };
    }

    viewing.status = "confirmed";
    await viewing.save();

    // Notify seeker
    await sendNotification({
      userId: viewing.seekerId.toString(),
      type: "listing_status",
      title: "Viewing confirmed",
      body: `Your viewing request has been confirmed for ${viewing.proposedDate.toLocaleDateString()}`,
      metadata: { viewingId: viewing._id.toString() },
    });

    return { viewing, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to confirm viewing";
    return { viewing: null, error: msg };
  }
}

export async function declineViewing(
  viewingId: string,
  posterId: string,
  reason?: string
): Promise<{ viewing: IViewing | null; error: string | null }> {
  try {
    await dbConnect();

    const viewing = await Viewing.findById(viewingId);
    if (!viewing) return { viewing: null, error: "Viewing not found" };
    if (viewing.posterId.toString() !== posterId) {
      return { viewing: null, error: "Not authorized to decline this viewing" };
    }
    if (viewing.status !== "pending") {
      return { viewing: null, error: "Only pending viewings can be declined" };
    }

    viewing.status = "declined";
    if (reason) viewing.declineReason = reason;
    await viewing.save();

    // Notify seeker
    await sendNotification({
      userId: viewing.seekerId.toString(),
      type: "listing_status",
      title: "Viewing declined",
      body: reason
        ? `Your viewing request was declined: ${reason}`
        : "Your viewing request was declined",
      metadata: { viewingId: viewing._id.toString() },
    });

    return { viewing, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to decline viewing";
    return { viewing: null, error: msg };
  }
}

export async function getViewingsForUser(
  userId: string
): Promise<{ viewings: IViewing[]; error: string | null }> {
  try {
    await dbConnect();
    const viewings = await Viewing.find({
      $or: [{ seekerId: userId }, { posterId: userId }],
    }).sort({ proposedDate: -1 });
    return { viewings, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to get viewings";
    return { viewings: [], error: msg };
  }
}

export async function completeExpiredViewings(): Promise<{ count: number; error: string | null }> {
  try {
    await dbConnect();
    const result = await Viewing.updateMany(
      { status: "confirmed", proposedDate: { $lt: new Date() } },
      { $set: { status: "completed" } }
    );
    return { count: result.modifiedCount, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to complete expired viewings";
    return { count: 0, error: msg };
  }
}
