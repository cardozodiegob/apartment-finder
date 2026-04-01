import { NextRequest } from "next/server";
import { updatePreferences } from "@/lib/services/notifications";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";
import { requireSessionUser } from "@/lib/api/session";

export async function PUT(request: NextRequest) {
  try {
    const user = await requireSessionUser();
    const body = await request.json();
    const { error } = await updatePreferences(user.mongoId, body.preferences || {});
    if (error) throw new ApiErrorResponse("NOTIFICATION_ERROR", error, 400);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
