import { NextRequest } from "next/server";
import { requireActiveUser } from "@/lib/api/session";
import { sendMessage } from "@/lib/services/messages";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import { sanitizeText } from "@/lib/utils/sanitize";

export async function POST(request: NextRequest) {
  try {
    const user = await requireActiveUser();
    const body = await request.json();
    const { listingId, body: messageBody } = body;

    if (!listingId || typeof listingId !== "string") {
      throw new ApiErrorResponse(
        "VALIDATION_ERROR",
        "listingId is required",
        400
      );
    }

    if (!messageBody || typeof messageBody !== "string") {
      throw new ApiErrorResponse(
        "VALIDATION_ERROR",
        "body is required",
        400
      );
    }

    const sanitizedBody = sanitizeText(messageBody);

    const { message, error } = await sendMessage(
      user.mongoId,
      listingId,
      sanitizedBody
    );
    if (error) {
      throw new ApiErrorResponse("MESSAGE_ERROR", error, 400);
    }

    return Response.json({ message }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
