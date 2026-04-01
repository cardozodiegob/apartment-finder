import { NextRequest } from "next/server";
import { login } from "@/lib/services/auth";
import { loginSchema } from "@/lib/validations/auth";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import { cookies } from "next/headers";
import dbConnect from "@/lib/db/connection";
import User from "@/lib/db/models/User";
import { checkRateLimit } from "@/lib/api/rate-limit";

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // Rate limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await checkRateLimit(ip, "/api/auth/login");
    if (!rl.allowed) {
      return Response.json(
        { code: "RATE_LIMITED", message: "Too many login attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } }
      );
    }

    const body = await request.json();

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiErrorResponse(
        "VALIDATION_ERROR",
        parsed.error.errors[0].message,
        400,
        parsed.error.errors,
      );
    }

    const { email, password } = parsed.data;
    const result = await login(email, password);

    if (result.error) {
      const isLocked = result.error.includes("locked");
      throw new ApiErrorResponse(
        isLocked ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
        result.error,
        isLocked ? 423 : 401,
      );
    }

    // Store session tokens in httpOnly cookies
    if (result.session) {
      const cookieStore = await cookies();
      cookieStore.set("sb-access-token", result.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60, // 1 hour
      });
      cookieStore.set("sb-refresh-token", result.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    // Look up MongoDB user for suspension status
    const mongoUser = result.user?.id
      ? await User.findOne({ supabaseId: result.user.id })
      : null;

    return Response.json({
      user: {
        id: result.user?.id,
        email: result.user?.email,
        isSuspended: mongoUser?.isSuspended ?? false,
        suspensionReason: mongoUser?.suspensionReason,
        role: mongoUser?.role,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
