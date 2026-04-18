import mongoose, { Schema, Document, Model } from "mongoose";

export interface IErrorEvent extends Document {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  createdAt: Date;
}

const ErrorEventSchema = new Schema<IErrorEvent>(
  {
    message: { type: String, required: true },
    stack: { type: String },
    context: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ErrorEventSchema.index({ createdAt: -1 });
// Auto-expire older than 30 days to keep the collection small
ErrorEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

const ErrorEvent: Model<IErrorEvent> =
  mongoose.models.ErrorEvent || mongoose.model<IErrorEvent>("ErrorEvent", ErrorEventSchema);

export default ErrorEvent;
