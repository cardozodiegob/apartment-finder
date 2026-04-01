import { NextRequest } from "next/server";
import { requestPasswordReset } from "@/lib/services/auth";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import dbConnect from "@/lib/db/connection";
import { z } from "zod";

const resetRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // Rate limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await checkRateLimit(ip, "/api/auth/reset-password");
    if (!rl.allowed) {
      return Response.json(
        { code: "RATE_LIMITED", message: "Too many reset attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } }
      );
    }
    const body = await request.json();

    const parsed = resetRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiErrorResponse(
        "VALIDATION_ERROR",
        parsed.error.errors[0].message,
        400,
        parsed.error.errors,
      );
    }

    const result = await requestPasswordReset(parsed.data.email);

    if (result.error) {
      throw new ApiErrorResponse("RESET_FAILED", result.error, 400);
    }

    // Always return success to avoid email enumeration
    return Response.json({
      message: "If an account exists with this email, a reset link has been sent",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
