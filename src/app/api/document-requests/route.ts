import { NextRequest } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import dbConnect from "@/lib/db/connection";
import DocumentRequest from "@/lib/db/models/DocumentRequest";
import MessageThread from "@/lib/db/models/MessageThread";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

/**
 * POST /api/document-requests
 * Body: { threadId: string, targetId: string, categories: string[], message?: string }
 *
 * A poster asks a seeker for specific document categories.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser();
    await dbConnect();

    const { threadId, targetId, categories, message } = (await req.json()) as {
      threadId?: string;
      targetId?: string;
      categories?: string[];
      message?: string;
    };

    if (!threadId || !targetId || !Array.isArray(categories) || categories.length === 0) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "threadId, targetId, categories are required", 400);
    }

    // Verify the requester is actually a participant of the thread
    const thread = await MessageThread.findById(threadId);
    if (!thread || !thread.participants.some((p) => p.toString() === user.mongoId)) {
      throw new ApiErrorResponse("FORBIDDEN", "Not a participant of this thread", 403);
    }

    const doc = await DocumentRequest.create({
      threadId,
      requesterId: user.mongoId,
      targetId,
      categories,
      message,
    });

    return Response.json({ request: doc });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireSessionUser();
    await dbConnect();
    const threadId = req.nextUrl.searchParams.get("threadId");
    const query: Record<string, unknown> = {
      $or: [{ targetId: user.mongoId }, { requesterId: user.mongoId }],
    };
    if (threadId) query.threadId = threadId;
    const requests = await DocumentRequest.find(query).sort({ createdAt: -1 }).limit(50);
    return Response.json({ requests });
  } catch (error) {
    return errorResponse(error);
  }
}
