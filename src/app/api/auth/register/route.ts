import { NextRequest } from "next/server";
import { register } from "@/lib/services/auth";
import { registerSchema } from "@/lib/validations/auth";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import dbConnect from "@/lib/db/connection";
import { checkRateLimit } from "@/lib/api/rate-limit";

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // Rate limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await checkRateLimit(ip, "/api/auth/register");
    if (!rl.allowed) {
      return Response.json(
        { code: "RATE_LIMITED", message: "Too many registration attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } }
      );
    }

    const body = await request.json();

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiErrorResponse(
        "VALIDATION_ERROR",
        parsed.error.errors[0].message,
        400,
        parsed.error.errors,
      );
    }

    const result = await register(parsed.data);

    if (result.error) {
      const statusCode = result.error.includes("already registered") ? 409 : 400;
      throw new ApiErrorResponse("REGISTRATION_FAILED", result.error, statusCode);
    }

    return Response.json(
      { user: { id: result.user?.id, email: result.user?.email } },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
