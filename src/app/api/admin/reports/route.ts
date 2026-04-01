import Report from "@/lib/db/models/Report";
import { requireAdmin } from "@/lib/api/session";
import { errorResponse } from "@/lib/api/errors";

export async function GET() {
  try {
    const admin = await requireAdmin();
    // Sorted by oldest unresolved first
    const reports = await Report.find({ status: { $ne: "resolved" } }).sort({ createdAt: 1 });
    return Response.json({ reports });
  } catch (error) {
    return errorResponse(error);
  }
}
