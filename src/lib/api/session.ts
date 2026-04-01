import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ApiErrorResponse } from "@/lib/api/errors";
import dbConnect from "@/lib/db/connection";
import User from "@/lib/db/models/User";

export interface SessionUser {
  supabaseId: string;
  mongoId: string;
  email: string;
  fullName: string;
  role: "seeker" | "poster" | "admin";
  isSuspended: boolean;
  suspensionReason?: string;
}

/**
 * Extracts user from cookies, attempts token refresh if expired,
 * looks up MongoDB user record, and returns SessionUser or null.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;
  const refreshToken = cookieStore.get("sb-refresh-token")?.value;

  if (!accessToken) {
    return null;
  }

  // Try validating the access token
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  let supabaseUser = data?.user;

  if (error || !supabaseUser) {
    // Access token expired/invalid — attempt refresh
    if (!refreshToken) {
      cookieStore.delete("sb-access-token");
      return null;
    }

    const { data: refreshData, error: refreshError } =
      await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });

    if (refreshError || !refreshData.session || !refreshData.user) {
      // Refresh failed — delete both cookies
      cookieStore.delete("sb-access-token");
      cookieStore.delete("sb-refresh-token");
      return null;
    }

    // Refresh succeeded — set new cookies
    const isProduction = process.env.NODE_ENV === "production";
    cookieStore.set("sb-access-token", refreshData.session.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 3600, // 1 hour
    });
    cookieStore.set("sb-refresh-token", refreshData.session.refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 604800, // 7 days
    });

    supabaseUser = refreshData.user;
  }

  // Look up MongoDB user record
  await dbConnect();
  const mongoUser = await User.findOne({ supabaseId: supabaseUser.id });

  if (!mongoUser) {
    return null;
  }

  const sessionUser: SessionUser = {
    supabaseId: supabaseUser.id,
    mongoId: mongoUser._id.toString(),
    email: mongoUser.email,
    fullName: mongoUser.fullName,
    role: mongoUser.role,
    isSuspended: mongoUser.isSuspended,
  };

  if (mongoUser.suspensionReason) {
    sessionUser.suspensionReason = mongoUser.suspensionReason;
  }

  return sessionUser;
}

/**
 * Requires an authenticated user. Throws 401 if not authenticated.
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiErrorResponse("UNAUTHORIZED", "Authentication required", 401);
  }
  return user;
}

/**
 * Requires an admin user. Throws 401 if not authenticated, 403 if not admin.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (user.role !== "admin") {
    throw new ApiErrorResponse("FORBIDDEN", "Admin access required", 403);
  }
  return user;
}

/**
 * Requires a non-suspended user. Throws 401 if not authenticated, 403 if suspended.
 */
export async function requireActiveUser(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (user.isSuspended) {
    throw new ApiErrorResponse(
      "FORBIDDEN",
      `Account suspended: ${user.suspensionReason || "Contact support for details"}`,
      403
    );
  }
  return user;
}
