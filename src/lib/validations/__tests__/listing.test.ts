import { describe, it, expect } from "vitest";
import { createListingSchema } from "@/lib/validations/listing";

/**
 * Validates: Requirements 3, 48
 *
 * Covers the tricky edge cases in the listing Zod schema:
 * - min/max stay ordering
 * - mutually-exclusive house rules
 * - amenity enum enforcement
 * - energy-rating enum enforcement
 */

const VALID_BASE = {
  title: "Nice apartment",
  description: "A very nice apartment in the city center.",
  propertyType: "apartment" as const,
  purpose: "rent" as const,
  address: {
    street: "Unter den Linden 1",
    city: "Berlin",
    postalCode: "10117",
    country: "Germany",
  },
  location: { type: "Point" as const, coordinates: [13.4, 52.5] as [number, number] },
  monthlyRent: 1200,
  currency: "EUR" as const,
  availableDate: "2026-05-01",
};

describe("createListingSchema — stay range ordering", () => {
  it("accepts minStay <= maxStay", () => {
    const ok = createListingSchema.safeParse({
      ...VALID_BASE,
      minStayMonths: 3,
      maxStayMonths: 12,
    });
    expect(ok.success).toBe(true);
  });

  it("accepts equal min and max stay", () => {
    const ok = createListingSchema.safeParse({
      ...VALID_BASE,
      minStayMonths: 6,
      maxStayMonths: 6,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects minStay > maxStay", () => {
    const bad = createListingSchema.safeParse({
      ...VALID_BASE,
      minStayMonths: 12,
      maxStayMonths: 3,
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.path.includes("minStayMonths"))).toBe(true);
    }
  });

  it("allows either bound to be undefined", () => {
    expect(
      createListingSchema.safeParse({ ...VALID_BASE, minStayMonths: 3 }).success,
    ).toBe(true);
    expect(
      createListingSchema.safeParse({ ...VALID_BASE, maxStayMonths: 24 }).success,
    ).toBe(true);
  });
});

describe("createListingSchema — mutually-exclusive house rules", () => {
  it("accepts studentsOnly alone", () => {
    const ok = createListingSchema.safeParse({
      ...VALID_BASE,
      houseRules: ["studentsOnly"],
    });
    expect(ok.success).toBe(true);
  });

  it("accepts workingProfessionalsOnly alone", () => {
    const ok = createListingSchema.safeParse({
      ...VALID_BASE,
      houseRules: ["workingProfessionalsOnly"],
    });
    expect(ok.success).toBe(true);
  });

  it("rejects studentsOnly + workingProfessionalsOnly together", () => {
    const bad = createListingSchema.safeParse({
      ...VALID_BASE,
      houseRules: ["studentsOnly", "workingProfessionalsOnly"],
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.path.includes("houseRules"))).toBe(true);
    }
  });

  it("allows compatible rules to coexist", () => {
    const ok = createListingSchema.safeParse({
      ...VALID_BASE,
      houseRules: ["noSmoking", "noPets", "quietHours"],
    });
    expect(ok.success).toBe(true);
  });
});

describe("createListingSchema — enum enforcement", () => {
  it("rejects an unknown energyRating value", () => {
    const bad = createListingSchema.safeParse({
      ...VALID_BASE,
      // H is not a valid rating
      energyRating: "H",
    });
    expect(bad.success).toBe(false);
  });

  it("accepts every valid energyRating", () => {
    for (const r of ["A", "B", "C", "D", "E", "F", "G"]) {
      expect(
        createListingSchema.safeParse({ ...VALID_BASE, energyRating: r }).success,
      ).toBe(true);
    }
  });

  it("rejects an unknown amenity", () => {
    const bad = createListingSchema.safeParse({
      ...VALID_BASE,
      amenities: ["wifi", "notARealAmenity"],
    });
    expect(bad.success).toBe(false);
  });

  it("accepts a valid amenity list", () => {
    const ok = createListingSchema.safeParse({
      ...VALID_BASE,
      amenities: ["wifi", "heating", "elevator"],
    });
    expect(ok.success).toBe(true);
  });

  it("rejects an unknown leaseType but accepts the defaults", () => {
    const bad = createListingSchema.safeParse({
      ...VALID_BASE,
      leaseType: "forever",
    });
    expect(bad.success).toBe(false);

    for (const t of ["fixed_term", "open_ended", "student_semester", "short_term"]) {
      expect(
        createListingSchema.safeParse({ ...VALID_BASE, leaseType: t }).success,
      ).toBe(true);
    }
  });
});

describe("createListingSchema — yearBuilt bounds", () => {
  it("rejects a year in the distant past", () => {
    const bad = createListingSchema.safeParse({ ...VALID_BASE, yearBuilt: 1500 });
    expect(bad.success).toBe(false);
  });

  it("rejects a year too far in the future", () => {
    const bad = createListingSchema.safeParse({
      ...VALID_BASE,
      yearBuilt: new Date().getFullYear() + 10,
    });
    expect(bad.success).toBe(false);
  });

  it("accepts reasonable years", () => {
    const ok = createListingSchema.safeParse({ ...VALID_BASE, yearBuilt: 1990 });
    expect(ok.success).toBe(true);
  });
});
