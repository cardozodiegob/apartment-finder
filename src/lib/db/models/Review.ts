import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IReview extends Document {
  reviewerId: Types.ObjectId;
  reviewedUserId: Types.ObjectId;
  transactionId: Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    reviewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound index for fetching reviews by user sorted by date
ReviewSchema.index({ reviewedUserId: 1, createdAt: -1 });

const Review: Model<IReview> =
  mongoose.models.Review || mongoose.model<IReview>("Review", ReviewSchema);

export default Review;
