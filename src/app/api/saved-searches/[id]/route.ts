import { NextRequest } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";
import dbConnect from "@/lib/db/connection";
import SavedSearch from "@/lib/db/models/SavedSearch";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSessionUser();
    await dbConnect();

    const { id } = await params;
    const result = await SavedSearch.findOneAndDelete({
      _id: id,
      userId: user.mongoId,
    });

    if (!result) {
      throw new ApiErrorResponse("NOT_FOUND", "Saved search not found", 404);
    }

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
