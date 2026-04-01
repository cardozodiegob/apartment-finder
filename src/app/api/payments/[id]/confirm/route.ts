import { NextRequest } from "next/server";
import { confirmPayment } from "@/lib/services/payments";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";
import { requireActiveUser } from "@/lib/api/session";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;
    const { payment, error } = await confirmPayment(id, user.mongoId);
    if (error) throw new ApiErrorResponse("PAYMENT_ERROR", error, 400);
    return Response.json({ payment });
  } catch (error) {
    return errorResponse(error);
  }
}
