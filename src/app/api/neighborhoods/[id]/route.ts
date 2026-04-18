import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import NeighborhoodGuide from "@/lib/db/models/NeighborhoodGuide";
import { requireAdmin } from "@/lib/api/session";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    const guide = await NeighborhoodGuide.findById(id).lean();
    if (!guide) throw new ApiErrorResponse("NOT_FOUND", "Guide not found", 404);
    return Response.json({ guide });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireAdmin();
    await dbConnect();
    const body = await request.json();

    const guide = await NeighborhoodGuide.findByIdAndUpdate(
      id,
      { ...body, updatedBy: admin.mongoId },
      { new: true, runValidators: true }
    );
    if (!guide) throw new ApiErrorResponse("NOT_FOUND", "Guide not found", 404);
    return Response.json({ guide });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAdmin();
    await dbConnect();
    const guide = await NeighborhoodGuide.findByIdAndDelete(id);
    if (!guide) throw new ApiErrorResponse("NOT_FOUND", "Guide not found", 404);
    return Response.json({ message: "Guide deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}
