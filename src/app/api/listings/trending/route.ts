import dbConnect from "@/lib/db/connection";
import Listing from "@/lib/db/models/Listing";
import { errorResponse } from "@/lib/api/errors";

/**
 * GET /api/listings/trending
 *
 * Returns up to 8 trending active listings, sorted by `trendingScore`
 * (computed daily) falling back to `viewCount` when the score is missing.
 */
export async function GET() {
  try {
    await dbConnect();
    const listings = await Listing.find({ status: "active" })
      .sort({ trendingScore: -1, viewCount: -1, createdAt: -1 })
      .limit(8)
      .lean();

    return Response.json({ listings });
  } catch (error) {
    return errorResponse(error);
  }
}
