import mongoose, { Schema, Document, Model } from "mongoose";

export interface INotificationPreferences {
  email: boolean;
  inApp: boolean;
  payment: boolean;
  security: boolean;
  listing: boolean;
  report: boolean;
}

export interface IUser extends Document {
  supabaseId: string;
  email: string;
  fullName: string;
  role: "seeker" | "poster" | "admin";
  preferredLanguage: "en" | "es" | "fr" | "de" | "pt" | "it";
  preferredCurrency:
    | "EUR"
    | "USD"
    | "GBP"
    | "CHF"
    | "SEK"
    | "NOK"
    | "DKK"
    | "PLN"
    | "CZK"
    | "BRL";
  trustScore: number;
  completedTransactions: number;
  profileCompleteness: number;
  isSuspended: boolean;
  suspensionReason?: string;
  confirmedScamReports: number;
  bio?: string;
  profilePhoto?: string;
  phone?: string;
  dateOfBirth?: Date;
  nationality?: string;
  idType?: "national_id" | "passport" | "residence_permit";
  idNumber?: string;
  idVerified?: boolean;
  profileCompleted?: boolean;
  notificationPreferences: INotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPreferencesSchema = new Schema<INotificationPreferences>(
  {
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    payment: { type: Boolean, default: true },
    security: { type: Boolean, default: true },
    listing: { type: Boolean, default: true },
    report: { type: Boolean, default: true },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    supabaseId: { type: String, required: true },
    email: { type: String, required: true },
    fullName: { type: String, required: true },
    role: {
      type: String,
      enum: ["seeker", "poster", "admin"],
      default: "seeker",
    },
    preferredLanguage: {
      type: String,
      enum: ["en", "es", "fr", "de", "pt", "it"],
      default: "en",
    },
    preferredCurrency: {
      type: String,
      enum: [
        "EUR",
        "USD",
        "GBP",
        "CHF",
        "SEK",
        "NOK",
        "DKK",
        "PLN",
        "CZK",
        "BRL",
      ],
      default: "EUR",
    },
    trustScore: { type: Number, default: 0, min: 0, max: 5 },
    completedTransactions: { type: Number, default: 0 },
    profileCompleteness: { type: Number, default: 0, min: 0, max: 1 },
    isSuspended: { type: Boolean, default: false },
    suspensionReason: { type: String },
    confirmedScamReports: { type: Number, default: 0 },
    bio: { type: String, maxlength: 500 },
    profilePhoto: { type: String },
    phone: { type: String },
    dateOfBirth: { type: Date },
    nationality: { type: String },
    idType: { type: String, enum: ["national_id", "passport", "residence_permit"] },
    idNumber: { type: String },
    idVerified: { type: Boolean, default: false },
    profileCompleted: { type: Boolean, default: false },
    notificationPreferences: {
      type: NotificationPreferencesSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ supabaseId: 1 }, { unique: true });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
