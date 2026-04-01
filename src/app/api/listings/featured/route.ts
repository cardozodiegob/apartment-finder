import Listing from "@/lib/db/models/Listing";
import dbConnect from "@/lib/db/connection";
import { errorResponse } from "@/lib/api/errors";

export async function GET() {
  try {
    await dbConnect();
    let listings = await Listing.find({
      isFeatured: true,
      status: { $in: ["active", "under_review"] },
    })
      .sort({ createdAt: -1 })
      .limit(6);

    // Fallback: if no featured listings, return the 6 most recent active listings
    if (listings.length === 0) {
      listings = await Listing.find({ status: "active" })
        .sort({ createdAt: -1 })
        .limit(6);
    }

    return Response.json({ listings });
  } catch (error) {
    return errorResponse(error);
  }
}
