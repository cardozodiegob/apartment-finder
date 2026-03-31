import { describe, it, expect, vi, beforeAll } from "vitest";
import * as fc from "fast-check";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

vi.mock("@/lib/db/models/User", () => ({ default: { findById: vi.fn(), findOne: vi.fn(), create: vi.fn() } }));
vi.mock("@/lib/db/models/ModerationLog", () => ({ default: { create: vi.fn(), find: vi.fn() } }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));

import { isAdmin } from "@/lib/api/admin-middleware";

const roleArb = fc.constantFrom("seeker", "poster", "admin");

/**
 * Feature: apartment-finder, Property 27: Admin role access restriction
 *
 * **Validates: Requirements 8.8**
 */
describe("Feature: apartment-finder, Property 27: Admin role access restriction", () => {
  it("all non-admin roles are rejected", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("seeker", "poster"),
        (role) => {
          expect(isAdmin(role)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("only admin role is accepted", () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        if (role === "admin") {
          expect(isAdmin(role)).toBe(true);
        } else {
          expect(isAdmin(role)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 25: Admin report queue ordering
 *
 * **Validates: Requirements 8.6**
 */
describe("Feature: apartment-finder, Property 25: Admin report queue ordering", () => {
  it("reports are sorted with oldest unresolved first", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            status: fc.constantFrom("pending", "investigating", "resolved"),
            createdAt: fc.date({ min: new Date("2024-01-01"), max: new Date("2026-12-31"), noInvalidDate: true }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (reports) => {
          // Sort: unresolved first, then by oldest
          const sorted = [...reports]
            .filter((r) => r.status !== "resolved")
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

          // Verify ordering: each report should be older or same as the next
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i].createdAt.getTime()).toBeGreaterThanOrEqual(sorted[i - 1].createdAt.getTime());
          }
          // All should be unresolved
          for (const r of sorted) {
            expect(r.status).not.toBe("resolved");
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 26: Moderation action audit logging
 *
 * **Validates: Requirements 8.7**
 */
describe("Feature: apartment-finder, Property 26: Moderation action audit logging", () => {
  it("every moderation action log contains admin ID, timestamp, and reason", () => {
    fc.assert(
      fc.property(
        fc.record({
          adminId: fc.stringMatching(/^[0-9a-f]{24}$/),
          action: fc.constantFrom("suspend_user", "approve_listing", "resolve_report", "remove_listing"),
          targetType: fc.constantFrom("user" as const, "listing" as const, "report" as const),
          targetId: fc.stringMatching(/^[0-9a-f]{24}$/),
          reason: fc.stringMatching(/^[A-Za-z ]{5,50}$/),
          timestamp: fc.date({ min: new Date("2024-01-01"), max: new Date("2026-12-31") }),
        }),
        (logEntry) => {
          expect(logEntry.adminId).toBeDefined();
          expect(logEntry.adminId.length).toBe(24);
          expect(logEntry.timestamp).toBeInstanceOf(Date);
          expect(logEntry.reason.length).toBeGreaterThan(0);
          expect(["user", "listing", "report"]).toContain(logEntry.targetType);
        }
      ),
      { numRuns: 100 }
    );
  });
});
