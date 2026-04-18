import { NextRequest } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { requestViewing, getViewingsForUser } from "@/lib/services/viewings";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser();
    const body = await request.json();
    const { listingId, proposedDate } = body;

    if (!listingId || typeof listingId !== "string") {
      throw new ApiErrorResponse("VALIDATION_ERROR", "listingId is required", 400);
    }
    if (!proposedDate) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "proposedDate is required", 400);
    }

    const date = new Date(proposedDate);
    if (isNaN(date.getTime())) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "Invalid date format", 400);
    }

    const { viewing, error } = await requestViewing(user.mongoId, listingId, date);
    if (error) {
      throw new ApiErrorResponse("VIEWING_ERROR", error, 400);
    }

    return Response.json({ viewing }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  try {
    const user = await requireSessionUser();
    const { viewings, error } = await getViewingsForUser(user.mongoId);
    if (error) {
      throw new ApiErrorResponse("VIEWING_ERROR", error, 500);
    }
    return Response.json({ viewings });
  } catch (error) {
    return errorResponse(error);
  }
}
