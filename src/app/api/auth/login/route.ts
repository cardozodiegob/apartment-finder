import { NextRequest } from "next/server";
import { login } from "@/lib/services/auth";
import { loginSchema } from "@/lib/validations/auth";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
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

    return Response.json({
      user: { id: result.user?.id, email: result.user?.email },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
