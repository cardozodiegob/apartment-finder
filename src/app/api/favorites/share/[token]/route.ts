import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import FavoriteShare from "@/lib/db/models/FavoriteShare";
import Favorite from "@/lib/db/models/Favorite";
import Listing from "@/lib/db/models/Listing";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

/**
 * GET /api/favorites/share/[token]
 *
 * Public read-only endpoint that resolves a share token into its folder's
 * favorited listings. No auth required — the token is the capability.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    await dbConnect();
    const { token } = await params;

    const share = await FavoriteShare.findOne({ token });
    if (!share) {
      throw new ApiErrorResponse("NOT_FOUND", "Share not found", 404);
    }
    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new ApiErrorResponse("GONE", "Share link expired", 410);
    }

    const favorites = await Favorite.find({
      userId: share.userId,
      folderName: share.folderName,
    }).lean();
    const listingIds = favorites.map((f) => f.listingId);

    const listings = await Listing.find({
      _id: { $in: listingIds },
      status: { $ne: "draft" },
    }).lean();

    return Response.json({
      folderName: share.folderName,
      listings,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
