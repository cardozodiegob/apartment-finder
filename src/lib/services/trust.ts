import Review from "@/lib/db/models/Review";
import User from "@/lib/db/models/User";
import Listing from "@/lib/db/models/Listing";
import type { IReview } from "@/lib/db/models/Review";
import type { IUser } from "@/lib/db/models/User";
import { z } from "zod";

// --- Types ---

export type UserBadge = "new_user" | "trusted" | "flagged";

export interface TrustScoreResult {
  score: number;
  badge: UserBadge;
  reviewCount: number;
}

export const reviewInputSchema = z.object({
  reviewerId: z.string().min(1),
  reviewedUserId: z.string().min(1),
  transactionId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;

// --- Constants ---

const LOW_TRUST_THRESHOLD = 2.0;
const NEW_USER_TRANSACTION_THRESHOLD = 3;
const DECAY_FACTOR = 0.01;

// --- Time-decay formula ---

export function timeDecay(ageDays: number): number {
  return Math.exp(-DECAY_FACTOR * ageDays);
}

export function calculateTrustScore(
  reviews: Array<{ rating: number; ageDays: number }>,
  profileCompleteness: number
): number {
  if (reviews.length === 0) return 0;

  const completeness = Math.max(0.5, Math.min(1.0, profileCompleteness));

  let weightedSum = 0;
  let weightSum = 0;

  for (const review of reviews) {
    const weight = timeDecay(review.ageDays);
    weightedSum += review.rating * weight;
    weightSum += weight;
  }

  if (weightSum === 0) return 0;

  const rawScore = (weightedSum / weightSum) * completeness;
  return Math.max(0, Math.min(5, Math.round(rawScore * 100) / 100));
}

// --- Service functions ---

export async function calculateScore(userId: string): Promise<TrustScoreResult> {
  const user = await User.findById(userId);
  if (!user) {
    return { score: 0, badge: "new_user", reviewCount: 0 };
  }

  const reviews = await Review.find({ reviewedUserId: userId }).sort({ createdAt: -1 });
  const now = Date.now();

  const reviewData = reviews.map((r) => ({
    rating: r.rating,
    ageDays: (now - r.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  }));

  const score = calculateTrustScore(reviewData, user.profileCompleteness);
  const badge = getUserBadgeFromData(user.completedTransactions, score);

  // Update user's trust score
  user.trustScore = score;
  await user.save();

  return { score, badge, reviewCount: reviews.length };
}

export async function submitReview(data: ReviewInput): Promise<{ review: IReview | null; error: string | null }> {
  const parsed = reviewInputSchema.safeParse(data);
  if (!parsed.success) {
    return { review: null, error: parsed.error.errors[0].message };
  }

  const { reviewerId, reviewedUserId, transactionId, rating, comment } = parsed.data;

  // Prevent self-review
  if (reviewerId === reviewedUserId) {
    return { review: null, error: "Cannot review yourself" };
  }

  // Check for duplicate review
  const existing = await Review.findOne({ reviewerId, transactionId });
  if (existing) {
    return { review: null, error: "You have already reviewed this transaction" };
  }

  try {
    const review = await Review.create({
      reviewerId,
      reviewedUserId,
      transactionId,
      rating,
      comment,
    });

    // Recalculate trust score for reviewed user
    await calculateScore(reviewedUserId);

    return { review, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to submit review";
    return { review: null, error: msg };
  }
}

export async function getReviewsForUser(
  userId: string,
  limit = 3
): Promise<{ reviews: IReview[]; error: string | null }> {
  try {
    const reviews = await Review.find({ reviewedUserId: userId })
      .sort({ createdAt: -1 })
      .limit(limit);
    return { reviews, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to get reviews";
    return { reviews: [], error: msg };
  }
}

export function getUserBadgeFromData(completedTransactions: number, trustScore: number): UserBadge {
  if (completedTransactions < NEW_USER_TRANSACTION_THRESHOLD) {
    return "new_user";
  }
  if (trustScore < LOW_TRUST_THRESHOLD) {
    return "flagged";
  }
  return "trusted";
}

export async function getUserBadge(userId: string): Promise<UserBadge> {
  const user = await User.findById(userId);
  if (!user) return "new_user";
  return getUserBadgeFromData(user.completedTransactions, user.trustScore);
}

export async function flagLowTrustUser(userId: string): Promise<{ error: string | null }> {
  try {
    const user = await User.findById(userId);
    if (!user) return { error: "User not found" };

    if (user.trustScore < LOW_TRUST_THRESHOLD && user.completedTransactions >= NEW_USER_TRANSACTION_THRESHOLD) {
      user.isSuspended = true;
      user.suspensionReason = "Low trust score - flagged for admin review";
      await user.save();

      // Add warning to all active listings
      await Listing.updateMany(
        { posterId: userId, status: "active" },
        { $set: { scamRiskLevel: "high" } }
      );
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to flag user";
    return { error: msg };
  }
}
