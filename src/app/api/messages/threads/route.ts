import { requireSessionUser } from "@/lib/api/session";
import { getThreads } from "@/lib/services/messages";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const { threads, error } = await getThreads(user.mongoId);
    if (error) {
      throw new ApiErrorResponse("MESSAGE_ERROR", error, 500);
    }

    return Response.json({ threads });
  } catch (error) {
    return errorResponse(error);
  }
}
