import { NextRequest } from "next/server";
import { raiseDispute } from "@/lib/services/payments";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";
import { requireActiveUser } from "@/lib/api/session";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;
    const body = await request.json();
    if (!body.reason) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "reason is required", 400);
    }
    const { payment, error } = await raiseDispute(id, user.mongoId, body.reason);
    if (error) throw new ApiErrorResponse("PAYMENT_ERROR", error, 400);
    return Response.json({ payment });
  } catch (error) {
    return errorResponse(error);
  }
}
