import { errorResponse } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/api/session";

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return Response.json({ session: null }, { status: 401 });
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
    });
  } catch (error) {
    return errorResponse(error);
  }
}
