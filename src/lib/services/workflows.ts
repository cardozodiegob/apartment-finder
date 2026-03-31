/**
 * End-to-end workflow orchestration connecting all services.
 */
import { publish as publishListing } from "@/lib/services/listings";
import { analyzeListing } from "@/lib/services/scam-detection";
import { send as sendNotification } from "@/lib/services/notifications";
import { calculateScore } from "@/lib/services/trust";
import Listing from "@/lib/db/models/Listing";

/**
 * Listing publish flow: create → scam detection → publish/hold → notification
 */
export async function publishListingWithScamCheck(listingId: string, userId: string) {
  const listing = await Listing.findById(listingId);
  if (!listing) return { error: "Listing not found" };

  // Run scam detection
  const analysis = await analyzeListing(listing);

  if (analysis.requiresReview) {
    listing.status = "under_review";
    listing.scamRiskLevel = analysis.riskLevel;
    await listing.save();

    await sendNotification({
      userId,
      type: "listing_status",
      title: "Listing Under Review",
      body: "Your listing is under review and will be published after approval.",
    });

    return { listing, held: true, analysis };
  }

  // Safe to publish
  const result = await publishListing(listingId, userId);
  if (!result.error) {
    await sendNotification({
      userId,
      type: "listing_status",
      title: "Listing Published",
      body: "Your listing is now live and visible to seekers.",
    });
  }

  return { listing: result.listing, held: false, analysis };
}

/**
 * Payment completion flow: both confirm → receipt → review prompt
 */
export async function onPaymentCompleted(paymentId: string, seekerId: string, posterId: string) {
  // Notify both parties
  await Promise.all([
    sendNotification({
      userId: seekerId,
      type: "payment",
      title: "Payment Completed",
      body: "Your payment has been processed. Please leave a review.",
      metadata: { paymentId },
    }),
    sendNotification({
      userId: posterId,
      type: "payment",
      title: "Payment Received",
      body: "Payment has been confirmed and processed. Please leave a review.",
      metadata: { paymentId },
    }),
  ]);
}

/**
 * Report resolution flow: resolve → notify reporter and reported
 */
export async function onReportResolved(
  reporterId: string,
  reportedUserId: string | undefined,
  resolution: string
) {
  await sendNotification({
    userId: reporterId,
    type: "report",
    title: "Report Resolved",
    body: `Your report has been resolved: ${resolution}`,
  });

  if (reportedUserId) {
    await sendNotification({
      userId: reportedUserId,
      type: "report",
      title: "Report Resolution",
      body: `A report regarding your account has been resolved: ${resolution}`,
    });
  }
}

/**
 * Review submission flow: review → recalculate score → update badge
 */
export async function onReviewSubmitted(reviewedUserId: string) {
  await calculateScore(reviewedUserId);
}
