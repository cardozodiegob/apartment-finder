/**
 * Poster card service — assembles the poster-facing block shown on listing
 * detail pages. Includes trust metrics, verification badges, languages,
 * and member-since info.
 */

import dbConnect from "@/lib/db/connection";
import User from "@/lib/db/models/User";
import { Types } from "mongoose";

export interface PosterCard {
  id: string;
  fullName: string;
  firstName: string;
  photoUrl: string | null;
  trustScore: number;
  badges: Array<"idVerified" | "emailVerified" | "phoneVerified">;
  languages: string[];
  memberSince: string; // ISO
  completedTransactions: number;
  responseRate: number | null;       // 0..1, null = not enough data
  responseTimeHours: number | null;  // average hours to first reply
}

/**
 * Derives a poster card for the given user ID. Returns `null` if the user
 * can't be resolved (deleted, bogus id, etc.).
 */
export async function getPosterCard(
  posterId: string | Types.ObjectId,
): Promise<PosterCard | null> {
  await dbConnect();

  const user = await User.findById(posterId).lean<{
    _id: Types.ObjectId;
    fullName?: string;
    profilePhoto?: string;
    trustScore?: number;
    idVerified?: boolean;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    languagesSpoken?: string[];
    completedTransactions?: number;
    createdAt?: Date;
    responseMetrics?: { rate?: number; timeHours?: number };
  }>();

  if (!user) return null;

  const fullName = user.fullName ?? "Poster";
  const firstName = fullName.split(" ")[0] || fullName;

  const badges: PosterCard["badges"] = [];
  if (user.idVerified) badges.push("idVerified");
  if (user.emailVerified) badges.push("emailVerified");
  if (user.phoneVerified) badges.push("phoneVerified");

  return {
    id: user._id.toString(),
    fullName,
    firstName,
    photoUrl: user.profilePhoto ?? null,
    trustScore: typeof user.trustScore === "number" ? user.trustScore : 0,
    badges,
    languages: Array.isArray(user.languagesSpoken) ? user.languagesSpoken : [],
    memberSince: user.createdAt ? user.createdAt.toISOString() : new Date(0).toISOString(),
    completedTransactions:
      typeof user.completedTransactions === "number" ? user.completedTransactions : 0,
    responseRate:
      typeof user.responseMetrics?.rate === "number" ? user.responseMetrics.rate : null,
    responseTimeHours:
      typeof user.responseMetrics?.timeHours === "number"
        ? user.responseMetrics.timeHours
        : null,
  };
}
