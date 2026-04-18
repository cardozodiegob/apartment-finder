import { errorResponse } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/api/session";
import { noCacheHeaders } from "@/lib/api/cache";

export async function GET() {
  try {
    const user = await getSessionUser();

    const headers = noCacheHeaders();

    if (!user) {
      return Response.json({ session: null }, { status: 401, headers });
    }

    return Response.json({
      session: {
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
    }, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
