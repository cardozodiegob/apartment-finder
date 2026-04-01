import { NextRequest } from "next/server";
import { createReport, getReports } from "@/lib/services/reports";
import { requireSessionUser } from "@/lib/api/session";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser();
    const body = await request.json();
    const { report, error } = await createReport({
      ...body,
      reporterId: user.mongoId,
    });
    if (error) throw new ApiErrorResponse("REPORT_ERROR", error, 400);
    return Response.json({ report }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const { reports, error } = await getReports(status);
    if (error) throw new ApiErrorResponse("REPORT_ERROR", error, 500);
    return Response.json({ reports });
  } catch (error) {
    return errorResponse(error);
  }
}
