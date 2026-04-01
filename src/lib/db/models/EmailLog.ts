import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEmailLog extends Document {
  recipient: string;
  template: string;
  status: "sent" | "failed" | "bounced";
  attempts: number;
  lastAttemptAt: Date;
  error?: string;
  createdAt: Date;
}

const EmailLogSchema = new Schema<IEmailLog>(
  {
    recipient: { type: String, required: true },
    template: { type: String, required: true },
    status: {
      type: String,
      enum: ["sent", "failed", "bounced"],
      required: true,
    },
    attempts: { type: Number, required: true, default: 1 },
    lastAttemptAt: { type: Date, required: true },
    error: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

EmailLogSchema.index({ recipient: 1, createdAt: -1 });

const EmailLog: Model<IEmailLog> =
  mongoose.models.EmailLog ||
  mongoose.model<IEmailLog>("EmailLog", EmailLogSchema);

export default EmailLog;
