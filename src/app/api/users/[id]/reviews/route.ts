import { NextRequest } from "next/server";
import { getReviewsForUser } from "@/lib/services/trust";
import { errorResponse } from "@/lib/api/errors";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { reviews, error } = await getReviewsForUser(id);
    if (error) return Response.json({ error }, { status: 500 });
    return Response.json({ reviews });
  } catch (error) {
    return errorResponse(error);
  }
}
