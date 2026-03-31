import { NextRequest } from "next/server";
import { initiatePayment } from "@/lib/services/payments";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payment, error } = await initiatePayment(body);
    if (error) throw new ApiErrorResponse("PAYMENT_ERROR", error, 400);
    return Response.json({ payment }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
