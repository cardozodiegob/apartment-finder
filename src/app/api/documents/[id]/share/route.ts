import { NextRequest } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { generateShareUrl } from "@/lib/services/documents";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;

    const { url, error } = await generateShareUrl(id, user.mongoId);
    if (error) {
      throw new ApiErrorResponse("DOCUMENT_ERROR", error, 400);
    }

    return Response.json({ url });
  } catch (error) {
    return errorResponse(error);
  }
}
