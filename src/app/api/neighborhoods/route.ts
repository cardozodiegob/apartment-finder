import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import NeighborhoodGuide from "@/lib/db/models/NeighborhoodGuide";
import { requireAdmin } from "@/lib/api/session";
import { errorResponse } from "@/lib/api/errors";

export async function GET() {
  try {
    await dbConnect();
    const guides = await NeighborhoodGuide.find({ isPublished: true })
      .sort({ city: 1, neighborhood: 1 })
      .lean();
    return Response.json({ guides });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    await dbConnect();
    const body = await request.json();

    const guide = await NeighborhoodGuide.create({
      ...body,
      updatedBy: admin.mongoId,
    });

    return Response.json({ guide }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
