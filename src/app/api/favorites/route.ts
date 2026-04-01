import { NextRequest } from "next/server";
import { requireActiveUser } from "@/lib/api/session";
import { addFavorite, getFavorites } from "@/lib/services/favorites";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireActiveUser();
    const body = await request.json();
    const { listingId } = body;

    if (!listingId || typeof listingId !== "string") {
      throw new ApiErrorResponse(
        "VALIDATION_ERROR",
        "listingId is required",
        400
      );
    }

    const { error } = await addFavorite(user.mongoId, listingId);
    if (error) {
      throw new ApiErrorResponse("FAVORITE_ERROR", error, 400);
    }

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  try {
    const user = await requireActiveUser();
    const { favorites, error } = await getFavorites(user.mongoId);
    if (error) {
      throw new ApiErrorResponse("FAVORITE_ERROR", error, 500);
    }

    return Response.json({ favorites });
  } catch (error) {
    return errorResponse(error);
  }
}
