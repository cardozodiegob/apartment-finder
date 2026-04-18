import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFeatureFlag extends Document {
  name: string;
  enabled: boolean;
  /** 0–100 rollout percentage — only used when enabled=true */
  percent: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>(
  {
    name: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    percent: { type: Number, default: 100, min: 0, max: 100 },
    description: { type: String },
  },
  { timestamps: true },
);

const FeatureFlag: Model<IFeatureFlag> =
  mongoose.models.FeatureFlag || mongoose.model<IFeatureFlag>("FeatureFlag", FeatureFlagSchema);

export default FeatureFlag;
