import { NextRequest } from "next/server";
import Listing from "@/lib/db/models/Listing";
import { requireAdmin } from "@/lib/api/session";
import { logModerationAction } from "@/lib/api/admin-middleware";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = await requireAdmin();
    const listing = await Listing.findById(id);
    if (!listing) throw new ApiErrorResponse("NOT_FOUND", "Listing not found", 404);
    listing.status = "archived";
    await listing.save();
    await logModerationAction(admin.mongoId, "remove_listing", "listing", id, "Removed by admin");
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = await requireAdmin();
    const body = await request.json();
    const listing = await Listing.findById(id);
    if (!listing) throw new ApiErrorResponse("NOT_FOUND", "Listing not found", 404);

    const allowedFields = [
      "title", "description", "monthlyRent", "currency", "status",
      "propertyType", "purpose", "availableDate", "tags",
      "isSharedAccommodation", "currentOccupants", "availableRooms", "isFeatured",
      "scamRiskLevel",
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (listing as Record<string, unknown>)[field] = body[field];
      }
    }
    if (body.address) {
      listing.address = { ...listing.address, ...body.address };
    }

    await listing.save();
    await logModerationAction(admin.mongoId, "edit_listing", "listing", id, body.reason || "Edited by admin");
    return Response.json({ listing });
  } catch (error) {
    return errorResponse(error);
  }
}
