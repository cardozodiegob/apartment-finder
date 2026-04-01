import { NextRequest } from "next/server";
import { getByUser } from "@/lib/services/listings";
import { getSessionUser } from "@/lib/api/session";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import dbConnect from "@/lib/db/connection";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await dbConnect();
    const { userId } = await params;
    const sessionUser = await getSessionUser();
    const status = request.nextUrl.searchParams.get("status") ?? undefined;

    // If requesting own listings, show all statuses; otherwise only active
    const isOwner = sessionUser?.mongoId === userId;
    const effectiveStatus = isOwner ? status : "active";

    const result = await getByUser(userId, effectiveStatus);
    if (result.error) {
      throw new ApiErrorResponse("FETCH_FAILED", result.error, 500);
    }

    return Response.json({ listings: result.listings });
  } catch (error) {
    return errorResponse(error);
  }
}
