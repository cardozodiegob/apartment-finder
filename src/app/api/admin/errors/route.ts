import { requireAdmin } from "@/lib/api/session";
import dbConnect from "@/lib/db/connection";
import ErrorEvent from "@/lib/db/models/ErrorEvent";
import { errorResponse } from "@/lib/api/errors";

export async function GET() {
  try {
    await requireAdmin();
    await dbConnect();
    const events = await ErrorEvent.find().sort({ createdAt: -1 }).limit(50);
    return Response.json({ events });
  } catch (error) {
    return errorResponse(error);
  }
}
