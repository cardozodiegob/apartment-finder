import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IAmenities {
  supermarkets: string[];
  pharmacies: string[];
  schools: string[];
  parks: string[];
}

export interface INeighborhoodGuide extends Document {
  city: string;
  neighborhood: string;
  slug: string;
  overview: string;
  transitScore?: number;
  transitInfo?: string;
  transitLines?: string[];
  safetyInfo?: string;
  amenities?: IAmenities;
  averageRent?: number;
  centerLat: number;
  centerLng: number;
  isPublished: boolean;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AmenitiesSchema = new Schema<IAmenities>(
  {
    supermarkets: { type: [String], default: [] },
    pharmacies: { type: [String], default: [] },
    schools: { type: [String], default: [] },
    parks: { type: [String], default: [] },
  },
  { _id: false }
);

const NeighborhoodGuideSchema = new Schema<INeighborhoodGuide>(
  {
    city: { type: String, required: true },
    neighborhood: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    overview: { type: String, default: "" },
    transitScore: { type: Number, min: 0, max: 100 },
    transitInfo: { type: String },
    transitLines: { type: [String], default: [] },
    safetyInfo: { type: String },
    amenities: { type: AmenitiesSchema },
    averageRent: { type: Number, min: 0 },
    centerLat: { type: Number, required: true },
    centerLng: { type: Number, required: true },
    isPublished: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

NeighborhoodGuideSchema.index({ city: 1, neighborhood: 1 }, { unique: true });
NeighborhoodGuideSchema.index({ isPublished: 1 });

const NeighborhoodGuide: Model<INeighborhoodGuide> =
  mongoose.models.NeighborhoodGuide ||
  mongoose.model<INeighborhoodGuide>("NeighborhoodGuide", NeighborhoodGuideSchema);

export default NeighborhoodGuide;
