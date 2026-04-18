/**
 * Overpass service — fetches nearby transit stops and amenities from the
 * OpenStreetMap Overpass API.
 *
 * We keep the query small (radius 600m) to stay within anonymous rate limits.
 * Any failure returns an empty array rather than throwing.
 */

export interface NearbyPOI {
  kind: string;
  name: string;
  distanceMeters: number;
  lat: number;
  lng: number;
}

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const RADIUS_M = 600;

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function queryOverpass(query: string): Promise<OverpassResponse> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  return (await res.json()) as OverpassResponse;
}

function elementsToPOIs(
  elements: OverpassElement[],
  originLat: number,
  originLng: number,
  kindOf: (el: OverpassElement) => string | null,
): NearbyPOI[] {
  const out: NearbyPOI[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const name = el.tags?.name;
    const kind = kindOf(el);
    if (!lat || !lon || !name || !kind) continue;

    out.push({
      kind,
      name,
      distanceMeters: Math.round(haversine(originLat, originLng, lat, lon)),
      lat,
      lng: lon,
    });
  }
  return out.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export async function fetchNearbyTransit(lat: number, lng: number): Promise<NearbyPOI[]> {
  const query = `
    [out:json][timeout:15];
    (
      node["public_transport"="station"](around:${RADIUS_M},${lat},${lng});
      node["railway"="subway_entrance"](around:${RADIUS_M},${lat},${lng});
      node["highway"="bus_stop"](around:${RADIUS_M},${lat},${lng});
    );
    out body;
  `;
  try {
    const data = await queryOverpass(query);
    return elementsToPOIs(data.elements, lat, lng, (el) => {
      if (el.tags?.railway === "subway_entrance") return "subway";
      if (el.tags?.public_transport === "station") return "train_station";
      if (el.tags?.highway === "bus_stop") return "bus_stop";
      return null;
    }).slice(0, 8);
  } catch {
    return [];
  }
}

export async function fetchNearbyAmenities(lat: number, lng: number): Promise<NearbyPOI[]> {
  const query = `
    [out:json][timeout:15];
    (
      node["shop"="supermarket"](around:${RADIUS_M},${lat},${lng});
      node["amenity"="pharmacy"](around:${RADIUS_M},${lat},${lng});
      node["amenity"="school"](around:${RADIUS_M},${lat},${lng});
      node["amenity"="hospital"](around:${RADIUS_M},${lat},${lng});
      node["leisure"="park"](around:${RADIUS_M},${lat},${lng});
      node["amenity"="restaurant"](around:${RADIUS_M},${lat},${lng});
    );
    out body;
  `;
  try {
    const data = await queryOverpass(query);
    return elementsToPOIs(data.elements, lat, lng, (el) => {
      if (el.tags?.shop === "supermarket") return "supermarket";
      if (el.tags?.amenity === "pharmacy") return "pharmacy";
      if (el.tags?.amenity === "school") return "school";
      if (el.tags?.amenity === "hospital") return "hospital";
      if (el.tags?.leisure === "park") return "park";
      if (el.tags?.amenity === "restaurant") return "restaurant";
      return null;
    }).slice(0, 12);
  } catch {
    return [];
  }
}

export async function fetchNearby(lat: number, lng: number): Promise<{
  transit: NearbyPOI[];
  amenities: NearbyPOI[];
}> {
  const [transit, amenities] = await Promise.all([
    fetchNearbyTransit(lat, lng),
    fetchNearbyAmenities(lat, lng),
  ]);
  return { transit, amenities };
}
