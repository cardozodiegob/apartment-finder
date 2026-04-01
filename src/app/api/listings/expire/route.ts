import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import Listing from "@/lib/db/models/Listing";
import { errorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const now = new Date();
    const result = await Listing.updateMany(
      {
        status: "active",
        expiresAt: { $lt: now, $exists: true },
      },
      { $set: { status: "archived" } }
    );

    return Response.json({
      archived: result.modifiedCount,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
