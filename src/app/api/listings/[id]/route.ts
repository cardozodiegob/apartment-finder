import { NextRequest } from "next/server";
import { update, getById, deleteListing } from "@/lib/services/listings";
import { updateListingSchema } from "@/lib/validations/listing";
import { getSession } from "@/lib/services/auth";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session.session) {
      throw new ApiErrorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateListingSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiErrorResponse(
        "VALIDATION_ERROR",
        parsed.error.errors[0].message,
        400,
        parsed.error.errors
      );
    }

    const result = await update(id, parsed.data, session.session.user.id);
    if (result.error) {
      const status = result.error.includes("Not authorized") ? 403 : 400;
      throw new ApiErrorResponse("UPDATE_FAILED", result.error, status);
    }

    return Response.json({ listing: result.listing });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    const userId = session.session?.user.id;

    const result = await getById(id, userId);
    if (result.error || !result.listing) {
      throw new ApiErrorResponse(
        "NOT_FOUND",
        result.error || "Listing not found",
        404
      );
    }

    return Response.json({ listing: result.listing });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session.session) {
      throw new ApiErrorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { id } = await params;
    const result = await deleteListing(id, session.session.user.id);
    if (result.error) {
      const status = result.error.includes("Not authorized") ? 403 : 400;
      throw new ApiErrorResponse("DELETE_FAILED", result.error, status);
    }

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
