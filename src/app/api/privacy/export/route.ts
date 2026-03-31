import { NextRequest } from "next/server";
import { exportUserData } from "@/lib/services/privacy";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) throw new ApiErrorResponse("VALIDATION_ERROR", "userId required", 400);
    const { data, error } = await exportUserData(userId);
    if (error) throw new ApiErrorResponse("EXPORT_ERROR", error, 400);
    return new Response(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=user-data-export.json" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
