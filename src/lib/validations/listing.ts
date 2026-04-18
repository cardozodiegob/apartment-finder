import { z } from "zod";
import { AMENITIES } from "@/lib/constants/amenities";

/** Keep these in sync with src/lib/db/models/Listing.ts — same source-of-truth tuples. */
export const HOUSE_RULES = [
  "noSmoking",
  "noPets",
  "noParties",
  "quietHours",
  "overnightGuestsAllowed",
  "coupleFriendly",
  "studentsOnly",
  "workingProfessionalsOnly",
] as const;

export const HEATING_TYPES = [
  "central",
  "gas",
  "electric",
  "district",
  "heatPump",
  "woodStove",
  "none",
] as const;

export const LEASE_TYPES = [
  "fixed_term",
  "open_ended",
  "student_semester",
  "short_term",
] as const;

export const ENERGY_RATINGS = ["A", "B", "C", "D", "E", "F", "G"] as const;

export const VERIFICATION_TIERS = ["none", "docs", "photo_tour", "in_person"] as const;

export const addressSchema = z.object({
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  neighborhood: z.string().optional(),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
});

export const geoLocationSchema = z.object({
  type: z.literal("Point").default("Point"),
  coordinates: z
    .tuple([z.number(), z.number()])
    .refine(
      ([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
      "Coordinates must be valid [longitude, latitude]",
    ),
});

export const photoObjectSchema = z.object({
  url: z.string().url(),
  order: z.number().int().min(0),
  caption: z.string().max(280).optional(),
  alt: z.string().max(280).optional(),
});

export const nearbyPOISchema = z.object({
  kind: z.string().min(1),
  name: z.string().min(1),
  distanceMeters: z.number().min(0),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const propertyTypeEnum = z.enum(["apartment", "room", "house"]);
const purposeEnum = z.enum(["rent", "share", "sublet"]);
const currencyEnum = z.enum([
  "EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "BRL",
]);

export const amenityEnum = z.enum(AMENITIES);
export const houseRuleEnum = z.enum(HOUSE_RULES);
export const heatingTypeEnum = z.enum(HEATING_TYPES);
export const leaseTypeEnum = z.enum(LEASE_TYPES);
export const energyRatingEnum = z.enum(ENERGY_RATINGS);
export const verificationTierEnum = z.enum(VERIFICATION_TIERS);

/**
 * Mutually exclusive house-rule groups. For example, a listing cannot simultaneously
 * specify "studentsOnly" AND "workingProfessionalsOnly".
 */
const MUTUALLY_EXCLUSIVE_HOUSE_RULES: Array<[string, string]> = [
  ["studentsOnly", "workingProfessionalsOnly"],
];

export const createListingSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200, "Title must be at most 200 characters"),
    description: z.string().min(1, "Description is required").max(5000, "Description must be at most 5000 characters"),
    propertyType: propertyTypeEnum,
    purpose: purposeEnum,
    address: addressSchema,
    location: geoLocationSchema,
    monthlyRent: z.number().min(0, "Monthly rent must be non-negative"),
    currency: currencyEnum,
    availableDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    isSharedAccommodation: z.boolean().default(false),
    currentOccupants: z.number().int().min(0).optional(),
    availableRooms: z.number().int().min(0).optional(),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    beds: z.number().int().min(0).optional(),
    deposit: z.number().min(0).optional(),
    utilitiesIncluded: z.boolean().optional(),
    billsEstimate: z.number().min(0).optional(),
    minStayMonths: z.number().int().min(0).max(120).optional(),
    maxStayMonths: z.number().int().min(0).max(120).optional(),
    leaseType: leaseTypeEnum.default("open_ended"),
    heatingType: heatingTypeEnum.optional(),
    energyRating: energyRatingEnum.optional(),
    yearBuilt: z.number().int().min(1800).max(new Date().getFullYear() + 2).optional(),
    amenities: z.array(amenityEnum).default([]),
    houseRules: z.array(houseRuleEnum).default([]),
    nearbyTransit: z.array(nearbyPOISchema).default([]),
    nearbyAmenities: z.array(nearbyPOISchema).default([]),
    floorPlanUrl: z.string().url().optional(),
    virtualTourUrl: z.string().url().optional(),
    isFurnished: z.boolean().optional(),
    isPetFriendly: z.boolean().optional(),
    hasParking: z.boolean().optional(),
    hasBalcony: z.boolean().optional(),
    floorArea: z.number().min(0).optional(),
    floor: z.number().int().optional(),
    totalFloors: z.number().int().min(0).optional(),
  })
  .refine(
    (data) =>
      data.minStayMonths === undefined ||
      data.maxStayMonths === undefined ||
      data.minStayMonths <= data.maxStayMonths,
    { message: "minStayMonths must be ≤ maxStayMonths", path: ["minStayMonths"] },
  )
  .refine(
    (data) => {
      if (!data.houseRules) return true;
      for (const [a, b] of MUTUALLY_EXCLUSIVE_HOUSE_RULES) {
        if (data.houseRules.includes(a as never) && data.houseRules.includes(b as never)) {
          return false;
        }
      }
      return true;
    },
    { message: "Selected house rules are mutually exclusive", path: ["houseRules"] },
  );

export type CreateListingInput = z.infer<typeof createListingSchema>;

/**
 * Partial schema used for PATCH updates. We build it from the base object
 * schema (pre-.refine) so Zod allows partial input; then reapply the refinements.
 */
const baseListingObject = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  propertyType: propertyTypeEnum,
  purpose: purposeEnum,
  address: addressSchema,
  location: geoLocationSchema,
  monthlyRent: z.number().min(0),
  currency: currencyEnum,
  availableDate: z.coerce.date(),
  tags: z.array(z.string()),
  isSharedAccommodation: z.boolean(),
  currentOccupants: z.number().int().min(0),
  availableRooms: z.number().int().min(0),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().int().min(0),
  beds: z.number().int().min(0),
  deposit: z.number().min(0),
  utilitiesIncluded: z.boolean(),
  billsEstimate: z.number().min(0),
  minStayMonths: z.number().int().min(0).max(120),
  maxStayMonths: z.number().int().min(0).max(120),
  leaseType: leaseTypeEnum,
  heatingType: heatingTypeEnum,
  energyRating: energyRatingEnum,
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear() + 2),
  amenities: z.array(amenityEnum),
  houseRules: z.array(houseRuleEnum),
  nearbyTransit: z.array(nearbyPOISchema),
  nearbyAmenities: z.array(nearbyPOISchema),
  floorPlanUrl: z.string().url(),
  virtualTourUrl: z.string().url(),
  isFurnished: z.boolean(),
  isPetFriendly: z.boolean(),
  hasParking: z.boolean(),
  hasBalcony: z.boolean(),
  floorArea: z.number().min(0),
  floor: z.number().int(),
  totalFloors: z.number().int().min(0),
});

export const updateListingSchema = baseListingObject.partial();

export type UpdateListingInput = z.infer<typeof updateListingSchema>;

/** Allowed photo MIME types */
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Maximum photo file size in bytes (5MB) */
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

export const photoFileSchema = z.object({
  size: z.number().max(MAX_PHOTO_SIZE, "Photo must be under 5MB"),
  type: z.enum(ALLOWED_PHOTO_TYPES, {
    errorMap: () => ({ message: "Only JPEG, PNG, and WebP formats are supported" }),
  }),
});
