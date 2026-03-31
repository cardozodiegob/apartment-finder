import { NextRequest } from "next/server";
import { deleteUserData } from "@/lib/services/privacy";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) throw new ApiErrorResponse("VALIDATION_ERROR", "userId required", 400);
    const { confirmation, error } = await deleteUserData(userId);
    if (error) throw new ApiErrorResponse("DELETION_ERROR", error, 400);
    return Response.json(confirmation);
  } catch (error) {
    return errorResponse(error);
  }
}
