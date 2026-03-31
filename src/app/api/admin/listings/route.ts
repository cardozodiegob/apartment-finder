import { NextRequest } from "next/server";
import Listing from "@/lib/db/models/Listing";
import { requireAdmin } from "@/lib/api/admin-middleware";
import { errorResponse } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const adminId = url.searchParams.get("adminId") || "";
    await requireAdmin(adminId);
    const status = url.searchParams.get("status") || undefined;
    const query = status ? { status } : {};
    const listings = await Listing.find(query).sort({ createdAt: -1 }).limit(50);
    return Response.json({ listings });
  } catch (error) {
    return errorResponse(error);
  }
}
