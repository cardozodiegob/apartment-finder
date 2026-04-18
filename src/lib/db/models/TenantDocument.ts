import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type DocumentType =
  | "proof_of_income"
  | "employment_letter"
  | "reference_letter"
  | "identity_document"
  | "bank_statement";

export type DocumentCategory = "income" | "identity" | "reference" | "other";

export const CATEGORY_FOR_TYPE: Record<DocumentType, DocumentCategory> = {
  proof_of_income: "income",
  employment_letter: "income",
  bank_statement: "income",
  identity_document: "identity",
  reference_letter: "reference",
};

export interface ITenantDocument extends Document {
  userId: Types.ObjectId;
  documentType: DocumentType;
  category: DocumentCategory;
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
    category: {
      type: String,
      enum: ["income", "identity", "reference", "other"],
      required: true,
      default: "other",
    },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    storagePath: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Auto-derive category from documentType when not set
TenantDocumentSchema.pre("save", function (next) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self = this as any;
  if (!self.category && self.documentType) {
    self.category = CATEGORY_FOR_TYPE[self.documentType as DocumentType] ?? "other";
  }
  next();
});

TenantDocumentSchema.index({ userId: 1, documentType: 1 });
TenantDocumentSchema.index({ userId: 1, category: 1 });

const TenantDocument: Model<ITenantDocument> =
  mongoose.models.TenantDocument ||
  mongoose.model<ITenantDocument>("TenantDocument", TenantDocumentSchema);

export default TenantDocument;
