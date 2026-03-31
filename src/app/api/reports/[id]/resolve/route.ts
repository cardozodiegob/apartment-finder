import { NextRequest } from "next/server";
import { resolveReport } from "@/lib/services/reports";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { adminId, resolution, confirmed } = body;

    if (!adminId || !resolution) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "adminId and resolution are required", 400);
    }

    const { report, error } = await resolveReport(id, adminId, resolution, confirmed ?? false);
    if (error) throw new ApiErrorResponse("REPORT_ERROR", error, 400);
    return Response.json({ report });
  } catch (error) {
    return errorResponse(error);
  }
}
