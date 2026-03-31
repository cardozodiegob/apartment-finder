import { NextRequest } from "next/server";
import { getConsentLog } from "@/lib/services/privacy";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) throw new ApiErrorResponse("VALIDATION_ERROR", "userId required", 400);
    const { logs, error } = await getConsentLog(userId);
    if (error) throw new ApiErrorResponse("CONSENT_LOG_ERROR", error, 500);
    return Response.json({ logs });
  } catch (error) {
    return errorResponse(error);
  }
}
