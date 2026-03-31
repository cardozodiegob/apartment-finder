import User from "@/lib/db/models/User";
import ModerationLog from "@/lib/db/models/ModerationLog";
import { ApiErrorResponse } from "@/lib/api/errors";

export async function requireAdmin(userId: string): Promise<void> {
  if (!userId) {
    throw new ApiErrorResponse("UNAUTHORIZED", "Authentication required", 401);
  }
  const user = await User.findById(userId);
  if (!user || user.role !== "admin") {
    throw new ApiErrorResponse("FORBIDDEN", "Admin access required", 403);
  }
}

export function isAdmin(role: string): boolean {
  return role === "admin";
}

export async function logModerationAction(
  adminId: string,
  action: string,
  targetType: "user" | "listing" | "report",
  targetId: string,
  reason: string
): Promise<void> {
  await ModerationLog.create({ adminId, action, targetType, targetId, reason, timestamp: new Date() });
}

export async function seedInitialAdmin(): Promise<void> {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const adminName = process.env.INITIAL_ADMIN_NAME || "Admin";
  if (!adminEmail) return;

  const existing = await User.findOne({ email: adminEmail });
  if (existing) {
    if (existing.role !== "admin") {
      existing.role = "admin";
      await existing.save();
    }
    return;
  }

  await User.create({
    supabaseId: `admin-seed-${Date.now()}`,
    email: adminEmail,
    fullName: adminName,
    role: "admin",
    preferredLanguage: "en",
    preferredCurrency: "EUR",
  });
}
