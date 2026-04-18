import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IFavorite extends Document {
  userId: Types.ObjectId;
  listingId: Types.ObjectId;
  folderName: string;
  note?: string;
  savedAt: Date;
}

const FavoriteSchema = new Schema<IFavorite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    folderName: { type: String, default: "Default", maxlength: 80 },
    note: { type: String, maxlength: 500 },
    savedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

FavoriteSchema.index({ userId: 1, savedAt: -1 });
FavoriteSchema.index({ userId: 1, listingId: 1 }, { unique: true });
FavoriteSchema.index({ userId: 1, folderName: 1 });

const Favorite: Model<IFavorite> =
  mongoose.models.Favorite ||
  mongoose.model<IFavorite>("Favorite", FavoriteSchema);

export default Favorite;
