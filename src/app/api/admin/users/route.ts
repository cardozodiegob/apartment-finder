import { NextRequest } from "next/server";
import User from "@/lib/db/models/User";
import { requireAdmin } from "@/lib/api/admin-middleware";
import { errorResponse } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const adminId = url.searchParams.get("adminId") || "";
    await requireAdmin(adminId);
    const search = url.searchParams.get("search") || "";
    const query = search ? { $or: [{ email: { $regex: search, $options: "i" } }, { fullName: { $regex: search, $options: "i" } }] } : {};
    const users = await User.find(query).sort({ createdAt: -1 }).limit(50);
    return Response.json({ users });
  } catch (error) {
    return errorResponse(error);
  }
}
