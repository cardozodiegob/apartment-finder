import { NextRequest } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { declineViewing } from "@/lib/services/viewings";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || undefined;

    const { viewing, error } = await declineViewing(id, user.mongoId, reason);
    if (error) {
      throw new ApiErrorResponse("VIEWING_ERROR", error, 400);
    }

    return Response.json({ viewing });
  } catch (error) {
    return errorResponse(error);
  }
}
