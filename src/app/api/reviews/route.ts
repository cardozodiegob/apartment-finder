import { NextRequest } from "next/server";
import { submitReview } from "@/lib/services/trust";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { review, error } = await submitReview(body);
    if (error) throw new ApiErrorResponse("REVIEW_ERROR", error, 400);
    return Response.json({ review }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
