import Listing from "@/lib/db/models/Listing";
import type { IListing } from "@/lib/db/models/Listing";
import { z } from "zod";

// --- Types ---

export interface SearchParams {
  query?: string;
  propertyType?: "apartment" | "room" | "house";
  priceRange?: { min: number; max: number };
  bedrooms?: number;
  bathrooms?: number;
  availableRooms?: number;
  availableAfter?: Date;
  tags?: string[];
  amenities?: string[];
  minEnergyRating?: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  purpose?: "rent" | "share" | "sublet";
  isSharedAccommodation?: boolean;
  /** Tri-state: true = must be furnished, false = must be unfurnished, undefined = either */
  isFurnished?: boolean;
  isPetFriendly?: boolean;
  hasParking?: boolean;
  hasBalcony?: boolean;
  minArea?: number;
  maxArea?: number;
  city?: string;
  country?: string;
  neighborhood?: string;
  verifiedOnly?: boolean;
  verifiedPostersOnly?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "available_soonest" | "relevance";
  page: number;
  limit: number;
  cursor?: string;
}

export interface SearchResult {
  listings: IListing[];
  totalCount: number;
  page: number;
  totalPages: number;
  cursor?: string;
  timeout?: boolean;
}

export interface GeoPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

// --- Validation Schemas ---

export const searchParamsSchema = z.object({
  query: z.string().optional(),
  propertyType: z.enum(["apartment", "room", "house"]).optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  availableRooms: z.coerce.number().int().min(0).optional(),
  availableAfter: z.coerce.date().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  amenities: z.union([z.string(), z.array(z.string())]).optional(),
  minEnergyRating: z.enum(["A", "B", "C", "D", "E", "F", "G"]).optional(),
  purpose: z.enum(["rent", "share", "sublet"]).optional(),
  isSharedAccommodation: z.coerce.boolean().optional(),
  isFurnished: z.coerce.boolean().optional(),
  isPetFriendly: z.coerce.boolean().optional(),
  hasParking: z.coerce.boolean().optional(),
  hasBalcony: z.coerce.boolean().optional(),
  minArea: z.coerce.number().min(0).optional(),
  maxArea: z.coerce.number().min(0).optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  neighborhood: z.string().optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "available_soonest", "relevance"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const geoPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
});

// --- Filter serialization ---

export function serializeFilters(params: Partial<SearchParams>): URLSearchParams {
  const sp = new URLSearchParams();
  if (params.query) sp.set("query", params.query);
  if (params.propertyType) sp.set("propertyType", params.propertyType);
  if (params.priceRange) {
    sp.set("priceMin", String(params.priceRange.min));
    sp.set("priceMax", String(params.priceRange.max));
  }
  if (params.bedrooms !== undefined && params.bedrooms !== null) sp.set("bedrooms", String(params.bedrooms));
  if (params.bathrooms !== undefined && params.bathrooms !== null) sp.set("bathrooms", String(params.bathrooms));
  if (params.availableRooms !== undefined && params.availableRooms !== null) sp.set("availableRooms", String(params.availableRooms));
  if (params.availableAfter) sp.set("availableAfter", params.availableAfter.toISOString());
  if (params.tags && params.tags.length > 0) sp.set("tags", params.tags.join(","));
  if (params.amenities && params.amenities.length > 0) sp.set("amenities", params.amenities.join(","));
  if (params.minEnergyRating) sp.set("minEnergyRating", params.minEnergyRating);
  if (params.purpose) sp.set("purpose", params.purpose);
  if (params.isSharedAccommodation) sp.set("isSharedAccommodation", "true");
  if (params.isFurnished) sp.set("isFurnished", "true");
  if (params.isPetFriendly) sp.set("isPetFriendly", "true");
  if (params.hasParking) sp.set("hasParking", "true");
  if (params.hasBalcony) sp.set("hasBalcony", "true");
  if (params.minArea !== undefined && params.minArea !== null) sp.set("minArea", String(params.minArea));
  if (params.maxArea !== undefined && params.maxArea !== null) sp.set("maxArea", String(params.maxArea));
  if (params.city) sp.set("city", params.city);
  if (params.country) sp.set("country", params.country);
  if (params.neighborhood) sp.set("neighborhood", params.neighborhood);
  if (params.verifiedOnly) sp.set("verifiedOnly", "true");
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.limit && params.limit !== 20) sp.set("limit", String(params.limit));
  return sp;
}

export function deserializeFilters(sp: URLSearchParams): Partial<SearchParams> {
  const params: Partial<SearchParams> = {};
  const query = sp.get("query");
  if (query) params.query = query;
  const propertyType = sp.get("propertyType");
  if (propertyType && ["apartment", "room", "house"].includes(propertyType)) {
    params.propertyType = propertyType as SearchParams["propertyType"];
  }
  const priceMin = sp.get("priceMin");
  const priceMax = sp.get("priceMax");
  if (priceMin !== null && priceMax !== null) {
    params.priceRange = { min: Number(priceMin), max: Number(priceMax) };
  }
  const bedrooms = sp.get("bedrooms");
  if (bedrooms !== null) params.bedrooms = Number(bedrooms);
  const bathrooms = sp.get("bathrooms");
  if (bathrooms !== null) params.bathrooms = Number(bathrooms);
  const availableRooms = sp.get("availableRooms");
  if (availableRooms !== null) params.availableRooms = Number(availableRooms);
  const availableAfter = sp.get("availableAfter");
  if (availableAfter) params.availableAfter = new Date(availableAfter);
  const tags = sp.get("tags");
  if (tags) params.tags = tags.split(",");
  const amenities = sp.get("amenities");
  if (amenities) params.amenities = amenities.split(",");
  const minEnergyRating = sp.get("minEnergyRating");
  if (minEnergyRating) params.minEnergyRating = minEnergyRating as SearchParams["minEnergyRating"];
  const purpose = sp.get("purpose");
  if (purpose && ["rent", "share", "sublet"].includes(purpose)) {
    params.purpose = purpose as SearchParams["purpose"];
  }
  const isShared = sp.get("isSharedAccommodation");
  if (isShared === "true") params.isSharedAccommodation = true;
  const isFurnished = sp.get("isFurnished");
  if (isFurnished === "true") params.isFurnished = true;
  const isPetFriendly = sp.get("isPetFriendly");
  if (isPetFriendly === "true") params.isPetFriendly = true;
  const hasParking = sp.get("hasParking");
  if (hasParking === "true") params.hasParking = true;
  const hasBalcony = sp.get("hasBalcony");
  if (hasBalcony === "true") params.hasBalcony = true;
  const minArea = sp.get("minArea");
  if (minArea !== null) params.minArea = Number(minArea);
  const maxArea = sp.get("maxArea");
  if (maxArea !== null) params.maxArea = Number(maxArea);
  const city = sp.get("city");
  if (city) params.city = city;
  const country = sp.get("country");
  if (country) params.country = country;
  const neighborhood = sp.get("neighborhood");
  if (neighborhood) params.neighborhood = neighborhood;
  const verifiedOnly = sp.get("verifiedOnly");
  if (verifiedOnly === "true") params.verifiedOnly = true;
  const page = sp.get("page");
  if (page) params.page = Number(page);
  const limit = sp.get("limit");
  if (limit) params.limit = Number(limit);
  return params;
}

// --- Build MongoDB query ---

function buildQuery(params: SearchParams): Record<string, unknown> {
  const now = new Date();
  const query: Record<string, unknown> = {
    status: "active",
    $or: [
      { expiresAt: { $gt: now } },
      { expiresAt: { $exists: false } },
    ],
  };

  if (params.propertyType) {
    query.propertyType = params.propertyType;
  }
  if (params.priceRange) {
    query.monthlyRent = {
      ...(query.monthlyRent as Record<string, unknown> || {}),
      $gte: params.priceRange.min,
      $lte: params.priceRange.max,
    };
  }
  if (params.bedrooms !== undefined && params.bedrooms !== null) {
    query.bedrooms = { $gte: params.bedrooms };
  }
  if (params.bathrooms !== undefined && params.bathrooms !== null) {
    query.bathrooms = { $gte: params.bathrooms };
  }
  if (params.availableRooms !== undefined && params.availableRooms !== null) {
    query.availableRooms = { $gte: params.availableRooms };
  }
  if (params.availableAfter) {
    query.availableDate = { $gte: params.availableAfter };
  }
  if (params.tags && params.tags.length > 0) {
    query.tags = { $all: params.tags };
  }
  if (params.amenities && params.amenities.length > 0) {
    query.amenities = { $all: params.amenities };
  }
  if (params.minEnergyRating) {
    const order = ["A", "B", "C", "D", "E", "F", "G"];
    const idx = order.indexOf(params.minEnergyRating);
    const allowed = order.slice(0, idx + 1);
    query.energyRating = { $in: allowed };
  }
  if (params.verifiedOnly) {
    query.verificationTier = { $in: ["docs", "photo_tour", "in_person"] };
  }
  if (params.purpose) {
    query.purpose = params.purpose;
  }
  if (params.isSharedAccommodation) {
    query.isSharedAccommodation = true;
  }
  if (params.isFurnished !== undefined) {
    query.isFurnished = params.isFurnished;
  }
  if (params.isPetFriendly) {
    query.isPetFriendly = true;
  }
  if (params.hasParking) {
    query.hasParking = true;
  }
  if (params.hasBalcony) {
    query.hasBalcony = true;
  }
  if (params.minArea !== undefined || params.maxArea !== undefined) {
    const areaFilter: Record<string, number> = {};
    if (params.minArea !== undefined) areaFilter.$gte = params.minArea;
    if (params.maxArea !== undefined) areaFilter.$lte = params.maxArea;
    query.floorArea = areaFilter;
  }
  if (params.city) {
    query["address.city"] = params.city;
  }
  if (params.country) {
    query["address.country"] = params.country;
  }
  if (params.neighborhood) {
    query["address.neighborhood"] = params.neighborhood;
  }

  return query;
}

// --- Search Service ---

const QUERY_TIMEOUT_MS = 5000;

export async function search(params: SearchParams): Promise<SearchResult> {
  const query = buildQuery(params);

  // Full-text search
  if (params.query && params.query.trim()) {
    query.$text = { $search: params.query.trim() };
  }

  const page = params.page || 1;
  const limit = Math.min(params.limit || 20, 100);
  const useCursor = page > 10 && params.cursor;

  // For deep pages, use cursor-based pagination to avoid skip performance degradation
  if (useCursor) {
    query._id = { $lt: params.cursor };
  }

  const skip = useCursor ? 0 : (page - 1) * limit;

  // Determine sort
  const sort = params.sort ?? (params.query ? "relevance" : "newest");
  let sortSpec: Record<string, 1 | -1 | { $meta: "textScore" }>;
  switch (sort) {
    case "price_asc": sortSpec = { monthlyRent: 1, _id: -1 }; break;
    case "price_desc": sortSpec = { monthlyRent: -1, _id: -1 }; break;
    case "available_soonest": sortSpec = { availableDate: 1, _id: -1 }; break;
    case "relevance":
      sortSpec = params.query ? { score: { $meta: "textScore" } } : { createdAt: -1 };
      break;
    case "newest":
    default:
      sortSpec = { createdAt: -1 };
  }

  try {
    const [listings, totalCount] = await Promise.all([
      Listing.find(query)
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .maxTimeMS(QUERY_TIMEOUT_MS),
      Listing.countDocuments(buildQuery(params)).maxTimeMS(QUERY_TIMEOUT_MS),
    ]);

    const lastListing = listings[listings.length - 1];
    const cursor = lastListing ? String(lastListing._id) : undefined;

    return {
      listings,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      cursor,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("time") || msg.includes("timeout")) {
      return { listings: [], totalCount: 0, page, totalPages: 0, timeout: true };
    }
    throw err;
  }
}

export async function searchWithinBoundary(
  params: SearchParams,
  boundary: GeoPolygon
): Promise<SearchResult> {
  const query = buildQuery(params);

  // Add geo boundary filter
  query.location = {
    $geoWithin: {
      $geometry: boundary,
    },
  };

  if (params.query && params.query.trim()) {
    query.$text = { $search: params.query.trim() };
  }

  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  try {
    const [listings, totalCount] = await Promise.all([
      Listing.find(query)
        .sort(params.query ? { score: { $meta: "textScore" } } : { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .maxTimeMS(QUERY_TIMEOUT_MS),
      Listing.countDocuments(query).maxTimeMS(QUERY_TIMEOUT_MS),
    ]);

    return {
      listings,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("time") || msg.includes("timeout")) {
      return { listings: [], totalCount: 0, page, totalPages: 0 };
    }
    throw err;
  }
}
