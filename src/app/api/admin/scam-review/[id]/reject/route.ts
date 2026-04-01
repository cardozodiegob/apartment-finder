import { NextRequest } from "next/server";
import Listing from "@/lib/db/models/Listing";
import Notification from "@/lib/db/models/Notification";
import { requireAdmin } from "@/lib/api/session";
import { logModerationAction } from "@/lib/api/admin-middleware";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const admin = await requireAdmin();
    const reason = body.reason || "Listing rejected after scam review";

    const listing = await Listing.findByIdAndUpdate(
      id,
      { status: "archived" },
      { new: true }
    );

    if (!listing) {
      throw new ApiErrorResponse("NOT_FOUND", "Listing not found", 404);
    }

    // Notify the poster about the rejection
    await Notification.create({
      userId: listing.posterId,
      type: "listing_status",
      title: "Listing Rejected",
      body: `Your listing "${listing.title}" has been rejected. Reason: ${reason}`,
      metadata: { listingId: id, reason },
    });

    await logModerationAction(
      admin.mongoId,
      "reject_scam_review",
      "listing",
      id,
      reason
    );

    return Response.json({ listing });
  } catch (error) {
    return errorResponse(error);
  }
}
