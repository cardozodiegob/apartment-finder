import { NextRequest } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { uploadDocument, listDocuments } from "@/lib/services/documents";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";

const VALID_DOC_TYPES = [
  "proof_of_income",
  "employment_letter",
  "reference_letter",
  "identity_document",
  "bank_statement",
];

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentType = formData.get("documentType") as string | null;

    if (!file) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "File is required", 400);
    }
    if (!documentType || !VALID_DOC_TYPES.includes(documentType)) {
      throw new ApiErrorResponse(
        "VALIDATION_ERROR",
        `documentType must be one of: ${VALID_DOC_TYPES.join(", ")}`,
        400
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const { document, error } = await uploadDocument(
      user.mongoId,
      {
        buffer,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
      },
      documentType
    );

    if (error) {
      throw new ApiErrorResponse("DOCUMENT_ERROR", error, 400);
    }

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  try {
    const user = await requireSessionUser();
    const { documents, error } = await listDocuments(user.mongoId);
    if (error) {
      throw new ApiErrorResponse("DOCUMENT_ERROR", error, 500);
    }
    return Response.json({ documents });
  } catch (error) {
    return errorResponse(error);
  }
}
