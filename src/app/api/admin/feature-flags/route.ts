import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api/session";
import dbConnect from "@/lib/db/connection";
import FeatureFlag from "@/lib/db/models/FeatureFlag";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";
import { _clearFeatureFlagCache } from "@/lib/services/featureFlags";

export async function GET() {
  try {
    await requireAdmin();
    await dbConnect();
    const flags = await FeatureFlag.find().sort({ name: 1 });
    return Response.json({ flags });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();
    const { name, enabled, percent, description } = await req.json();
    if (!name || typeof name !== "string") {
      throw new ApiErrorResponse("VALIDATION_ERROR", "name is required", 400);
    }
    const flag = await FeatureFlag.findOneAndUpdate(
      { name },
      {
        $set: {
          enabled: Boolean(enabled),
          percent: typeof percent === "number" ? Math.max(0, Math.min(100, percent)) : 100,
          description,
        },
      },
      { upsert: true, new: true },
    );
    _clearFeatureFlagCache();
    return Response.json({ flag });
  } catch (error) {
    return errorResponse(error);
  }
}
