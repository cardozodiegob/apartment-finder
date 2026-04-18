import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api/session";
import dbConnect from "@/lib/db/connection";
import Listing, { VERIFICATION_TIERS } from "@/lib/db/models/Listing";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

/**
 * POST /api/admin/listings/[id]/verify
 * Body: { tier: "docs" | "photo_tour" | "in_person" | "none", notes?: string }
 *
 * Sets the verification tier on a listing. Also bumps `verifiedAt` and
 * `verifiedBy` when the tier is elevated to anything other than "none".
 * Admin-only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    await dbConnect();

    const { id } = await params;
    const { tier, notes } = (await req.json()) as { tier?: string; notes?: string };

    if (!tier || !VERIFICATION_TIERS.includes(tier as never)) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "tier is required", 400);
    }

    const listing = await Listing.findById(id);
    if (!listing) throw new ApiErrorResponse("NOT_FOUND", "Listing not found", 404);

    listing.verificationTier = tier as typeof listing.verificationTier;
    if (tier !== "none") {
      listing.verifiedAt = new Date();
      listing.verifiedBy = admin._id as unknown as typeof listing.verifiedBy;
    } else {
      listing.verifiedAt = undefined;
      listing.verifiedBy = undefined;
    }
    await listing.save();

    // Best-effort audit log
    try {
      const { default: AuditLog } = await import("@/lib/db/models/AuditLog");
      await AuditLog.create({
        actorId: admin.mongoId,
        action: "listing.verify",
        entityType: "listing",
        entityId: listing._id,
        diff: { tier, notes },
      });
    } catch { /* model may not exist — ignore */ }

    return Response.json({ listing });
  } catch (error) {
    return errorResponse(error);
  }
}
