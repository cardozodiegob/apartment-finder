import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IFavoriteShare extends Document {
  userId: Types.ObjectId;
  folderName: string;
  token: string; // url-safe random id
  expiresAt?: Date;
  createdAt: Date;
}

const FavoriteShareSchema = new Schema<IFavoriteShare>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    folderName: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

FavoriteShareSchema.index({ userId: 1, folderName: 1 });

const FavoriteShare: Model<IFavoriteShare> =
  mongoose.models.FavoriteShare ||
  mongoose.model<IFavoriteShare>("FavoriteShare", FavoriteShareSchema);

export default FavoriteShare;
