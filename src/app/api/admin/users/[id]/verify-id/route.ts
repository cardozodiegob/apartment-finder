import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import User from "@/lib/db/models/User";
import { requireAdmin } from "@/lib/api/session";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";
import { logModerationAction } from "@/lib/api/admin-middleware";

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    await dbConnect();
    const { id } = await params;

    const user = await User.findById(id);
    if (!user) {
      throw new ApiErrorResponse("NOT_FOUND", "User not found", 404);
    }

    user.idVerified = !user.idVerified;
    await user.save();

    await logModerationAction(
      admin.mongoId,
      user.idVerified ? "verify_id" : "unverify_id",
      "user",
      id,
      `Identity ${user.idVerified ? "verified" : "unverified"} by admin`
    );

    return Response.json({
      user: {
        _id: user._id,
        idVerified: user.idVerified,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
