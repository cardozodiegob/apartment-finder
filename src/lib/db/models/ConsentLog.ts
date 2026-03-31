import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IConsentLog extends Document {
  userId: Types.ObjectId;
  purpose: string;
  consented: boolean;
  timestamp: Date;
  ipAddress?: string;
}

const ConsentLogSchema = new Schema<IConsentLog>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  purpose: { type: String, required: true },
  consented: { type: Boolean, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
  ipAddress: { type: String },
});

const ConsentLog: Model<IConsentLog> =
  mongoose.models.ConsentLog ||
  mongoose.model<IConsentLog>("ConsentLog", ConsentLogSchema);

export default ConsentLog;
