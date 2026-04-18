import { NextRequest } from "next/server";
import { create } from "@/lib/services/listings";
import { createListingSchema } from "@/lib/validations/listing";
import { requireActiveUser } from "@/lib/api/session";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import { sanitizeText } from "@/lib/utils/sanitize";

export async function POST(request: NextRequest) {
  try {
    const user = await requireActiveUser();

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

    // Sanitize user-generated text fields
    parsed.data.title = sanitizeText(parsed.data.title);
    parsed.data.description = sanitizeText(parsed.data.description);

    const result = await create(parsed.data, user.mongoId);
    if (result.error) {
      throw new ApiErrorResponse("CREATE_FAILED", result.error, 400);
    }

    return Response.json({ listing: result.listing }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
