import { NextRequest } from "next/server";
import Listing from "@/lib/db/models/Listing";
import { send } from "@/lib/services/notifications";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { seekerId, message } = body;

    if (!seekerId) throw new ApiErrorResponse("VALIDATION_ERROR", "seekerId is required", 400);

    const listing = await Listing.findById(id);
    if (!listing) throw new ApiErrorResponse("NOT_FOUND", "Listing not found", 404);
    if (!listing.isSharedAccommodation) {
      throw new ApiErrorResponse("INVALID_REQUEST", "This listing is not a shared accommodation", 400);
    }

    // Notify the poster
    await send({
      userId: listing.posterId.toString(),
      type: "roommate_request",
      title: "New Roommate Request",
      body: message || "Someone is interested in your shared accommodation listing.",
      metadata: { listingId: id, seekerId },
    });

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
