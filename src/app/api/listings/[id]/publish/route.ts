import { NextRequest } from "next/server";
import { publish } from "@/lib/services/listings";
import { analyzeListing } from "@/lib/services/scam-detection";
import { requireActiveUser } from "@/lib/api/session";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import Listing from "@/lib/db/models/Listing";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser();

    const { id } = await params;

    // First publish (draft → active)
    const result = await publish(id, user.mongoId);
    if (result.error) {
      const status = result.error.includes("Not authorized") ? 403 : 400;
      throw new ApiErrorResponse("PUBLISH_FAILED", result.error, status);
    }

    // Run scam detection on the published listing
    const listing = result.listing!;
    const scamResult = await analyzeListing(listing);

    // If high risk, set to under_review instead of active
    if (scamResult.requiresReview) {
      await Listing.findByIdAndUpdate(id, {
        status: "under_review",
        scamRiskLevel: scamResult.riskLevel,
      });

      return Response.json({
        listing: { ...listing.toObject?.() ?? listing, status: "under_review", scamRiskLevel: scamResult.riskLevel },
        scamAnalysis: scamResult,
        message: "Your listing is under review and will be published after approval",
      });
    }

    // Update scam risk level even for low/medium
    if (scamResult.riskLevel !== "low") {
      await Listing.findByIdAndUpdate(id, {
        scamRiskLevel: scamResult.riskLevel,
      });
    }

    return Response.json({
      listing: result.listing,
      scamAnalysis: scamResult,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
