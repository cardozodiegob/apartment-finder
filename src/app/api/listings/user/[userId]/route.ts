import { NextRequest } from "next/server";
import { getByUser } from "@/lib/services/listings";
import { getSession } from "@/lib/services/auth";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const session = await getSession();
    const status = request.nextUrl.searchParams.get("status") ?? undefined;

    // If requesting own listings, show all statuses; otherwise only active
    const isOwner = session.session?.user.id === userId;
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
