import { NextRequest } from "next/server";
import { requireActiveUser } from "@/lib/api/session";
import { removeFavorite } from "@/lib/services/favorites";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const user = await requireActiveUser();
    const { listingId } = await params;

    const { error } = await removeFavorite(user.mongoId, listingId);
    if (error) {
      throw new ApiErrorResponse("FAVORITE_ERROR", error, 400);
    }

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
