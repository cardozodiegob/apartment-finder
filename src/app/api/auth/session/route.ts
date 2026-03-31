import { getSession } from "@/lib/services/auth";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function GET() {
  try {
    const result = await getSession();

    if (result.error) {
      throw new ApiErrorResponse("SESSION_ERROR", result.error, 500);
    }

    if (!result.session) {
      return Response.json({ session: null }, { status: 401 });
    }

    return Response.json({
      session: {
        user: {
          id: result.session.user.id,
          email: result.session.user.email,
        },
        expiresAt: result.session.expires_at,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
