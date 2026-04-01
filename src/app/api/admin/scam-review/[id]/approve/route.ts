import { NextRequest } from "next/server";
import Listing from "@/lib/db/models/Listing";
import { requireAdmin } from "@/lib/api/session";
import { logModerationAction } from "@/lib/api/admin-middleware";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireAdmin();

    const listing = await Listing.findByIdAndUpdate(
      id,
      { status: "active", scamRiskLevel: "low" },
      { new: true }
    );

    if (!listing) {
      throw new ApiErrorResponse("NOT_FOUND", "Listing not found", 404);
    }

    await logModerationAction(
      admin.mongoId,
      "approve_scam_review",
      "listing",
      id,
      "Approved after scam review"
    );

    return Response.json({ listing });
  } catch (error) {
    return errorResponse(error);
  }
}
