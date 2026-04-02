import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISavedSearch extends Document {
  userId: Types.ObjectId;
  name: string;
  filters: Record<string, unknown>;
  createdAt: Date;
}

const SavedSearchSchema = new Schema<ISavedSearch>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, maxlength: 100 },
    filters: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

SavedSearchSchema.index({ userId: 1, createdAt: -1 });

const SavedSearch: Model<ISavedSearch> =
  mongoose.models.SavedSearch || mongoose.model<ISavedSearch>("SavedSearch", SavedSearchSchema);

export default SavedSearch;
