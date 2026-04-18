import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import User from "@/lib/db/models/User";
import Review from "@/lib/db/models/Review";
import Listing from "@/lib/db/models/Listing";
import Payment from "@/lib/db/models/Payment";
import { refreshResponseMetrics } from "@/lib/services/responseMetrics";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

function computeBadge(trustScore: number): "new" | "trusted" | "verified" {
  if (trustScore >= 3) return "verified";
  if (trustScore >= 1) return "trusted";
  return "new";
}

interface ReviewLean {
  _id: { toString(): string };
  reviewerId: { fullName?: string } | null;
  rating: number;
  comment: string;
  createdAt: Date;
}

function buildHistogram(reviews: Array<{ rating: number }>): number[] {
  // index 0 = 1★, index 4 = 5★
  const bins = [0, 0, 0, 0, 0];
  for (const r of reviews) {
    const bucket = Math.max(0, Math.min(4, Math.round(r.rating) - 1));
    bins[bucket] += 1;
  }
  return bins;
}

function oneDayAgo(d?: Date | null): boolean {
  if (!d) return true;
  return Date.now() - d.getTime() > 24 * 60 * 60 * 1000;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await dbConnect();
    const { id } = await params;

    const user = await User.findById(id);
    if (!user) {
      throw new ApiErrorResponse("NOT_FOUND", "User not found", 404);
    }

    const [recentReviews, allReviews, activeListings, completedPayments] = await Promise.all([
      Review.find({ reviewedUserId: user._id })
        .sort({ createdAt: -1 })
        .limit(3)
        .populate("reviewerId", "fullName")
        .lean<ReviewLean[]>(),
      Review.find({ reviewedUserId: user._id }).select({ rating: 1 }).lean<{ rating: number }[]>(),
      Listing.find({ posterId: user._id, status: "active" }).sort({ createdAt: -1 }),
      Payment.countDocuments({
        $or: [
          { seekerId: user._id, status: "completed" },
          { posterId: user._id, status: "completed" },
        ],
      }),
    ]);

    // Refresh response metrics if stale (>24h old)
    let metrics = user.responseMetrics;
    const lastWindow = metrics?.windowStartAt ? new Date(metrics.windowStartAt) : null;
    if (oneDayAgo(lastWindow)) {
      try {
        metrics = await refreshResponseMetrics(user._id);
      } catch { /* fall back to stored */ }
    }

    const badge = computeBadge(user.trustScore);

    // Badges list
    const badges: string[] = [];
    if (user.idVerified) badges.push("idVerified");
    if (user.emailVerified) badges.push("emailVerified");
    if (user.phoneVerified) badges.push("phoneVerified");
    if (user.createdAt) badges.push(`landlordSince:${user.createdAt.getFullYear()}`);
    if (completedPayments > 0) badges.push(`transactions:${completedPayments}`);

    const histogram = buildHistogram(allReviews);

    return Response.json({
      profile: {
        id: user._id.toString(),
        fullName: user.fullName,
        bio: user.bio || null,
        trustScore: user.trustScore,
        badge,
        badges,
        languages: user.languagesSpoken ?? [],
        completedTransactions: completedPayments,
        recentReviews: recentReviews.map((r) => ({
          id: r._id.toString(),
          reviewerName: r.reviewerId?.fullName || "Unknown",
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
        })),
        reviewHistogram: histogram,
        activeListings: activeListings.map((l) => ({
          id: l._id.toString(),
          title: l.title,
          monthlyRent: l.monthlyRent,
          currency: l.currency,
          city: l.address.city,
          propertyType: l.propertyType,
          photos: l.photos,
        })),
        memberSince: user.createdAt,
        profileCompleteness: user.profileCompleteness,
        isSuspended: user.isSuspended,
        idVerified: user.idVerified,
        responseRate: metrics?.rate ?? null,
        responseTimeHours: metrics?.timeHours ?? null,
      },
      user: {
        _id: user._id.toString(),
        fullName: user.fullName,
        bio: user.bio || "",
        phone: user.phone || "",
        dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : "",
        nationality: user.nationality || "",
        idType: user.idType || "",
        idNumber: user.idNumber || "",
        profilePhoto: user.profilePhoto || "",
        profileCompleteness: user.profileCompleteness,
        profileCompleted: user.profileCompleted || false,
        idVerified: user.idVerified || false,
        emailVerified: user.emailVerified || false,
        phoneVerified: user.phoneVerified || false,
        languagesSpoken: user.languagesSpoken ?? [],
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
