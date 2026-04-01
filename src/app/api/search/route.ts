import { NextRequest } from "next/server";
import { search, searchParamsSchema } from "@/lib/services/search";
import { errorResponse } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const raw: Record<string, unknown> = {};
    url.searchParams.forEach((value, key) => { raw[key] = value; });

    const parsed = searchParamsSchema.safeParse(raw);
    // Silently ignore invalid params — apply valid ones
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
      neighborhood: params.neighborhood,
      page: params.page,
      limit: params.limit,
      cursor: params.cursor,
    };

    const result = await search(searchParams);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
