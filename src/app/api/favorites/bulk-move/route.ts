import { NextRequest } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import dbConnect from "@/lib/db/connection";
import Favorite from "@/lib/db/models/Favorite";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

/**
 * POST /api/favorites/bulk-move
 * Body: { ids: string[], folderName: string }
 *
 * Moves a batch of the caller's favorites into the target folder.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser();
    await dbConnect();

    const { ids, folderName } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "ids are required", 400);
    }
    if (!folderName || typeof folderName !== "string") {
      throw new ApiErrorResponse("VALIDATION_ERROR", "folderName is required", 400);
    }

    const res = await Favorite.updateMany(
      { _id: { $in: ids }, userId: user.mongoId },
      { $set: { folderName } },
    );

    return Response.json({ updated: res.modifiedCount });
  } catch (error) {
    return errorResponse(error);
  }
}
