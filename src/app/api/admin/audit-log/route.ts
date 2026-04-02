import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api/session";
import { errorResponse } from "@/lib/api/errors";
import dbConnect from "@/lib/db/connection";
import AuditLog from "@/lib/db/models/AuditLog";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = 20;
    const action = url.searchParams.get("action") || undefined;

    const filter: Record<string, unknown> = {};
    if (action) {
      filter.action = action;
    }

    const [entries, totalCount] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("adminId", "fullName email"),
      AuditLog.countDocuments(filter),
    ]);

    return Response.json({
      entries: entries.map((e) => ({
        _id: e._id,
        adminName: (e.adminId as unknown as { fullName?: string })?.fullName || "Unknown",
        action: e.action,
        targetType: e.targetType,
        targetId: e.targetId,
        details: e.details,
        ipAddress: e.ipAddress,
        timestamp: e.timestamp,
      })),
      page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
