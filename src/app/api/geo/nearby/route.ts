import { NextRequest } from "next/server";
import { fetchNearby } from "@/lib/services/overpass";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

/**
 * GET /api/geo/nearby?lat=<>&lng=<>
 *
 * Returns nearby transit stops and amenities (schools, supermarkets, etc.)
 * from OpenStreetMap's Overpass API.
 */
export async function GET(req: NextRequest) {
  try {
    const lat = Number(req.nextUrl.searchParams.get("lat"));
    const lng = Number(req.nextUrl.searchParams.get("lng"));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "lat and lng are required", 400);
    }

    const data = await fetchNearby(lat, lng);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
