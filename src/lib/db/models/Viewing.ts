import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ViewingStatus = "pending" | "confirmed" | "declined" | "completed";

export interface IViewing extends Document {
  listingId: Types.ObjectId;
  seekerId: Types.ObjectId;
  posterId: Types.ObjectId;
  proposedDate: Date;
  status: ViewingStatus;
  declineReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ViewingSchema = new Schema<IViewing>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    seekerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    posterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    proposedDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "declined", "completed"],
      default: "pending",
    },
    declineReason: { type: String },
  },
  { timestamps: true }
);

ViewingSchema.index({ listingId: 1, seekerId: 1, status: 1 });
ViewingSchema.index({ posterId: 1, status: 1 });
ViewingSchema.index({ status: 1, proposedDate: 1 });

const Viewing: Model<IViewing> =
  mongoose.models.Viewing || mongoose.model<IViewing>("Viewing", ViewingSchema);

export default Viewing;
