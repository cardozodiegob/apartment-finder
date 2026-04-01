import { NextRequest } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { getMessages } from "@/lib/services/messages";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { threadId } = await params;

    const { messages, error } = await getMessages(threadId, user.mongoId);
    if (error) {
      throw new ApiErrorResponse("MESSAGE_ERROR", error, 403);
    }

    return Response.json({ messages });
  } catch (error) {
    return errorResponse(error);
  }
}
