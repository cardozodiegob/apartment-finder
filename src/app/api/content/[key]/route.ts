import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import SiteContent from "@/lib/db/models/SiteContent";
import { requireAdmin } from "@/lib/api/session";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await dbConnect();
    const { key } = await params;
    const content = await SiteContent.findOne({ key });
    if (!content) {
      throw new ApiErrorResponse("NOT_FOUND", "Content not found", 404);
    }
    return Response.json({ content });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const admin = await requireAdmin();
    await dbConnect();
    const { key } = await params;
    const body = await request.json();
    const { title, body: contentBody, contentType } = body;

    if (!title || !contentBody || !contentType) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "title, body, and contentType are required", 400);
    }

    const content = await SiteContent.findOneAndUpdate(
      { key },
      { key, title, body: contentBody, contentType, updatedBy: admin.mongoId },
      { upsert: true, new: true, runValidators: true }
    );

    return Response.json({ content });
  } catch (error) {
    return errorResponse(error);
  }
}
