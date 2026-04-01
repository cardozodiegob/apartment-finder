import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import Listing from "@/lib/db/models/Listing";
import { requireActiveUser } from "@/lib/api/session";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser();
    await dbConnect();
    const { id } = await params;

    const listing = await Listing.findById(id);
    if (!listing) {
      throw new ApiErrorResponse("NOT_FOUND", "Listing not found", 404);
    }
    if (listing.posterId.toString() !== user.mongoId) {
      throw new ApiErrorResponse("FORBIDDEN", "Not authorized to renew this listing", 403);
    }

    const now = new Date();
    listing.expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    listing.renewedAt = now;
    await listing.save();

    return Response.json({
      listing: {
        id: listing._id.toString(),
        expiresAt: listing.expiresAt,
        renewedAt: listing.renewedAt,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
