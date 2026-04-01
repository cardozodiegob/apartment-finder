import { NextRequest } from "next/server";
import { initiatePayment } from "@/lib/services/payments";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";
import { requireActiveUser } from "@/lib/api/session";

export async function POST(request: NextRequest) {
  try {
    const user = await requireActiveUser();
    const body = await request.json();
    const { payment, error } = await initiatePayment({
      ...body,
      seekerId: user.mongoId,
    });
    if (error) throw new ApiErrorResponse("PAYMENT_ERROR", error, 400);
    return Response.json({ payment }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
