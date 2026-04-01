import { NextRequest } from "next/server";
import { getForUser } from "@/lib/services/notifications";
import { errorResponse } from "@/lib/api/errors";
import { requireSessionUser } from "@/lib/api/session";

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser();
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";
    const { notifications, error } = await getForUser(user.mongoId, unreadOnly);
    if (error) return Response.json({ error }, { status: 500 });
    return Response.json({ notifications });
  } catch (error) {
    return errorResponse(error);
  }
}
