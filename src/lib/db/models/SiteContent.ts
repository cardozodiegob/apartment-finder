import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISiteContent extends Document {
  key: string;
  title: string;
  body: string;
  contentType: "page" | "image";
  updatedAt: Date;
  updatedBy: Types.ObjectId;
}

const SiteContentSchema = new Schema<ISiteContent>(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    contentType: { type: String, enum: ["page", "image"], required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

SiteContentSchema.index({ key: 1 }, { unique: true });

const SiteContent: Model<ISiteContent> =
  mongoose.models.SiteContent || mongoose.model<ISiteContent>("SiteContent", SiteContentSchema);

export default SiteContent;
