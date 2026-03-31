import { NextRequest } from "next/server";
import User from "@/lib/db/models/User";
import { requireAdmin, logModerationAction } from "@/lib/api/admin-middleware";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    await requireAdmin(body.adminId);
    const user = await User.findById(id);
    if (!user) throw new ApiErrorResponse("NOT_FOUND", "User not found", 404);
    user.isSuspended = true;
    user.suspensionReason = body.reason || "Suspended by admin";
    await user.save();
    await logModerationAction(body.adminId, "suspend_user", "user", id, body.reason || "Suspended by admin");
    return Response.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
