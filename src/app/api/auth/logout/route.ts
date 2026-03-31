import { logout } from "@/lib/services/auth";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function POST() {
  try {
    const result = await logout();

    if (result.error) {
      throw new ApiErrorResponse("LOGOUT_FAILED", result.error, 500);
    }

    return Response.json({ message: "Logged out successfully" });
  } catch (error) {
    return errorResponse(error);
  }
}
