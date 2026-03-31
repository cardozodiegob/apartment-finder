import { NextRequest } from "next/server";
import Report from "@/lib/db/models/Report";
import { requireAdmin } from "@/lib/api/admin-middleware";
import { errorResponse } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const adminId = url.searchParams.get("adminId") || "";
    await requireAdmin(adminId);
    // Sorted by oldest unresolved first
    const reports = await Report.find({ status: { $ne: "resolved" } }).sort({ createdAt: 1 });
    return Response.json({ reports });
  } catch (error) {
    return errorResponse(error);
  }
}
