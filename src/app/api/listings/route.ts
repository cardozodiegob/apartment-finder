import { NextRequest } from "next/server";
import { create } from "@/lib/services/listings";
import { createListingSchema } from "@/lib/validations/listing";
import { getSession } from "@/lib/services/auth";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.session) {
      throw new ApiErrorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const body = await request.json();
    const parsed = createListingSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiErrorResponse(
        "VALIDATION_ERROR",
        parsed.error.errors[0].message,
        400,
        parsed.error.errors
      );
    }

    const result = await create(parsed.data, session.session.user.id);
    if (result.error) {
      throw new ApiErrorResponse("CREATE_FAILED", result.error, 400);
    }

    return Response.json({ listing: result.listing }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
