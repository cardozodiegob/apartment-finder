import { NextRequest } from "next/server";
import { isFeatureEnabled } from "@/lib/services/featureFlags";
import { getSessionUser } from "@/lib/api/session";
import { errorResponse } from "@/lib/api/errors";

/**
 * GET /api/feature-flags/[name]
 *
 * Returns `{ enabled: boolean }` for the current user. Anonymous callers get
 * the default bucket (0) so they only see flags at 100% rollout.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const user = await getSessionUser();
    const enabled = await isFeatureEnabled(name, user?.mongoId);
    return Response.json({ enabled });
  } catch (error) {
    return errorResponse(error);
  }
}
