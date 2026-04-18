/**
 * Test-database listing fixtures for the sprint runner.
 *
 * Six sample listings varying by city, bedroom count, and price, all owned
 * by the `landlord_poster` fixture user. Each fixture carries a stable
 * `fixtureKey` used as the idempotent upsert key by `seedTestDatabase`.
 *
 * Requirements: 12.2
 */

import type { Types } from "mongoose";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ListingFixture {
  /** Stable idempotency key; used by `seedTestDatabase` for the upsert. */
  readonly fixtureKey: string;
  readonly posterId: Types.ObjectId | string;
  readonly title: string;
  readonly description: string;
  readonly propertyType: "apartment" | "room" | "house";
  readonly purpose: "rent" | "share" | "sublet";
  readonly address: {
    street: string;
    city: string;
    neighborhood?: string;
    postalCode: string;
    country: string;
  };
  readonly location: {
    type: "Point";
    /** [lng, lat] */
    coordinates: [number, number];
  };
  readonly monthlyRent: number;
  readonly currency: "EUR" | "USD";
  readonly availableDate: Date;
  readonly photos: string[];
  readonly photoHashes: string[];
  readonly tags: string[];
  readonly isSharedAccommodation: boolean;
  readonly availableRooms?: number;
  readonly isFurnished: boolean;
  readonly hasParking: boolean;
  readonly hasBalcony: boolean;
  readonly floorArea: number;
  readonly status: "draft" | "active" | "under_review" | "archived";
  readonly isFeatured: boolean;
}

export interface ListingFixtureOwners {
  /** ObjectId of the fixture user with persona `landlord_poster`. */
  readonly landlordPosterId: Types.ObjectId | string;
}

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

/**
 * Build 6 sample listings, all owned by the landlord_poster fixture user.
 * Idempotency key is stored on each fixture as `fixtureKey`.
 */
export function buildListingFixtures(
  owners: ListingFixtureOwners,
): ListingFixture[] {
  const owner = owners.landlordPosterId;
  // Use a fixed "available in 30 days" anchor so re-seeding the same day
  // gives identical upsert values (idempotency).
  const availableDate = new Date("2025-03-01T00:00:00.000Z");

  return [
    {
      fixtureKey: "berlin-mitte-studio",
      posterId: owner,
      title: "Cozy studio in Berlin Mitte",
      description:
        "Compact furnished studio a short walk from Alexanderplatz. " +
        "Ideal for a single tenant relocating to Berlin.",
      propertyType: "apartment",
      purpose: "rent",
      address: {
        street: "Rosenthaler Straße 40",
        city: "Berlin",
        neighborhood: "Mitte",
        postalCode: "10178",
        country: "DE",
      },
      location: { type: "Point", coordinates: [13.402, 52.525] },
      monthlyRent: 950,
      currency: "EUR",
      availableDate,
      photos: [],
      photoHashes: [],
      tags: ["studio", "furnished", "transit"],
      isSharedAccommodation: false,
      isFurnished: true,
      hasParking: false,
      hasBalcony: false,
      floorArea: 28,
      status: "active",
      isFeatured: true,
    },
    {
      fixtureKey: "berlin-prenzlauerberg-2br",
      posterId: owner,
      title: "Bright 2-bedroom in Prenzlauer Berg",
      description:
        "Sunny 2-bedroom flat with balcony, suitable for a small family " +
        "or two flatmates.",
      propertyType: "apartment",
      purpose: "rent",
      address: {
        street: "Kastanienallee 12",
        city: "Berlin",
        neighborhood: "Prenzlauer Berg",
        postalCode: "10435",
        country: "DE",
      },
      location: { type: "Point", coordinates: [13.407, 52.538] },
      monthlyRent: 1750,
      currency: "EUR",
      availableDate,
      photos: [],
      photoHashes: [],
      tags: ["family", "balcony", "furnished"],
      isSharedAccommodation: false,
      isFurnished: true,
      hasParking: false,
      hasBalcony: true,
      floorArea: 72,
      status: "active",
      isFeatured: false,
    },
    {
      fixtureKey: "amsterdam-jordaan-room",
      posterId: owner,
      title: "Shared room near Jordaan canals",
      description:
        "Private room in a 3-person flatshare. Shared kitchen and lounge. " +
        "Great for students and early-career professionals.",
      propertyType: "room",
      purpose: "share",
      address: {
        street: "Prinsengracht 101",
        city: "Amsterdam",
        neighborhood: "Jordaan",
        postalCode: "1015DE",
        country: "NL",
      },
      location: { type: "Point", coordinates: [4.884, 52.374] },
      monthlyRent: 650,
      currency: "EUR",
      availableDate,
      photos: [],
      photoHashes: [],
      tags: ["shared", "student", "furnished"],
      isSharedAccommodation: true,
      availableRooms: 1,
      isFurnished: true,
      hasParking: false,
      hasBalcony: false,
      floorArea: 14,
      status: "active",
      isFeatured: false,
    },
    {
      fixtureKey: "lisbon-alfama-1br",
      posterId: owner,
      title: "Traditional 1-bedroom in Alfama",
      description:
        "Quiet 1-bedroom apartment in Lisbon's historic Alfama district. " +
        "Tiled floors, updated kitchen, no lift.",
      propertyType: "apartment",
      purpose: "rent",
      address: {
        street: "Rua dos Remédios 25",
        city: "Lisboa",
        neighborhood: "Alfama",
        postalCode: "1100-443",
        country: "PT",
      },
      location: { type: "Point", coordinates: [-9.129, 38.712] },
      monthlyRent: 1100,
      currency: "EUR",
      availableDate,
      photos: [],
      photoHashes: [],
      tags: ["historic", "quiet"],
      isSharedAccommodation: false,
      isFurnished: false,
      hasParking: false,
      hasBalcony: true,
      floorArea: 45,
      status: "active",
      isFeatured: false,
    },
    {
      fixtureKey: "paris-marais-3br",
      posterId: owner,
      title: "Family 3-bedroom near Le Marais",
      description:
        "Spacious 3-bedroom family home with parking and garden access. " +
        "Suitable for long-term family tenancy.",
      propertyType: "house",
      purpose: "rent",
      address: {
        street: "Rue de Turenne 48",
        city: "Paris",
        neighborhood: "Le Marais",
        postalCode: "75003",
        country: "FR",
      },
      location: { type: "Point", coordinates: [2.363, 48.859] },
      monthlyRent: 3200,
      currency: "EUR",
      availableDate,
      photos: [],
      photoHashes: [],
      tags: ["family", "parking", "garden"],
      isSharedAccommodation: false,
      isFurnished: false,
      hasParking: true,
      hasBalcony: false,
      floorArea: 120,
      status: "active",
      isFeatured: true,
    },
    {
      fixtureKey: "madrid-chamberi-sublet",
      posterId: owner,
      title: "Short-term sublet in Chamberí",
      description:
        "Two-month sublet opportunity, fully furnished. Good for " +
        "relocating professionals on a temporary assignment.",
      propertyType: "apartment",
      purpose: "sublet",
      address: {
        street: "Calle de Fuencarral 120",
        city: "Madrid",
        neighborhood: "Chamberí",
        postalCode: "28010",
        country: "ES",
      },
      location: { type: "Point", coordinates: [-3.702, 40.43] },
      monthlyRent: 1400,
      currency: "EUR",
      availableDate,
      photos: [],
      photoHashes: [],
      tags: ["sublet", "furnished", "short-term"],
      isSharedAccommodation: false,
      isFurnished: true,
      hasParking: false,
      hasBalcony: false,
      floorArea: 55,
      status: "active",
      isFeatured: false,
    },
  ];
}
