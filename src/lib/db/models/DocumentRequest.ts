import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type DocumentRequestStatus = "pending" | "fulfilled" | "dismissed";

export interface IDocumentRequest extends Document {
  threadId: Types.ObjectId;
  requesterId: Types.ObjectId; // poster asking
  targetId: Types.ObjectId;    // seeker being asked
  categories: string[];        // e.g. ["income", "identity"]
  message?: string;
  status: DocumentRequestStatus;
  fulfilledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentRequestSchema = new Schema<IDocumentRequest>(
  {
    threadId: { type: Schema.Types.ObjectId, ref: "MessageThread", required: true },
    requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    categories: { type: [String], default: [] },
    message: { type: String, maxlength: 500 },
    status: {
      type: String,
      enum: ["pending", "fulfilled", "dismissed"],
      default: "pending",
    },
    fulfilledAt: { type: Date },
  },
  { timestamps: true },
);

DocumentRequestSchema.index({ targetId: 1, status: 1 });
DocumentRequestSchema.index({ threadId: 1, createdAt: -1 });

const DocumentRequest: Model<IDocumentRequest> =
  mongoose.models.DocumentRequest ||
  mongoose.model<IDocumentRequest>("DocumentRequest", DocumentRequestSchema);

export default DocumentRequest;
