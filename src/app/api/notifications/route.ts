import { NextRequest } from "next/server";
import { getForUser } from "@/lib/services/notifications";
import { errorResponse } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";
    const { notifications, error } = await getForUser(userId, unreadOnly);
    if (error) return Response.json({ error }, { status: 500 });
    return Response.json({ notifications });
  } catch (error) {
    return errorResponse(error);
  }
}
