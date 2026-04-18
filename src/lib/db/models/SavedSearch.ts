import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISavedSearch extends Document {
  userId: Types.ObjectId;
  name: string;
  filters: Record<string, unknown>;
  emailAlertsEnabled: boolean;
  lastAlertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SavedSearchSchema = new Schema<ISavedSearch>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, maxlength: 100 },
    filters: { type: Schema.Types.Mixed, required: true },
    emailAlertsEnabled: { type: Boolean, default: false },
    lastAlertedAt: { type: Date },
  },
  { timestamps: true },
);

SavedSearchSchema.index({ userId: 1, createdAt: -1 });
SavedSearchSchema.index({ emailAlertsEnabled: 1, lastAlertedAt: 1 });

const SavedSearch: Model<ISavedSearch> =
  mongoose.models.SavedSearch || mongoose.model<ISavedSearch>("SavedSearch", SavedSearchSchema);

export default SavedSearch;
