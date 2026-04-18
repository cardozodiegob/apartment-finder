import { requireSessionUser } from "@/lib/api/session";
import { createVerificationSession } from "@/lib/services/kyc";
import { errorResponse } from "@/lib/api/errors";

/**
 * POST /api/kyc/start — returns a verification session URL for the current user.
 */
export async function POST() {
  try {
    const user = await requireSessionUser();
    const session = await createVerificationSession(user.mongoId);
    return Response.json({ session });
  } catch (error) {
    return errorResponse(error);
  }
}
