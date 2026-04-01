import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IFavorite extends Document {
  userId: Types.ObjectId;
  listingId: Types.ObjectId;
  savedAt: Date;
}

const FavoriteSchema = new Schema<IFavorite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    savedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

FavoriteSchema.index({ userId: 1, savedAt: -1 });
FavoriteSchema.index({ userId: 1, listingId: 1 }, { unique: true });

const Favorite: Model<IFavorite> =
  mongoose.models.Favorite ||
  mongoose.model<IFavorite>("Favorite", FavoriteSchema);

export default Favorite;
