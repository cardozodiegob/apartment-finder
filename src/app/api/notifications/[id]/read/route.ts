import { NextRequest } from "next/server";
import { markAsRead } from "@/lib/services/notifications";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";
import { requireSessionUser } from "@/lib/api/session";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const { error } = await markAsRead(id, user.mongoId);
    if (error) throw new ApiErrorResponse("NOTIFICATION_ERROR", error, 400);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
