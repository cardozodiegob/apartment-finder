import { NextRequest } from "next/server";
import Listing from "@/lib/db/models/Listing";
import { requireAdmin, logModerationAction } from "@/lib/api/admin-middleware";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    await requireAdmin(body.adminId);
    const listing = await Listing.findById(id);
    if (!listing) throw new ApiErrorResponse("NOT_FOUND", "Listing not found", 404);
    listing.status = "active";
    listing.scamRiskLevel = "low";
    await listing.save();
    await logModerationAction(body.adminId, "approve_listing", "listing", id, body.reason || "Approved by admin");
    return Response.json({ listing });
  } catch (error) {
    return errorResponse(error);
  }
}
