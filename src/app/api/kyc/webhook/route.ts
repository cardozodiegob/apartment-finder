import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import User from "@/lib/db/models/User";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

/**
 * POST /api/kyc/webhook
 *
 * Webhook receiver for the KYC provider. Expects `userId` in the session
 * metadata and a `verified` boolean. For Stripe Identity the webhook event
 * `identity.verification_session.verified` signals completion.
 *
 * Auth: if `KYC_WEBHOOK_SECRET` env is set, it must match the
 * `X-Webhook-Secret` header.
 */
export async function POST(req: NextRequest) {
  try {
    const expected = process.env.KYC_WEBHOOK_SECRET;
    if (expected) {
      const got = req.headers.get("x-webhook-secret");
      if (got !== expected) {
        throw new ApiErrorResponse("FORBIDDEN", "Invalid webhook secret", 403);
      }
    }

    const payload = await req.json() as {
      userId?: string;
      verified?: boolean;
      data?: { object?: { metadata?: { userId?: string }; status?: string } };
      type?: string;
    };

    // Accept both a "flat" shape and a Stripe-style envelope
    const userId =
      payload.userId ?? payload.data?.object?.metadata?.userId;
    const verified =
      payload.verified === true ||
      payload.data?.object?.status === "verified" ||
      payload.type === "identity.verification_session.verified";

    if (!userId || !verified) {
      return Response.json({ applied: false });
    }

    await dbConnect();
    await User.updateOne({ _id: userId }, { $set: { idVerified: true } });

    return Response.json({ applied: true });
  } catch (error) {
    return errorResponse(error);
  }
}
