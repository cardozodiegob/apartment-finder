import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import * as fc from "fast-check";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

const mockReportCreate = vi.fn();
const mockReportFind = vi.fn();
const mockReportFindById = vi.fn();
const mockListingFindByIdAndUpdate = vi.fn();
const mockListingUpdateMany = vi.fn();
const mockUserFindById = vi.fn();

vi.mock("@/lib/db/models/Report", () => ({
  default: {
    create: (...args: unknown[]) => mockReportCreate(...args),
    find: (...args: unknown[]) => mockReportFind(...args),
    findById: (...args: unknown[]) => mockReportFindById(...args),
  },
}));

vi.mock("@/lib/db/models/Listing", () => ({
  default: {
    findByIdAndUpdate: (...args: unknown[]) => mockListingFindByIdAndUpdate(...args),
    updateMany: (...args: unknown[]) => mockListingUpdateMany(...args),
  },
}));

vi.mock("@/lib/db/models/User", () => ({
  default: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
}));

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));

import { createReport, shouldSuspendUser } from "@/lib/services/reports";

const categoryArb = fc.constantFrom(
  "suspected_scam" as const,
  "misleading_information" as const,
  "harassment" as const,
  "other" as const
);
const objectIdArb = fc.stringMatching(/^[0-9a-f]{24}$/);

/**
 * Feature: apartment-finder, Property 19: Report creation and notification
 *
 * **Validates: Requirements 6.3, 6.5**
 */
describe("Feature: apartment-finder, Property 19: Report creation and notification", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("reports with valid categories create tickets and set listing to under_review", async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArb, objectIdArb, objectIdArb, categoryArb,
        fc.stringMatching(/^[A-Za-z ]{5,30}$/),
        async (reporterId, reportedUserId, reportedListingId, category, description) => {
          mockReportCreate.mockResolvedValue({
            _id: "report-id",
            reporterId,
            reportedUserId,
            reportedListingId,
            category,
            description,
            status: "pending",
          });
          mockListingFindByIdAndUpdate.mockResolvedValue({});

          const { report, error } = await createReport({
            reporterId,
            reportedUserId,
            reportedListingId,
            category,
            description,
          });

          expect(error).toBeNull();
          expect(report).not.toBeNull();
          expect(report!.status).toBe("pending");
          // Listing should be set to under_review
          expect(mockListingFindByIdAndUpdate).toHaveBeenCalledWith(
            reportedListingId,
            { status: "under_review" }
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 20: Scam report accumulation suspends account
 *
 * **Validates: Requirements 6.7**
 */
describe("Feature: apartment-finder, Property 20: Scam report accumulation suspends account", () => {
  it("users with 3+ confirmed scam reports are suspended", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }),
        (confirmedReports) => {
          expect(shouldSuspendUser(confirmedReports)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("users with fewer than 3 confirmed reports are not suspended", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),
        (confirmedReports) => {
          expect(shouldSuspendUser(confirmedReports)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
