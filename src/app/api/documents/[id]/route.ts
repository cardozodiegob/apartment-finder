import { NextRequest } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { deleteDocument } from "@/lib/services/documents";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;

    const { error } = await deleteDocument(id, user.mongoId);
    if (error) {
      throw new ApiErrorResponse("DOCUMENT_ERROR", error, 400);
    }

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
