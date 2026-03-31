import { NextRequest } from "next/server";
import { calculateScore } from "@/lib/services/trust";
import { errorResponse } from "@/lib/api/errors";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await calculateScore(id);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
