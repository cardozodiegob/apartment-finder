import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type PaymentStatus =
  | "pending"
  | "seeker_confirmed"
  | "poster_confirmed"
  | "both_confirmed"
  | "processing"
  | "completed"
  | "cancelled"
  | "disputed";

export type PaymentCurrency = "EUR" | "GBP" | "CHF" | "USD";

export interface IPayment extends Document {
  seekerId: Types.ObjectId;
  posterId: Types.ObjectId;
  listingId: Types.ObjectId;
  amount: number;
  currency: PaymentCurrency;
  stripePaymentIntentId: string;
  status: PaymentStatus;
  seekerConfirmedAt?: Date;
  posterConfirmedAt?: Date;
  escrowExpiresAt: Date;
  disputeReason?: string;
  receiptUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    seekerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    posterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    listingId: {
      type: Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      enum: ["EUR", "GBP", "CHF", "USD"],
      required: true,
    },
    stripePaymentIntentId: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "seeker_confirmed",
        "poster_confirmed",
        "both_confirmed",
        "processing",
        "completed",
        "cancelled",
        "disputed",
      ],
      default: "pending",
    },
    seekerConfirmedAt: { type: Date },
    posterConfirmedAt: { type: Date },
    escrowExpiresAt: { type: Date, required: true },
    disputeReason: { type: String },
    receiptUrl: { type: String },
  },
  { timestamps: true }
);

// Indexes for querying payments by seeker and poster
PaymentSchema.index({ seekerId: 1 });
PaymentSchema.index({ posterId: 1 });

const Payment: Model<IPayment> =
  mongoose.models.Payment ||
  mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;
