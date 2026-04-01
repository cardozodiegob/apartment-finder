import { NextRequest } from "next/server";
import { requireActiveUser } from "@/lib/api/session";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import dbConnect from "@/lib/db/connection";
import Listing from "@/lib/db/models/Listing";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;
    const body = await request.json();

    const { monthlyRent, currency } = body;
    if (typeof monthlyRent !== "number" || monthlyRent < 0) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "monthlyRent must be a non-negative number", 400);
    }

    await dbConnect();
    const listing = await Listing.findById(id);
    if (!listing) {
      throw new ApiErrorResponse("NOT_FOUND", "Listing not found", 404);
    }
    if (listing.posterId.toString() !== user.mongoId) {
      throw new ApiErrorResponse("FORBIDDEN", "Not authorized to update this listing", 403);
    }

    // Push old price to history
    listing.priceHistory.push({
      price: listing.monthlyRent,
      currency: listing.currency,
      changedAt: new Date(),
    });

    listing.monthlyRent = monthlyRent;
    if (currency) {
      listing.currency = currency;
    }

    await listing.save();

    return Response.json({ listing });
  } catch (error) {
    return errorResponse(error);
  }
}
