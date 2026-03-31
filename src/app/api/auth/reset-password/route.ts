import { NextRequest } from "next/server";
import { requestPasswordReset } from "@/lib/services/auth";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import { z } from "zod";

const resetRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(request: NextRequest) {
  try {
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
