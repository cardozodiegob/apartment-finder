import { z } from "zod";

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
      "Coordinates must be valid [longitude, latitude]"
    ),
});

const propertyTypeEnum = z.enum(["apartment", "room", "house"]);
const purposeEnum = z.enum(["rent", "share", "sublet"]);
const currencyEnum = z.enum([
  "EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "BRL",
]);

export const createListingSchema = z.object({
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
  isFurnished: z.boolean().optional(),
  isPetFriendly: z.boolean().optional(),
  hasParking: z.boolean().optional(),
  hasBalcony: z.boolean().optional(),
  floorArea: z.number().min(0).optional(),
  floor: z.number().int().optional(),
  totalFloors: z.number().int().min(0).optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

export const updateListingSchema = createListingSchema.partial();

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
