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
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const adminName = process.env.INITIAL_ADMIN_NAME || "Admin";
  if (!adminEmail || !adminPassword) return;

  const { supabaseAdmin } = await import("@/lib/supabase/server");

  const existing = await User.findOne({ email: adminEmail });
  if (existing) {
    // Check if this user can actually log in via Supabase
    // If supabaseId starts with "admin-seed-" it was created without Supabase auth — reseed it
    if (existing.supabaseId.startsWith("admin-seed-") || !existing.supabaseId) {
      // Delete the broken record and recreate properly
      await User.deleteOne({ _id: existing._id });
    } else {
      // Valid record exists, just ensure admin role
      if (existing.role !== "admin") {
        existing.role = "admin";
        await existing.save();
      }
      return;
    }
  }

  // Create Supabase auth user with confirmed email
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });

  if (error || !data.user) {
    // User might already exist in Supabase but not in MongoDB — try to find them
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    const supaUser = listData?.users?.find((u) => u.email === adminEmail);
    if (supaUser) {
      await User.create({
        supabaseId: supaUser.id,
        email: adminEmail,
        fullName: adminName,
        role: "admin",
        preferredLanguage: "en",
        preferredCurrency: "EUR",
      });
      return;
    }
    console.error("Failed to seed admin in Supabase:", error?.message);
    return;
  }

  await User.create({
    supabaseId: data.user.id,
    email: adminEmail,
    fullName: adminName,
    role: "admin",
    preferredLanguage: "en",
    preferredCurrency: "EUR",
  });
}
