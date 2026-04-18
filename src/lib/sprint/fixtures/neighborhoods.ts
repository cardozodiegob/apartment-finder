/**
 * Test-database neighborhood-guide fixtures for the sprint runner.
 *
 * Three sample guides across Berlin, Amsterdam, and Lisbon. The `slug`
 * field is the idempotency key used by `seedTestDatabase`.
 *
 * Requirements: 12.2
 */

import type { Types } from "mongoose";

export interface NeighborhoodFixture {
  readonly city: string;
  readonly neighborhood: string;
  readonly slug: string;
  readonly overview: string;
  readonly transitScore: number;
  readonly transitInfo: string;
  readonly safetyInfo: string;
  readonly amenities: {
    supermarkets: string[];
    pharmacies: string[];
    schools: string[];
    parks: string[];
  };
  readonly averageRent: number;
  readonly centerLat: number;
  readonly centerLng: number;
  readonly isPublished: boolean;
  /** Populated by the seeder to the admin fixture user's ObjectId. */
  readonly updatedBy?: Types.ObjectId | string;
}

export interface NeighborhoodFixtureOwners {
  readonly updatedBy: Types.ObjectId | string;
}

export function buildNeighborhoodFixtures(
  owners: NeighborhoodFixtureOwners,
): NeighborhoodFixture[] {
  const updatedBy = owners.updatedBy;
  return [
    {
      city: "Berlin",
      neighborhood: "Mitte",
      slug: "berlin-mitte",
      overview:
        "Central Berlin district with strong public transit, dense " +
        "amenities, and a mix of historical and modern housing stock.",
      transitScore: 95,
      transitInfo: "Served by U-Bahn lines U2, U5, U6, U8 and the S-Bahn ring.",
      safetyInfo: "Generally safe; standard big-city vigilance recommended.",
      amenities: {
        supermarkets: ["REWE Rosenthaler", "Edeka Alexa"],
        pharmacies: ["Apotheke am Hackescher Markt"],
        schools: ["Berlin Cosmopolitan School"],
        parks: ["Monbijoupark", "Volkspark am Weinbergsweg"],
      },
      averageRent: 1400,
      centerLat: 52.525,
      centerLng: 13.402,
      isPublished: true,
      updatedBy,
    },
    {
      city: "Amsterdam",
      neighborhood: "Jordaan",
      slug: "amsterdam-jordaan",
      overview:
        "Historic canal district popular with students and young " +
        "professionals; walkable, bike-friendly, limited parking.",
      transitScore: 88,
      transitInfo: "Trams 13 and 17 plus frequent bus service.",
      safetyInfo: "Low crime; watch for bike theft.",
      amenities: {
        supermarkets: ["Albert Heijn Westerstraat"],
        pharmacies: ["Jordaan Apotheek"],
        schools: ["Montessori School Jordaan"],
        parks: ["Westerpark"],
      },
      averageRent: 1800,
      centerLat: 52.374,
      centerLng: 4.884,
      isPublished: true,
      updatedBy,
    },
    {
      city: "Lisboa",
      neighborhood: "Alfama",
      slug: "lisboa-alfama",
      overview:
        "Lisbon's oldest district; steep cobbled streets, iconic views, " +
        "smaller apartments, strong tourist footfall.",
      transitScore: 74,
      transitInfo: "Tram 28 and regional buses; Santa Apolónia station nearby.",
      safetyInfo: "Generally safe; pickpocket awareness advised around tourist tram lines.",
      amenities: {
        supermarkets: ["Mini Pingo Doce"],
        pharmacies: ["Farmácia Estácio"],
        schools: ["Escola Básica de Alfama"],
        parks: ["Miradouro de Santa Luzia"],
      },
      averageRent: 1050,
      centerLat: 38.712,
      centerLng: -9.129,
      isPublished: true,
      updatedBy,
    },
  ];
}
