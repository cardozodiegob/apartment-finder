import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IModerationLog extends Document {
  adminId: Types.ObjectId;
  action: string;
  targetType: "user" | "listing" | "report";
  targetId: Types.ObjectId;
  reason: string;
  timestamp: Date;
}

const ModerationLogSchema = new Schema<IModerationLog>({
  adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true },
  targetType: { type: String, enum: ["user", "listing", "report"], required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  reason: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
});

ModerationLogSchema.index({ adminId: 1, timestamp: -1 });

const ModerationLog: Model<IModerationLog> =
  mongoose.models.ModerationLog || mongoose.model<IModerationLog>("ModerationLog", ModerationLogSchema);

export default ModerationLog;
