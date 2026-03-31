import { NextRequest } from "next/server";
import { register } from "@/lib/services/auth";
import { registerSchema } from "@/lib/validations/auth";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
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
