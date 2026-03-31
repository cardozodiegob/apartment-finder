import Listing from "@/lib/db/models/Listing";
import type { IListing } from "@/lib/db/models/Listing";

// --- Types ---

export interface ScamFlag {
  type: "duplicate_photos" | "pricing_anomaly" | "suspicious_description";
  description: string;
  severity: "low" | "medium" | "high";
}

export interface ScamAnalysisResult {
  riskLevel: "low" | "medium" | "high";
  flags: ScamFlag[];
  requiresReview: boolean;
}

export interface DuplicateResult {
  hash: string;
  matchingListingId: string;
  matchingPosterId: string;
}

// --- Known scam phrases ---

const SCAM_PHRASES = [
  "wire transfer only",
  "western union",
  "send money before viewing",
  "no viewing necessary",
  "pay deposit immediately",
  "currently abroad",
  "overseas",
  "cannot show the apartment",
  "send passport",
  "send id copy",
  "too good to be true",
  "urgent sale",
  "act fast",
  "limited time offer",
  "money order",
  "advance payment required",
];

// --- Pricing anomaly threshold ---

/** Flag if price is below this fraction of area median */
const PRICING_ANOMALY_THRESHOLD = 0.4;

// --- Scam Detection Service ---

/**
 * Analyze a listing for scam patterns.
 * Checks: duplicate photos, pricing anomalies, suspicious description keywords.
 */
export async function analyzeListing(
  listing: Pick<IListing, "photoHashes" | "posterId" | "monthlyRent" | "currency" | "address" | "description" | "title">
): Promise<ScamAnalysisResult> {
  const flags: ScamFlag[] = [];

  // 1. Check duplicate photos
  if (listing.photoHashes && listing.photoHashes.length > 0) {
    const duplicates = await checkDuplicatePhotos(
      listing.photoHashes,
      listing.posterId.toString()
    );
    if (duplicates.length > 0) {
      flags.push({
        type: "duplicate_photos",
        description: `${duplicates.length} photo(s) match existing listings from other posters`,
        severity: "high",
      });
    }
  }

  // 2. Check pricing anomaly
  const isPricingAnomaly = await checkPricingAnomaly(listing);
  if (isPricingAnomaly) {
    flags.push({
      type: "pricing_anomaly",
      description: "Listing price is significantly below area median",
      severity: "medium",
    });
  }

  // 3. Check suspicious description
  const suspiciousKeywords = checkSuspiciousDescription(
    `${listing.title} ${listing.description}`
  );
  if (suspiciousKeywords.length > 0) {
    flags.push({
      type: "suspicious_description",
      description: `Suspicious phrases detected: ${suspiciousKeywords.join(", ")}`,
      severity: suspiciousKeywords.length >= 2 ? "high" : "medium",
    });
  }

  // Determine risk level
  const riskLevel = determineRiskLevel(flags);

  return {
    riskLevel,
    flags,
    requiresReview: riskLevel === "high",
  };
}


/**
 * Check if any photo hashes match photos from other active listings by different posters.
 */
export async function checkDuplicatePhotos(
  photoHashes: string[],
  currentPosterId: string
): Promise<DuplicateResult[]> {
  if (!photoHashes || photoHashes.length === 0) {
    return [];
  }

  try {
    // Find active listings from OTHER posters that share any photo hashes
    const matchingListings = await Listing.find({
      status: "active",
      posterId: { $ne: currentPosterId },
      photoHashes: { $in: photoHashes },
    }).select("_id posterId photoHashes");

    const duplicates: DuplicateResult[] = [];

    for (const match of matchingListings) {
      for (const hash of photoHashes) {
        if (match.photoHashes.includes(hash)) {
          duplicates.push({
            hash,
            matchingListingId: match._id.toString(),
            matchingPosterId: match.posterId.toString(),
          });
        }
      }
    }

    return duplicates;
  } catch {
    // If DB query fails, return empty (fail open for this check)
    return [];
  }
}

/**
 * Check if a listing's price is significantly below the area median.
 */
export async function checkPricingAnomaly(
  listing: Pick<IListing, "monthlyRent" | "currency" | "address">
): Promise<boolean> {
  try {
    // Find active listings in the same city with the same currency
    const areaListings = await Listing.find({
      status: "active",
      "address.city": listing.address.city,
      currency: listing.currency,
    }).select("monthlyRent");

    if (areaListings.length < 3) {
      // Not enough data to determine anomaly
      return false;
    }

    const prices = areaListings.map((l) => l.monthlyRent).sort((a, b) => a - b);
    const median =
      prices.length % 2 === 0
        ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
        : prices[Math.floor(prices.length / 2)];

    return listing.monthlyRent < median * PRICING_ANOMALY_THRESHOLD;
  } catch {
    return false;
  }
}

/**
 * Scan text for known scam phrases using simple NLP keyword matching.
 */
export function checkSuspiciousDescription(text: string): string[] {
  const lowerText = text.toLowerCase();
  return SCAM_PHRASES.filter((phrase) => lowerText.includes(phrase));
}

/**
 * Determine overall risk level from flags.
 */
function determineRiskLevel(flags: ScamFlag[]): "low" | "medium" | "high" {
  if (flags.length === 0) return "low";

  const hasHigh = flags.some((f) => f.severity === "high");
  if (hasHigh) return "high";

  const mediumCount = flags.filter((f) => f.severity === "medium").length;
  if (mediumCount >= 2) return "high";
  if (mediumCount >= 1) return "medium";

  return "low";
}
