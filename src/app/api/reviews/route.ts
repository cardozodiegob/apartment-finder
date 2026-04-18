import { NextRequest } from "next/server";
import { submitReview } from "@/lib/services/trust";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";
import { sanitizeText } from "@/lib/utils/sanitize";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.comment && typeof body.comment === "string") {
      body.comment = sanitizeText(body.comment);
    }
    const { review, error } = await submitReview(body);
    if (error) throw new ApiErrorResponse("REVIEW_ERROR", error, 400);
    return Response.json({ review }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
