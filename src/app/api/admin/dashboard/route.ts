import { NextRequest } from "next/server";
import User from "@/lib/db/models/User";
import Listing from "@/lib/db/models/Listing";
import Report from "@/lib/db/models/Report";
import Payment from "@/lib/db/models/Payment";
import { requireAdmin } from "@/lib/api/admin-middleware";
import { errorResponse } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const adminId = url.searchParams.get("adminId") || "";
    await requireAdmin(adminId);

    const [totalUsers, activeListings, pendingReports, recentPayments] = await Promise.all([
      User.countDocuments(),
      Listing.countDocuments({ status: "active" }),
      Report.countDocuments({ status: "pending" }),
      Payment.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
    ]);

    return Response.json({ totalUsers, activeListings, pendingReports, recentPayments });
  } catch (error) {
    return errorResponse(error);
  }
}
