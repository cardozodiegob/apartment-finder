import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { requireSessionUser } from "@/lib/api/session";
import dbConnect from "@/lib/db/connection";
import FavoriteShare from "@/lib/db/models/FavoriteShare";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

/**
 * POST /api/favorites/share
 * Body: { folderName: string }
 *
 * Creates (or returns existing) share token for the caller's folder.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser();
    await dbConnect();

    const { folderName } = await req.json();
    if (!folderName || typeof folderName !== "string") {
      throw new ApiErrorResponse("VALIDATION_ERROR", "folderName is required", 400);
    }

    const existing = await FavoriteShare.findOne({
      userId: user.mongoId,
      folderName,
    });
    if (existing) return Response.json({ token: existing.token });

    const token = randomBytes(12).toString("base64url");
    const doc = await FavoriteShare.create({
      userId: user.mongoId,
      folderName,
      token,
    });

    return Response.json({ token: doc.token });
  } catch (error) {
    return errorResponse(error);
  }
}
