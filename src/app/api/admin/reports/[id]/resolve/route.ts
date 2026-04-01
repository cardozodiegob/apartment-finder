import { NextRequest } from "next/server";
import { resolveReport } from "@/lib/services/reports";
import { requireAdmin } from "@/lib/api/session";
import { logModerationAction } from "@/lib/api/admin-middleware";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const admin = await requireAdmin();
    const { report, error } = await resolveReport(id, admin.mongoId, body.resolution, body.confirmed ?? false);
    if (error) throw new ApiErrorResponse("REPORT_ERROR", error, 400);
    await logModerationAction(admin.mongoId, "resolve_report", "report", id, body.resolution);
    return Response.json({ report });
  } catch (error) {
    return errorResponse(error);
  }
}
