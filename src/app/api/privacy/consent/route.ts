import { NextRequest } from "next/server";
import { updateConsent } from "@/lib/services/privacy";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.userId || !body.purpose || body.consented === undefined) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "userId, purpose, and consented are required", 400);
    }
    const ip = request.headers.get("x-forwarded-for") || undefined;
    const { error } = await updateConsent(body.userId, { purpose: body.purpose, consented: body.consented }, ip);
    if (error) throw new ApiErrorResponse("CONSENT_ERROR", error, 400);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
