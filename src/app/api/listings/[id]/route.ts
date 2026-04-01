import { NextRequest } from "next/server";
import { update, getById, deleteListing } from "@/lib/services/listings";
import { updateListingSchema } from "@/lib/validations/listing";
import { requireActiveUser, getSessionUser } from "@/lib/api/session";
import { isFavorited } from "@/lib/services/favorites";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import dbConnect from "@/lib/db/connection";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser();

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

    const result = await update(id, parsed.data, user.mongoId);
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
    await dbConnect();
    const { id } = await params;
    const sessionUser = await getSessionUser();
    const userId = sessionUser?.mongoId;

    const result = await getById(id, userId);
    if (result.error || !result.listing) {
      throw new ApiErrorResponse(
        "NOT_FOUND",
        result.error || "Listing not found",
        404
      );
    }

    const response: Record<string, unknown> = { listing: result.listing };

    if (sessionUser) {
      response.isFavorited = await isFavorited(sessionUser.mongoId, id);
    }

    return Response.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser();

    const { id } = await params;
    const result = await deleteListing(id, user.mongoId);
    if (result.error) {
      const status = result.error.includes("Not authorized") ? 403 : 400;
      throw new ApiErrorResponse("DELETE_FAILED", result.error, status);
    }

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
