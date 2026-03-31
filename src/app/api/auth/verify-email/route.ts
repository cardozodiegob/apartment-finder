import { NextRequest } from "next/server";
import { verifyEmail } from "@/lib/services/auth";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import { z } from "zod";

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = verifyEmailSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiErrorResponse(
        "VALIDATION_ERROR",
        parsed.error.errors[0].message,
        400,
        parsed.error.errors,
      );
    }

    const result = await verifyEmail(parsed.data.token);

    if (result.error) {
      throw new ApiErrorResponse("VERIFICATION_FAILED", result.error, 400);
    }

    return Response.json({ message: "Email verified successfully" });
  } catch (error) {
    return errorResponse(error);
  }
}
