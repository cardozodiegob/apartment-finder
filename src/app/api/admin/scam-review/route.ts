import Listing from "@/lib/db/models/Listing";
import User from "@/lib/db/models/User";
import { requireAdmin } from "@/lib/api/session";
import { errorResponse } from "@/lib/api/errors";

export async function GET() {
  try {
    await requireAdmin();

    const listings = await Listing.find({
      scamRiskLevel: { $in: ["medium", "high"] },
      status: { $ne: "archived" },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Collect unique poster IDs and look up user info
    const posterIds = [...new Set(listings.map((l) => l.posterId.toString()))];
    const users = await User.find({ _id: { $in: posterIds } })
      .select("fullName trustScore confirmedScamReports createdAt")
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const results = listings.map((listing) => {
      const poster = userMap.get(listing.posterId.toString());
      return {
        ...listing,
        posterInfo: poster
          ? {
              fullName: poster.fullName,
              trustScore: poster.trustScore,
              confirmedScamReports: poster.confirmedScamReports,
              accountCreatedAt: poster.createdAt,
            }
          : null,
      };
    });

    return Response.json({ listings: results });
  } catch (error) {
    return errorResponse(error);
  }
}
