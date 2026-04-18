import { NextRequest } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { confirmViewing } from "@/lib/services/viewings";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;

    const { viewing, error } = await confirmViewing(id, user.mongoId);
    if (error) {
      throw new ApiErrorResponse("VIEWING_ERROR", error, 400);
    }

    return Response.json({ viewing });
  } catch (error) {
    return errorResponse(error);
  }
}
