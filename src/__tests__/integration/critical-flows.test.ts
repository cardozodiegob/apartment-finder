import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
});

// --- Mocks ---
const mockUserCreate = vi.fn();
const mockUserFindById = vi.fn();
const mockListingCreate = vi.fn();
const mockListingFindById = vi.fn();
const mockListingFind = vi.fn();
const mockListingSave = vi.fn();
const mockReviewCreate = vi.fn();
const mockReviewFind = vi.fn();
const mockReportCreate = vi.fn();
const mockNotificationCreate = vi.fn();

vi.mock("@/lib/db/models/User", () => ({
  default: { create: (...a: unknown[]) => mockUserCreate(...a), findById: (...a: unknown[]) => mockUserFindById(...a), findOne: vi.fn() },
}));
vi.mock("@/lib/db/models/Listing", () => ({
  default: {
    create: (...a: unknown[]) => mockListingCreate(...a),
    findById: (...a: unknown[]) => mockListingFindById(...a),
    find: (...a: unknown[]) => mockListingFind(...a),
    updateMany: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));
vi.mock("@/lib/db/models/Review", () => ({
  default: { create: (...a: unknown[]) => mockReviewCreate(...a), find: (...a: unknown[]) => mockReviewFind(...a), findOne: vi.fn() },
}));
vi.mock("@/lib/db/models/Report", () => ({
  default: { create: (...a: unknown[]) => mockReportCreate(...a), find: vi.fn() },
}));
vi.mock("@/lib/db/models/Notification", () => ({
  default: { create: (...a: unknown[]) => mockNotificationCreate(...a), find: vi.fn() },
}));
vi.mock("@/lib/db/models/Payment", () => ({
  default: { create: vi.fn(), findById: vi.fn() },
}));
vi.mock("@/lib/db/models/ConsentLog", () => ({
  default: { create: vi.fn(), find: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("@/lib/db/models/ModerationLog", () => ({
  default: { create: vi.fn() },
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    auth: { admin: { createUser: vi.fn().mockResolvedValue({ data: { user: { id: "supabase-id" } }, error: null }) } },
    storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "url" } }) }) },
  },
}));
vi.mock("@/lib/supabase/client", () => ({
  supabase: { auth: { signInWithPassword: vi.fn(), signOut: vi.fn(), getSession: vi.fn() } },
}));
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    paymentIntents: { create: vi.fn().mockResolvedValue({ id: "pi_test" }), capture: vi.fn(), cancel: vi.fn() },
  })),
}));
vi.mock("@/lib/services/currency", () => ({
  convert: vi.fn().mockResolvedValue(100),
  formatPrice: vi.fn().mockReturnValue("€100.00"),
  getRates: vi.fn().mockResolvedValue({ base: "EUR", rates: {}, fetchedAt: Date.now() }),
}));

import { register } from "@/lib/services/auth";
import { validatePhoto } from "@/lib/services/listings";
import { analyzeListing, checkSuspiciousDescription } from "@/lib/services/scam-detection";
import { calculateTrustScore, getUserBadgeFromData } from "@/lib/services/trust";
import { shouldSuspendUser } from "@/lib/services/reports";
import { determinePaymentStatus, isEscrowHeld } from "@/lib/services/payments";
import { serializeFilters, deserializeFilters } from "@/lib/services/search";
import { isAdmin } from "@/lib/api/admin-middleware";

/**
 * Integration tests for critical flows
 */
describe("Integration: Auth flow", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("register creates user with correct data", async () => {
    mockUserCreate.mockResolvedValue({ supabaseId: "supabase-id", email: "test@test.com" });
    const result = await register({ email: "test@test.com", password: "Password123!", fullName: "Test User", preferredLanguage: "en" });
    expect(result.user).not.toBeNull();
    expect(result.error).toBeNull();
  });
});

describe("Integration: Listing lifecycle", () => {
  it("photo validation accepts valid files and rejects invalid", () => {
    expect(validatePhoto({ size: 1024, type: "image/jpeg" }).valid).toBe(true);
    expect(validatePhoto({ size: 10 * 1024 * 1024, type: "image/jpeg" }).valid).toBe(false);
    expect(validatePhoto({ size: 1024, type: "application/pdf" }).valid).toBe(false);
  });

  it("scam detection identifies suspicious descriptions", () => {
    const clean = checkSuspiciousDescription("Beautiful apartment in Berlin");
    expect(clean).toHaveLength(0);
    const suspicious = checkSuspiciousDescription("Send money before viewing, wire transfer only");
    expect(suspicious.length).toBeGreaterThan(0);
  });

  it("scam detection with duplicate photos flags high risk", async () => {
    mockListingFind.mockImplementation((query: Record<string, unknown>) => {
      if (query.photoHashes) return { select: () => [{ _id: { toString: () => "id" }, posterId: { toString: () => "other" }, photoHashes: ["abc"] }] };
      return { select: () => [{ monthlyRent: 1000 }, { monthlyRent: 1200 }, { monthlyRent: 1100 }] };
    });
    const result = await analyzeListing({
      photoHashes: ["abc"], posterId: { toString: () => "me" } as never,
      monthlyRent: 1000, currency: "EUR",
      address: { street: "St", city: "Berlin", postalCode: "10115", country: "DE" },
      description: "Nice place", title: "Test",
    });
    expect(result.riskLevel).toBe("high");
  });
});

describe("Integration: Payment flow", () => {
  it("dual-party confirmation flow works correctly", () => {
    expect(determinePaymentStatus(false, false, false, false)).toBe("pending");
    expect(determinePaymentStatus(true, false, false, false)).toBe("seeker_confirmed");
    expect(determinePaymentStatus(true, true, false, false)).toBe("both_confirmed");
    expect(determinePaymentStatus(true, false, true, false)).toBe("cancelled");
    expect(isEscrowHeld("pending")).toBe(true);
    expect(isEscrowHeld("completed")).toBe(false);
  });
});

describe("Integration: Trust and report flow", () => {
  it("trust score calculation and badge assignment", () => {
    const score = calculateTrustScore([{ rating: 5, ageDays: 0 }, { rating: 4, ageDays: 30 }], 1.0);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(5);
    expect(getUserBadgeFromData(0, score)).toBe("new_user");
    expect(getUserBadgeFromData(5, score)).toBe("trusted");
    expect(getUserBadgeFromData(5, 1.0)).toBe("flagged");
  });

  it("scam report accumulation triggers suspension", () => {
    expect(shouldSuspendUser(2)).toBe(false);
    expect(shouldSuspendUser(3)).toBe(true);
  });
});

describe("Integration: Filter round-trip", () => {
  it("serializes and deserializes filters correctly", () => {
    const filters = { query: "berlin", propertyType: "apartment" as const, purpose: "rent" as const };
    const serialized = serializeFilters(filters);
    const deserialized = deserializeFilters(serialized);
    expect(deserialized.query).toBe("berlin");
    expect(deserialized.propertyType).toBe("apartment");
    expect(deserialized.purpose).toBe("rent");
  });
});

describe("Integration: Admin access", () => {
  it("only admin role passes access check", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("seeker")).toBe(false);
    expect(isAdmin("poster")).toBe(false);
  });
});
