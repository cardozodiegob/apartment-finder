import { errorResponse } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/api/session";
import { noCacheHeaders } from "@/lib/api/cache";

/**
 * GET /api/auth/session
 *
 * Returns the signed-in user in a flat shape: { user: SessionUser | null }.
 * When no valid cookie is present, returns 401 with { user: null }.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    const headers = noCacheHeaders();

    if (!user) {
      return Response.json({ user: null }, { status: 401, headers });
    }

    return Response.json(
      {
        user: {
          id: user.supabaseId,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          mongoId: user.mongoId,
          isSuspended: user.isSuspended,
          suspensionReason: user.suspensionReason,
        },
      },
      { headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
