import User from "@/lib/db/models/User";
import Listing from "@/lib/db/models/Listing";
import Review from "@/lib/db/models/Review";
import Payment from "@/lib/db/models/Payment";
import ConsentLog from "@/lib/db/models/ConsentLog";
import Notification from "@/lib/db/models/Notification";
import Report from "@/lib/db/models/Report";

// --- Types ---

export interface ConsentState {
  hasConsented: boolean;
  preferences: Record<string, boolean>;
}

export interface ConsentUpdate {
  purpose: string;
  consented: boolean;
}

export interface DeletionConfirmation {
  deleted: boolean;
  timestamp: Date;
}

// --- Cookie consent purposes ---

export const CONSENT_PURPOSES = ["essential", "analytics", "marketing", "personalization"] as const;

// --- Helpers ---

export function isEssentialCookie(purpose: string): boolean {
  return purpose === "essential";
}

export function canSetNonEssentialCookie(consentState: ConsentState): boolean {
  if (!consentState.hasConsented) return false;
  return Object.entries(consentState.preferences).some(
    ([purpose, consented]) => purpose !== "essential" && consented
  );
}

export function isConsentedForPurpose(consentState: ConsentState, purpose: string): boolean {
  if (purpose === "essential") return true; // Essential always allowed
  if (!consentState.hasConsented) return false;
  return consentState.preferences[purpose] === true;
}

// --- Service ---

export async function showConsentBanner(userId?: string): Promise<ConsentState> {
  if (!userId) {
    return { hasConsented: false, preferences: {} };
  }

  const logs = await ConsentLog.find({ userId }).sort({ timestamp: -1 });
  if (logs.length === 0) {
    return { hasConsented: false, preferences: {} };
  }

  // Build current consent state from most recent log per purpose
  const preferences: Record<string, boolean> = {};
  const seen = new Set<string>();
  for (const log of logs) {
    if (!seen.has(log.purpose)) {
      preferences[log.purpose] = log.consented;
      seen.add(log.purpose);
    }
  }

  return { hasConsented: true, preferences };
}

export async function updateConsent(
  userId: string,
  consent: ConsentUpdate,
  ipAddress?: string
): Promise<{ error: string | null }> {
  try {
    await ConsentLog.create({
      userId,
      purpose: consent.purpose,
      consented: consent.consented,
      timestamp: new Date(),
      ipAddress,
    });
    return { error: null };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update consent" };
  }
}

export async function exportUserData(userId: string): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  try {
    const user = await User.findById(userId);
    if (!user) return { data: null, error: "User not found" };

    const [listings, reviews, payments, consentLogs, notifications] = await Promise.all([
      Listing.find({ posterId: userId }),
      Review.find({ $or: [{ reviewerId: userId }, { reviewedUserId: userId }] }),
      Payment.find({ $or: [{ seekerId: userId }, { posterId: userId }] }),
      ConsentLog.find({ userId }),
      Notification.find({ userId }),
    ]);

    const exportData = {
      profile: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        preferredCurrency: user.preferredCurrency,
        trustScore: user.trustScore,
        completedTransactions: user.completedTransactions,
        createdAt: user.createdAt,
      },
      listings: listings.map((l) => ({ title: l.title, description: l.description, status: l.status, createdAt: l.createdAt })),
      reviews: reviews.map((r) => ({ rating: r.rating, comment: r.comment, createdAt: r.createdAt })),
      payments: payments.map((p) => ({ amount: p.amount, currency: p.currency, status: p.status, createdAt: p.createdAt })),
      consentLog: consentLogs.map((c) => ({ purpose: c.purpose, consented: c.consented, timestamp: c.timestamp })),
      notifications: notifications.map((n) => ({ type: n.type, title: n.title, createdAt: n.createdAt })),
      exportedAt: new Date().toISOString(),
    };

    return { data: exportData, error: null };
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to export data" };
  }
}

export async function deleteUserData(userId: string): Promise<{ confirmation: DeletionConfirmation | null; error: string | null }> {
  try {
    const user = await User.findById(userId);
    if (!user) return { confirmation: null, error: "User not found" };

    await Promise.all([
      Listing.deleteMany({ posterId: userId }),
      Review.deleteMany({ $or: [{ reviewerId: userId }, { reviewedUserId: userId }] }),
      Payment.deleteMany({ $or: [{ seekerId: userId }, { posterId: userId }] }),
      ConsentLog.deleteMany({ userId }),
      Notification.deleteMany({ userId }),
      Report.deleteMany({ reporterId: userId }),
      User.findByIdAndDelete(userId),
    ]);

    return {
      confirmation: { deleted: true, timestamp: new Date() },
      error: null,
    };
  } catch (err: unknown) {
    return { confirmation: null, error: err instanceof Error ? err.message : "Failed to delete data" };
  }
}

export async function getConsentLog(userId: string): Promise<{ logs: Array<{ purpose: string; consented: boolean; timestamp: Date }>; error: string | null }> {
  try {
    const logs = await ConsentLog.find({ userId }).sort({ timestamp: -1 });
    return {
      logs: logs.map((l) => ({ purpose: l.purpose, consented: l.consented, timestamp: l.timestamp })),
      error: null,
    };
  } catch (err: unknown) {
    return { logs: [], error: err instanceof Error ? err.message : "Failed to get consent log" };
  }
}
