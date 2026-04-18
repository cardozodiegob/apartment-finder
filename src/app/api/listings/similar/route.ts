import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import Listing from "@/lib/db/models/Listing";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

/**
 * GET /api/listings/similar?listingId=<id>
 *
 * Returns up to 6 listings that share:
 *   - the same city
 *   - the same property type
 *   - a monthly rent within ±30% of the seed listing
 * excluding the seed listing itself.
 *
 * Used for the "Similar listings" strip on the listing detail page.
 */
export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const listingId = req.nextUrl.searchParams.get("listingId");
    if (!listingId) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "listingId is required", 400);
    }

    const seed = await Listing.findById(listingId).lean<{
      _id: unknown;
      address?: { city?: string };
      propertyType?: string;
      monthlyRent?: number;
      currency?: string;
    }>();

    if (!seed) {
      return Response.json({ listings: [] });
    }

    const city = seed.address?.city;
    const type = seed.propertyType;
    const rent = seed.monthlyRent ?? 0;

    if (!city || !type) return Response.json({ listings: [] });

    const lower = rent * 0.7;
    const upper = rent * 1.3;

    const results = await Listing.find({
      _id: { $ne: seed._id },
      status: "active",
      "address.city": city,
      propertyType: type,
      monthlyRent: { $gte: lower, $lte: upper },
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    return Response.json({ listings: results });
  } catch (error) {
    return errorResponse(error);
  }
}
