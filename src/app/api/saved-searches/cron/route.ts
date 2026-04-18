import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import SavedSearch from "@/lib/db/models/SavedSearch";
import Listing from "@/lib/db/models/Listing";
import User from "@/lib/db/models/User";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

/**
 * POST /api/saved-searches/cron
 *
 * Runs through every saved search with `emailAlertsEnabled = true`, finds
 * listings created after `lastAlertedAt`, and emits a notification email per
 * subscriber. Updates `lastAlertedAt` on success.
 *
 * Authentication: `X-Cron-Secret` header must match `CRON_SECRET` env var.
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

    // Dynamic import so the endpoint still compiles when the email service
    // isn't configured yet — we'll just log matches in that case.
    let sendEmail: ((args: { to: string; subject: string; html: string }) => Promise<void>) | null = null;
    try {
      const mod = (await import("@/lib/services/email")) as unknown as {
        sendEmail?: (args: { to: string; subject: string; html: string }) => Promise<void>;
      };
      sendEmail = mod.sendEmail ?? null;
    } catch {
      sendEmail = null;
    }

    const searches = await SavedSearch.find({ emailAlertsEnabled: true });
    let notified = 0;
    let examined = 0;

    for (const s of searches) {
      examined += 1;
      const since = s.lastAlertedAt ?? s.createdAt;

      const q: Record<string, unknown> = {
        status: "active",
        createdAt: { $gt: since },
      };
      const f = s.filters as Record<string, unknown>;
      if (typeof f.city === "string") q["address.city"] = f.city;
      if (typeof f.country === "string") q["address.country"] = f.country;
      if (typeof f.propertyType === "string") q.propertyType = f.propertyType;
      if (typeof f.priceMin === "string" || typeof f.priceMax === "string") {
        q.monthlyRent = {};
        if (f.priceMin) (q.monthlyRent as Record<string, number>).$gte = Number(f.priceMin);
        if (f.priceMax) (q.monthlyRent as Record<string, number>).$lte = Number(f.priceMax);
      }

      const matches = await Listing.find(q).limit(10).lean();
      if (matches.length === 0) continue;

      const user = await User.findById(s.userId).lean<{ email?: string }>();
      if (!user?.email) continue;

      const list = matches
        .map((m) => `<li><a href="${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/listings/${m._id}">${m.title}</a> — ${m.currency} ${m.monthlyRent}/mo</li>`)
        .join("");
      const html = `<p>We found ${matches.length} new listings for your saved search "${s.name}":</p><ul>${list}</ul>`;

      if (sendEmail) {
        try {
          await sendEmail({
            to: user.email,
            subject: `New listings for "${s.name}"`,
            html,
          });
          notified += 1;
        } catch {
          /* skip failures, retry next run */
          continue;
        }
      }

      s.lastAlertedAt = new Date();
      await s.save();
    }

    return Response.json({ examined, notified });
  } catch (error) {
    return errorResponse(error);
  }
}
