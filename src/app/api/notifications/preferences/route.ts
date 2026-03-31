import { NextRequest } from "next/server";
import { updatePreferences } from "@/lib/services/notifications";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.userId) throw new ApiErrorResponse("VALIDATION_ERROR", "userId required", 400);
    const { error } = await updatePreferences(body.userId, body.preferences || {});
    if (error) throw new ApiErrorResponse("NOTIFICATION_ERROR", error, 400);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
