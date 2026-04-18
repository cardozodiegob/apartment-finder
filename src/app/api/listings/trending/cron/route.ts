import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import Listing from "@/lib/db/models/Listing";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

/**
 * POST /api/listings/trending/cron
 *
 * Recomputes `trendingScore` for every active listing. Intended to be called
 * once per day by a scheduler (Vercel Cron, GitHub Actions, etc.).
 *
 * Trending score =
 *   log10(viewCount + 1) * 10 + inquiryCount * 2 − ageInDays * 0.5
 *
 * Higher is more trending. Authentication via `X-Cron-Secret` header that
 * must match `CRON_SECRET` env var (if set).
 */
export async function POST(req: NextRequest) {
  try {
    const expected = process.env.CRON_SECRET;
    if (expected) {
      const got = req.headers.get("x-cron-secret");
      if (got !== expected) {
        throw new ApiErrorResponse("FORBIDDEN", "Invalid cron secret", 403);
      }
    }

    await dbConnect();
    const now = Date.now();
    const cursor = Listing.find({ status: "active" }).cursor();

    let updated = 0;
    for await (const doc of cursor) {
      const views = typeof doc.viewCount === "number" ? doc.viewCount : 0;
      const inquiries = typeof doc.inquiryCount === "number" ? doc.inquiryCount : 0;
      const ageDays = Math.max(
        0,
        (now - doc.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const score = Math.log10(views + 1) * 10 + inquiries * 2 - ageDays * 0.5;
      doc.trendingScore = Math.round(score * 100) / 100;
      await doc.save();
      updated += 1;
    }

    return Response.json({ updated });
  } catch (error) {
    return errorResponse(error);
  }
}
