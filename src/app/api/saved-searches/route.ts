import { NextRequest } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";
import dbConnect from "@/lib/db/connection";
import SavedSearch from "@/lib/db/models/SavedSearch";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser();
    await dbConnect();

    const body = await request.json();
    const { name, filters, emailAlertsEnabled } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "Name is required", 400);
    }
    if (!filters || typeof filters !== "object") {
      throw new ApiErrorResponse("VALIDATION_ERROR", "Filters are required", 400);
    }

    const savedSearch = await SavedSearch.create({
      userId: user.mongoId,
      name: name.trim(),
      filters,
      emailAlertsEnabled: Boolean(emailAlertsEnabled),
    });

    return Response.json({ savedSearch }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  try {
    const user = await requireSessionUser();
    await dbConnect();

    const savedSearches = await SavedSearch.find({ userId: user.mongoId })
      .sort({ createdAt: -1 })
      .limit(50);

    return Response.json({ savedSearches });
  } catch (error) {
    return errorResponse(error);
  }
}
