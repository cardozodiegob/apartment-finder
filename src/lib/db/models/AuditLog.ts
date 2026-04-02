import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IAuditLog extends Document {
  adminId: Types.ObjectId;
  action: string;
  targetType: "user" | "listing" | "report" | "content" | "system";
  targetId: string;
  details: string;
  ipAddress?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true },
  targetType: {
    type: String,
    enum: ["user", "listing", "report", "content", "system"],
    required: true,
  },
  targetId: { type: String, required: true },
  details: { type: String, required: true },
  ipAddress: { type: String },
  timestamp: { type: Date, required: true, default: Date.now },
});

AuditLogSchema.index({ adminId: 1, timestamp: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;
