import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ReportCategory =
  | "suspected_scam"
  | "misleading_information"
  | "harassment"
  | "other";

export type ReportStatus = "pending" | "investigating" | "resolved";

export interface IReport extends Document {
  reporterId: Types.ObjectId;
  reportedUserId?: Types.ObjectId;
  reportedListingId?: Types.ObjectId;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  resolution?: string;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reportedUserId: { type: Schema.Types.ObjectId, ref: "User" },
    reportedListingId: { type: Schema.Types.ObjectId, ref: "Listing" },
    category: {
      type: String,
      enum: [
        "suspected_scam",
        "misleading_information",
        "harassment",
        "other",
      ],
      required: true,
    },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "investigating", "resolved"],
      default: "pending",
    },
    resolution: { type: String },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound index for admin report queue sorted by status and date
ReportSchema.index({ status: 1, createdAt: 1 });

const Report: Model<IReport> =
  mongoose.models.Report || mongoose.model<IReport>("Report", ReportSchema);

export default Report;
