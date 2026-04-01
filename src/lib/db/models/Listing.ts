import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IAddress {
  street: string;
  city: string;
  neighborhood?: string;
  postalCode: string;
  country: string;
}

export interface IGeoLocation {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface IListing extends Document {
  posterId: Types.ObjectId;
  title: string;
  description: string;
  propertyType: "apartment" | "room" | "house";
  purpose: "rent" | "share" | "sublet";
  address: IAddress;
  location: IGeoLocation;
  monthlyRent: number;
  currency:
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
  availableDate: Date;
  photos: string[];
  photoHashes: string[];
  tags: string[];
  isSharedAccommodation: boolean;
  currentOccupants?: number;
  availableRooms?: number;
  status: "draft" | "active" | "under_review" | "archived";
  isFeatured: boolean;
  scamRiskLevel?: "low" | "medium" | "high";
  expiresAt?: Date;
  renewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    neighborhood: { type: String },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false }
);

const GeoLocationSchema = new Schema<IGeoLocation>(
  {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: number[]) => v.length === 2,
        message: "Coordinates must be [longitude, latitude]",
      },
    },
  },
  { _id: false }
);

const ListingSchema = new Schema<IListing>(
  {
    posterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    propertyType: {
      type: String,
      enum: ["apartment", "room", "house"],
      required: true,
    },
    purpose: {
      type: String,
      enum: ["rent", "share", "sublet"],
      required: true,
    },
    address: { type: AddressSchema, required: true },
    location: { type: GeoLocationSchema, required: true },
    monthlyRent: { type: Number, required: true, min: 0 },
    currency: {
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
      required: true,
    },
    availableDate: { type: Date, required: true },
    photos: { type: [String], default: [] },
    photoHashes: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    isSharedAccommodation: { type: Boolean, default: false },
    currentOccupants: { type: Number },
    availableRooms: { type: Number },
    status: {
      type: String,
      enum: ["draft", "active", "under_review", "archived"],
      default: "draft",
    },
    isFeatured: { type: Boolean, default: false },
    scamRiskLevel: {
      type: String,
      enum: ["low", "medium", "high"],
    },
    expiresAt: { type: Date },
    renewedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound index for filtering by status, property type, and price
ListingSchema.index({ status: 1, propertyType: 1, monthlyRent: 1 });

// Text index for full-text search across title, description, and tags
ListingSchema.index({ title: "text", description: "text", tags: "text" });

// 2dsphere index for geographic queries
ListingSchema.index({ location: "2dsphere" });

// Compound index for user listing queries by poster and status
ListingSchema.index({ posterId: 1, status: 1 });

const Listing: Model<IListing> =
  mongoose.models.Listing || mongoose.model<IListing>("Listing", ListingSchema);

export default Listing;
