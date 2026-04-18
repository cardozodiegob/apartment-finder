/**
 * Amenity_Vocabulary — single source of truth for the amenity enum,
 * i18n label keys, and icons used across listing creation, display,
 * and search filtering.
 *
 * Keep the list in sync with:
 * - `src/lib/db/models/Listing.ts` `amenities` enum
 * - `src/lib/validations/listing.ts` `amenityEnum`
 * - `messages/*.json` → `amenities.<key>` strings
 */

export const AMENITIES = [
  "wifi",
  "heating",
  "airConditioning",
  "washerDryer",
  "dishwasher",
  "elevator",
  "balcony",
  "terrace",
  "garden",
  "parking",
  "bikeStorage",
  "storage",
  "gym",
  "pool",
  "furnished",
  "kitchen",
  "fridge",
  "oven",
  "microwave",
  "tv",
  "deskWorkspace",
  "petFriendly",
  "smokeFree",
  "wheelchairAccessible",
  "security24h",
  "doorman",
  "intercom",
  "fireplace",
  "soundproofing",
  "fiberInternet",
] as const;

export type Amenity = (typeof AMENITIES)[number];

/** Maps every amenity to its next-intl message key. */
export const AMENITY_LABEL_KEYS: Record<Amenity, string> = {
  wifi: "amenities.wifi",
  heating: "amenities.heating",
  airConditioning: "amenities.airConditioning",
  washerDryer: "amenities.washerDryer",
  dishwasher: "amenities.dishwasher",
  elevator: "amenities.elevator",
  balcony: "amenities.balcony",
  terrace: "amenities.terrace",
  garden: "amenities.garden",
  parking: "amenities.parking",
  bikeStorage: "amenities.bikeStorage",
  storage: "amenities.storage",
  gym: "amenities.gym",
  pool: "amenities.pool",
  furnished: "amenities.furnished",
  kitchen: "amenities.kitchen",
  fridge: "amenities.fridge",
  oven: "amenities.oven",
  microwave: "amenities.microwave",
  tv: "amenities.tv",
  deskWorkspace: "amenities.deskWorkspace",
  petFriendly: "amenities.petFriendly",
  smokeFree: "amenities.smokeFree",
  wheelchairAccessible: "amenities.wheelchairAccessible",
  security24h: "amenities.security24h",
  doorman: "amenities.doorman",
  intercom: "amenities.intercom",
  fireplace: "amenities.fireplace",
  soundproofing: "amenities.soundproofing",
  fiberInternet: "amenities.fiberInternet",
};

/** Maps every amenity to a lucide/heroicon-compatible SVG short-name. */
export const AMENITY_ICON: Record<Amenity, string> = {
  wifi: "wifi",
  heating: "flame",
  airConditioning: "fan",
  washerDryer: "shirt",
  dishwasher: "utensils",
  elevator: "arrow-up-down",
  balcony: "door-open",
  terrace: "tree-palm",
  garden: "trees",
  parking: "car",
  bikeStorage: "bike",
  storage: "package",
  gym: "dumbbell",
  pool: "waves",
  furnished: "sofa",
  kitchen: "chef-hat",
  fridge: "refrigerator",
  oven: "microwave",
  microwave: "microwave",
  tv: "tv",
  deskWorkspace: "monitor",
  petFriendly: "paw-print",
  smokeFree: "ban",
  wheelchairAccessible: "accessibility",
  security24h: "shield-check",
  doorman: "user-round",
  intercom: "bell-ring",
  fireplace: "flame",
  soundproofing: "volume-off",
  fiberInternet: "zap",
};

/** Runtime type-guard — lets you narrow arbitrary strings into Amenity. */
export function isAmenity(value: string): value is Amenity {
  return (AMENITIES as readonly string[]).includes(value);
}
