import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type DocumentType =
  | "proof_of_income"
  | "employment_letter"
  | "reference_letter"
  | "identity_document"
  | "bank_statement";

export interface ITenantDocument extends Document {
  userId: Types.ObjectId;
  documentType: DocumentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  createdAt: Date;
}

const TenantDocumentSchema = new Schema<ITenantDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    documentType: {
      type: String,
      enum: [
        "proof_of_income",
        "employment_letter",
        "reference_letter",
        "identity_document",
        "bank_statement",
      ],
      required: true,
    },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    storagePath: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

TenantDocumentSchema.index({ userId: 1, documentType: 1 });

const TenantDocument: Model<ITenantDocument> =
  mongoose.models.TenantDocument ||
  mongoose.model<ITenantDocument>("TenantDocument", TenantDocumentSchema);

export default TenantDocument;
