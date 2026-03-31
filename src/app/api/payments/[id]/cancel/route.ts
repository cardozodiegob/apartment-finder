import { NextRequest } from "next/server";
import { cancelPayment } from "@/lib/services/payments";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { payment, error } = await cancelPayment(id, body.reason || "Cancelled by user");
    if (error) throw new ApiErrorResponse("PAYMENT_ERROR", error, 400);
    return Response.json({ payment });
  } catch (error) {
    return errorResponse(error);
  }
}
