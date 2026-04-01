import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type NotificationType =
  | "message"
  | "payment"
  | "report"
  | "listing_status"
  | "security"
  | "roommate_request";

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  isDismissed: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "message",
        "payment",
        "report",
        "listing_status",
        "security",
        "roommate_request",
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    isDismissed: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound index for fetching user notifications filtered by read/dismissed status
NotificationSchema.index({ userId: 1, isRead: 1, isDismissed: 1, createdAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;
