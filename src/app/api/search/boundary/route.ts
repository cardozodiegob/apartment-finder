import { NextRequest } from "next/server";
import { searchWithinBoundary, searchParamsSchema, geoPolygonSchema } from "@/lib/services/search";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { boundary, ...filterParams } = body;

    const polygonParsed = geoPolygonSchema.safeParse(boundary);
    if (!polygonParsed.success) {
      throw new ApiErrorResponse("INVALID_BOUNDARY", "Please draw a valid area on the map", 400);
    }

    const parsed = searchParamsSchema.safeParse(filterParams);
    const params = parsed.success ? parsed.data : { page: 1, limit: 20 };

    const searchParams = {
      query: params.query,
      propertyType: params.propertyType,
      priceRange: params.priceMin !== undefined && params.priceMax !== undefined
        ? { min: params.priceMin, max: params.priceMax }
        : undefined,
      bedrooms: params.bedrooms,
      availableAfter: params.availableAfter,
      tags: typeof params.tags === "string" ? params.tags.split(",") : params.tags,
      purpose: params.purpose,
      isSharedAccommodation: params.isSharedAccommodation,
      city: params.city,
      country: params.country,
      neighborhood: params.neighborhood,
      page: params.page,
      limit: params.limit,
    };

    const result = await searchWithinBoundary(searchParams, polygonParsed.data);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
