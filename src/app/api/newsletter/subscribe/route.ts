import { NextRequest } from "next/server";
import mongoose, { Schema, type Document, type Model } from "mongoose";
import dbConnect from "@/lib/db/connection";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

/**
 * Minimal newsletter subscription model. Kept inline here because this is the
 * only consumer right now. If we grow it into a full mailing-list feature, lift
 * the schema into `src/lib/db/models/`.
 */
interface INewsletterSubscription extends Document {
  email: string;
  createdAt: Date;
}

const NewsletterSubscriptionSchema = new Schema<INewsletterSubscription>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const NewsletterSubscription: Model<INewsletterSubscription> =
  mongoose.models.NewsletterSubscription ||
  mongoose.model<INewsletterSubscription>("NewsletterSubscription", NewsletterSubscriptionSchema);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/newsletter/subscribe
 * Body: { email: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    if (!email || !EMAIL_RE.test(email)) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "Valid email required", 400);
    }

    await dbConnect();
    await NewsletterSubscription.updateOne(
      { email: email.toLowerCase() },
      { $setOnInsert: { email: email.toLowerCase() } },
      { upsert: true },
    );

    return Response.json({ subscribed: true });
  } catch (error) {
    return errorResponse(error);
  }
}
