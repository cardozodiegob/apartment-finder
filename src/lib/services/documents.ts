import dbConnect from "@/lib/db/connection";
import TenantDocument from "@/lib/db/models/TenantDocument";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ITenantDocument } from "@/lib/db/models/TenantDocument";
import mongoose from "mongoose";

const BUCKET = "tenant-documents";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf": return "pdf";
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    default: return "bin";
  }
}

export async function uploadDocument(
  userId: string,
  file: { buffer: Buffer; originalName: string; mimeType: string; size: number },
  documentType: string
): Promise<{ document: ITenantDocument | null; error: string | null }> {
  try {
    // Validate mime type
    if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
      return { document: null, error: "Only PDF, JPG, and PNG files are accepted" };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return { document: null, error: "File size must not exceed 10MB" };
    }

    await dbConnect();

    const docId = new mongoose.Types.ObjectId();
    const ext = getExtension(file.mimeType);
    const storagePath = `${userId}/${docId}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimeType,
        upsert: false,
      });

    if (uploadError) {
      return { document: null, error: `Storage upload failed: ${uploadError.message}` };
    }

    // Create metadata record
    const document = await TenantDocument.create({
      _id: docId,
      userId,
      documentType,
      fileName: file.originalName,
      fileSize: file.size,
      mimeType: file.mimeType,
      storagePath,
    });

    return { document, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to upload document";
    return { document: null, error: msg };
  }
}

export async function listDocuments(
  userId: string
): Promise<{ documents: ITenantDocument[]; error: string | null }> {
  try {
    await dbConnect();
    const documents = await TenantDocument.find({ userId }).sort({ createdAt: -1 });
    return { documents, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to list documents";
    return { documents: [], error: msg };
  }
}

export async function deleteDocument(
  documentId: string,
  userId: string
): Promise<{ error: string | null }> {
  try {
    await dbConnect();

    const doc = await TenantDocument.findById(documentId);
    if (!doc) return { error: "Document not found" };
    if (doc.userId.toString() !== userId) return { error: "Not authorized" };

    // Remove from storage
    const { error: storageError } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([doc.storagePath]);

    if (storageError) {
      return { error: `Storage deletion failed: ${storageError.message}` };
    }

    await TenantDocument.findByIdAndDelete(documentId);
    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete document";
    return { error: msg };
  }
}

export async function generateShareUrl(
  documentId: string,
  userId: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    await dbConnect();

    const doc = await TenantDocument.findById(documentId);
    if (!doc) return { url: null, error: "Document not found" };
    if (doc.userId.toString() !== userId) return { url: null, error: "Not authorized" };

    const { data, error: signError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(doc.storagePath, 7 * 24 * 60 * 60); // 7 days in seconds

    if (signError || !data?.signedUrl) {
      return { url: null, error: "Failed to generate share URL" };
    }

    return { url: data.signedUrl, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate share URL";
    return { url: null, error: msg };
  }
}
