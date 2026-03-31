import { NextRequest } from "next/server";
import { raiseDispute } from "@/lib/services/payments";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.userId || !body.reason) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "userId and reason are required", 400);
    }
    const { payment, error } = await raiseDispute(id, body.userId, body.reason);
    if (error) throw new ApiErrorResponse("PAYMENT_ERROR", error, 400);
    return Response.json({ payment });
  } catch (error) {
    return errorResponse(error);
  }
}
