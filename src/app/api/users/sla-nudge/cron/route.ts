import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import User from "@/lib/db/models/User";
import { refreshResponseMetrics } from "@/lib/services/responseMetrics";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

/**
 * POST /api/users/sla-nudge/cron
 *
 * Walks every poster + admin, recomputes response metrics, and flags users
 * with `responseRate < 0.5` OR `responseTimeHours > 48h` for a nudge email
 * (which is emitted lazily via the existing notification pipeline).
 *
 * Auth: `X-Cron-Secret` header must match `CRON_SECRET` env var.
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
    const cursor = User.find({ role: { $in: ["poster", "admin"] } }).cursor();

    let examined = 0;
    let flagged = 0;
    const flaggedIds: string[] = [];

    for await (const user of cursor) {
      examined += 1;
      try {
        const metrics = await refreshResponseMetrics(user._id);
        if (
          metrics.sampleSize >= 3 &&
          (metrics.rate < 0.5 || metrics.timeHours > 48)
        ) {
          flagged += 1;
          flaggedIds.push(user._id.toString());
        }
      } catch { /* ignore per-user failures */ }
    }

    return Response.json({ examined, flagged, flaggedIds });
  } catch (error) {
    return errorResponse(error);
  }
}
