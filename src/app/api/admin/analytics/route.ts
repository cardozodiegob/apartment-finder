import { requireAdmin } from "@/lib/api/session";
import { errorResponse } from "@/lib/api/errors";
import dbConnect from "@/lib/db/connection";
import User from "@/lib/db/models/User";
import Listing from "@/lib/db/models/Listing";
import Payment from "@/lib/db/models/Payment";

export async function GET() {
  try {
    await requireAdmin();
    await dbConnect();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      userGrowthRaw,
      listingsByStatusRaw,
      listingsByCountryRaw,
      recentScamFlags,
      totalRevenue,
      avgRentResult,
    ] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Listing.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      Listing.aggregate([
        { $match: { status: "active" } },
        {
          $group: {
            _id: "$address.country",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Listing.countDocuments({
        scamRiskLevel: { $in: ["medium", "high"] },
      }),
      Payment.countDocuments({ status: "completed" }),
      Listing.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: null, avg: { $avg: "$monthlyRent" } } },
      ]),
    ]);

    const userGrowth = userGrowthRaw.map((item: { _id: string; count: number }) => ({
      date: item._id,
      count: item.count,
    }));

    const statusMap: Record<string, number> = { draft: 0, active: 0, under_review: 0, archived: 0 };
    listingsByStatusRaw.forEach((item: { _id: string; count: number }) => {
      if (item._id in statusMap) statusMap[item._id] = item.count;
    });

    const listingsByCountry = listingsByCountryRaw.map((item: { _id: string; count: number }) => ({
      country: item._id || "Unknown",
      count: item.count,
    }));

    const averageRent = avgRentResult.length > 0 ? Math.round(avgRentResult[0].avg) : 0;

    return Response.json({
      userGrowth,
      listingsByStatus: statusMap,
      listingsByCountry,
      recentScamFlags,
      totalRevenue,
      averageRent,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
