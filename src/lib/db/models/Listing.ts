import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { AMENITIES, type Amenity } from "@/lib/constants/amenities";
import {
  HOUSE_RULES,
  HEATING_TYPES,
  LEASE_TYPES,
  ENERGY_RATINGS,
  VERIFICATION_TIERS,
} from "@/lib/validations/listing";

export { HOUSE_RULES, HEATING_TYPES, LEASE_TYPES, ENERGY_RATINGS, VERIFICATION_TIERS };

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

/**
 * Photo representation after the Phase 1 migration (see scripts/migrate-photos.ts).
 * Legacy `string[]` photos are auto-migrated to this shape during model reads
 * via a pre-find hook.
 */
export interface IListingPhoto {
  url: string;
  order: number;
  caption?: string;
  alt?: string;
}

export interface INearbyPOI {
  kind: string;          // e.g. "metro_station", "bus_stop", "supermarket"
  name: string;
  distanceMeters: number;
  lat: number;
  lng: number;
}

export type HouseRule = (typeof HOUSE_RULES)[number];
export type HeatingType = (typeof HEATING_TYPES)[number];
export type LeaseType = (typeof LEASE_TYPES)[number];
export type EnergyRating = (typeof ENERGY_RATINGS)[number];
export type VerificationTier = (typeof VERIFICATION_TIERS)[number];

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
  photos: IListingPhoto[];
  photoHashes: string[];
  tags: string[];
  isSharedAccommodation: boolean;
  currentOccupants?: number;
  availableRooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  beds?: number;
  deposit?: number;
  utilitiesIncluded?: boolean;
  billsEstimate?: number;
  minStayMonths?: number;
  maxStayMonths?: number;
  leaseType: LeaseType;
  heatingType?: HeatingType;
  energyRating?: EnergyRating;
  yearBuilt?: number;
  amenities: Amenity[];
  houseRules: HouseRule[];
  nearbyTransit: INearbyPOI[];
  nearbyAmenities: INearbyPOI[];
  floorPlanUrl?: string;
  virtualTourUrl?: string;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  verificationTier: VerificationTier;
  viewCount: number;
  inquiryCount: number;
  trendingScore?: number;
  isFurnished?: boolean;
  isPetFriendly?: boolean;
  hasParking?: boolean;
  hasBalcony?: boolean;
  floorArea?: number;
  floor?: number;
  totalFloors?: number;
  status: "draft" | "active" | "under_review" | "archived";
  isFeatured: boolean;
  scamRiskLevel?: "low" | "medium" | "high";
  priceHistory: { price: number; currency: string; changedAt: Date }[];
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
  { _id: false },
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
  { _id: false },
);

const PhotoSchema = new Schema<IListingPhoto>(
  {
    url: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
    caption: { type: String },
    alt: { type: String },
  },
  { _id: false },
);
// Exported so downstream migrations and admin tools can reuse the shape.
export { PhotoSchema };

const NearbyPOISchema = new Schema<INearbyPOI>(
  {
    kind: { type: String, required: true },
    name: { type: String, required: true },
    distanceMeters: { type: Number, required: true, min: 0 },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false },
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
      enum: ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "BRL"],
      required: true,
    },
    availableDate: { type: Date, required: true },
    // `photos` is stored as mixed during migration — see pre-find hook below.
    photos: { type: Schema.Types.Mixed, default: [] },
    photoHashes: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    isSharedAccommodation: { type: Boolean, default: false },
    currentOccupants: { type: Number },
    availableRooms: { type: Number },
    bedrooms: { type: Number, min: 0 },
    bathrooms: { type: Number, min: 0 },
    beds: { type: Number, min: 0 },
    deposit: { type: Number, min: 0 },
    utilitiesIncluded: { type: Boolean },
    billsEstimate: { type: Number, min: 0 },
    minStayMonths: { type: Number, min: 0 },
    maxStayMonths: { type: Number, min: 0 },
    leaseType: {
      type: String,
      enum: LEASE_TYPES,
      required: true,
      default: "open_ended",
    },
    heatingType: { type: String, enum: HEATING_TYPES },
    energyRating: { type: String, enum: ENERGY_RATINGS },
    yearBuilt: { type: Number, min: 1800, max: new Date().getFullYear() + 2 },
    amenities: {
      type: [String],
      enum: AMENITIES as unknown as string[],
      default: [],
    },
    houseRules: {
      type: [String],
      enum: HOUSE_RULES as unknown as string[],
      default: [],
    },
    nearbyTransit: { type: [NearbyPOISchema], default: [] },
    nearbyAmenities: { type: [NearbyPOISchema], default: [] },
    floorPlanUrl: { type: String },
    virtualTourUrl: { type: String },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verificationTier: {
      type: String,
      enum: VERIFICATION_TIERS,
      required: true,
      default: "none",
    },
    viewCount: { type: Number, default: 0, min: 0 },
    inquiryCount: { type: Number, default: 0, min: 0 },
    trendingScore: { type: Number },
    isFurnished: { type: Boolean },
    isPetFriendly: { type: Boolean },
    hasParking: { type: Boolean },
    hasBalcony: { type: Boolean },
    floorArea: { type: Number, min: 0 },
    floor: { type: Number },
    totalFloors: { type: Number },
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
    priceHistory: {
      type: [
        {
          price: { type: Number, required: true },
          currency: { type: String, required: true },
          changedAt: { type: Date, required: true },
        },
      ],
      default: [],
    },
    expiresAt: { type: Date },
    renewedAt: { type: Date },
  },
  { timestamps: true },
);

/**
 * Legacy → new photo shape adapter (Phase 1 migration).
 *
 * Listings created before the photo-object migration still hold `photos`
 * as `string[]`. Rather than force a big-bang migration, we rewrite each
 * document as it's read. The offline `scripts/migrate-photos.ts` batch
 * script does the same transformation idempotently.
 */
function coercePhotos(raw: unknown): IListingPhoto[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p, i) => {
    if (typeof p === "string") return { url: p, order: i };
    if (p && typeof p === "object" && "url" in p) {
      const obj = p as IListingPhoto;
      return {
        url: obj.url,
        order: typeof obj.order === "number" ? obj.order : i,
        caption: obj.caption,
        alt: obj.alt,
      };
    }
    return { url: "", order: i };
  });
}

ListingSchema.post("init", function (doc) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).photos = coercePhotos((doc as any).photos);
});

// --- Indexes -----------------------------------------------------------------

ListingSchema.index({ status: 1, propertyType: 1, monthlyRent: 1 });
ListingSchema.index({ title: "text", description: "text", tags: "text" });
ListingSchema.index({ location: "2dsphere" });
ListingSchema.index({ posterId: 1, status: 1 });
ListingSchema.index({ expiresAt: 1 });
ListingSchema.index({ isFeatured: 1, status: 1 });
ListingSchema.index({ "address.country": 1, "address.city": 1 });

// Phase 1 filter coverage
ListingSchema.index({ status: 1, "address.city": 1, bedrooms: 1, monthlyRent: 1 });
ListingSchema.index({ status: 1, amenities: 1 });
ListingSchema.index({ status: 1, energyRating: 1 });
ListingSchema.index({ status: 1, verificationTier: 1 });
ListingSchema.index({ status: 1, trendingScore: -1 });

const Listing: Model<IListing> =
  mongoose.models.Listing || mongoose.model<IListing>("Listing", ListingSchema);

export default Listing;
