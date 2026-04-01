import { NextRequest } from "next/server";
import { uploadPhotos } from "@/lib/services/listings";
import type { PhotoFile } from "@/lib/services/listings";
import { requireActiveUser } from "@/lib/api/session";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser();

    const { id } = await params;
    const formData = await request.formData();
    const files: PhotoFile[] = [];

    for (const [, value] of formData.entries()) {
      if (value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        files.push({
          name: value.name,
          size: value.size,
          type: value.type,
          buffer,
        });
      }
    }

    if (files.length === 0) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "No photos provided", 400);
    }

    const result = await uploadPhotos(id, user.mongoId, files);
    if (result.error) {
      const status = result.error.includes("Not authorized") ? 403 : 400;
      throw new ApiErrorResponse("UPLOAD_FAILED", result.error, status);
    }

    return Response.json({ urls: result.urls, hashes: result.hashes }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
