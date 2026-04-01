import Listing from "@/lib/db/models/Listing";
import type { IListing } from "@/lib/db/models/Listing";
import { z } from "zod";

// --- Types ---

export interface SearchParams {
  query?: string;
  propertyType?: "apartment" | "room" | "house";
  priceRange?: { min: number; max: number };
  bedrooms?: number;
  availableAfter?: Date;
  tags?: string[];
  purpose?: "rent" | "share" | "sublet";
  isSharedAccommodation?: boolean;
  city?: string;
  neighborhood?: string;
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
  availableAfter: z.coerce.date().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  purpose: z.enum(["rent", "share", "sublet"]).optional(),
  isSharedAccommodation: z.coerce.boolean().optional(),
  city: z.string().optional(),
  neighborhood: z.string().optional(),
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
  if (params.availableAfter) sp.set("availableAfter", params.availableAfter.toISOString());
  if (params.tags && params.tags.length > 0) sp.set("tags", params.tags.join(","));
  if (params.purpose) sp.set("purpose", params.purpose);
  if (params.isSharedAccommodation) sp.set("isSharedAccommodation", "true");
  if (params.city) sp.set("city", params.city);
  if (params.neighborhood) sp.set("neighborhood", params.neighborhood);
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
  const availableAfter = sp.get("availableAfter");
  if (availableAfter) params.availableAfter = new Date(availableAfter);
  const tags = sp.get("tags");
  if (tags) params.tags = tags.split(",");
  const purpose = sp.get("purpose");
  if (purpose && ["rent", "share", "sublet"].includes(purpose)) {
    params.purpose = purpose as SearchParams["purpose"];
  }
  const isShared = sp.get("isSharedAccommodation");
  if (isShared === "true") params.isSharedAccommodation = true;
  const city = sp.get("city");
  if (city) params.city = city;
  const neighborhood = sp.get("neighborhood");
  if (neighborhood) params.neighborhood = neighborhood;
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
    query.availableRooms = { $gte: params.bedrooms };
  }
  if (params.availableAfter) {
    query.availableDate = { $gte: params.availableAfter };
  }
  if (params.tags && params.tags.length > 0) {
    query.tags = { $all: params.tags };
  }
  if (params.purpose) {
    query.purpose = params.purpose;
  }
  if (params.isSharedAccommodation) {
    query.isSharedAccommodation = true;
  }
  if (params.city) {
    query["address.city"] = params.city;
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

  try {
    const [listings, totalCount] = await Promise.all([
      Listing.find(query)
        .sort(params.query ? { score: { $meta: "textScore" } } : { createdAt: -1 })
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
