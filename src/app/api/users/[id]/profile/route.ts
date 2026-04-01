import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import User from "@/lib/db/models/User";
import Review from "@/lib/db/models/Review";
import Listing from "@/lib/db/models/Listing";
import Payment from "@/lib/db/models/Payment";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

function computeBadge(trustScore: number): "new" | "trusted" | "verified" {
  if (trustScore >= 3) return "verified";
  if (trustScore >= 1) return "trusted";
  return "new";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const user = await User.findById(id);
    if (!user) {
      throw new ApiErrorResponse("NOT_FOUND", "User not found", 404);
    }

    const [recentReviews, activeListings, completedPayments] = await Promise.all([
      Review.find({ reviewedUserId: user._id })
        .sort({ createdAt: -1 })
        .limit(3)
        .populate("reviewerId", "fullName"),
      Listing.find({ posterId: user._id, status: "active" }).sort({ createdAt: -1 }),
      Payment.countDocuments({
        $or: [
          { seekerId: user._id, status: "completed" },
          { posterId: user._id, status: "completed" },
        ],
      }),
    ]);

    const badge = computeBadge(user.trustScore);

    return Response.json({
      profile: {
        id: user._id.toString(),
        fullName: user.fullName,
        bio: user.bio || null,
        trustScore: user.trustScore,
        badge,
        completedTransactions: completedPayments,
        recentReviews: recentReviews.map((r) => ({
          id: r._id.toString(),
          reviewerName: (r.reviewerId as unknown as { fullName: string })?.fullName || "Unknown",
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
        })),
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
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
