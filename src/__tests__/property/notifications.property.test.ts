import { describe, it, expect, vi, beforeAll } from "vitest";
import * as fc from "fast-check";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

vi.mock("@/lib/db/models/Notification", () => ({ default: { create: vi.fn(), find: vi.fn(), findById: vi.fn() } }));
vi.mock("@/lib/db/models/User", () => ({ default: { findById: vi.fn() } }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));

import { isCriticalEvent, shouldDeliver, shouldSendEmail } from "@/lib/services/notifications";
import type { NotificationType } from "@/lib/db/models/Notification";
import type { INotificationPreferences } from "@/lib/db/models/User";

const notificationTypeArb = fc.constantFrom<NotificationType>(
  "message", "payment", "report", "listing_status", "security", "roommate_request"
);

const preferencesArb: fc.Arbitrary<INotificationPreferences> = fc.record({
  email: fc.boolean(),
  inApp: fc.boolean(),
  payment: fc.boolean(),
  security: fc.boolean(),
  listing: fc.boolean(),
  report: fc.boolean(),
});

/**
 * Feature: apartment-finder, Property 34: Notification delivery by event type and channel
 *
 * **Validates: Requirements 12.1, 12.3**
 */
describe("Feature: apartment-finder, Property 34: Notification delivery by event type and channel", () => {
  it("all event types deliver in-app notifications when preferences allow", () => {
    fc.assert(
      fc.property(notificationTypeArb, (type) => {
        const allEnabled: INotificationPreferences = {
          email: true, inApp: true, payment: true, security: true, listing: true, report: true,
        };
        expect(shouldDeliver(type, allEnabled)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("critical events (payment, security, report) additionally send email", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<NotificationType>("payment", "security", "report"),
        (type) => {
          expect(isCriticalEvent(type)).toBe(true);
          const allEnabled: INotificationPreferences = {
            email: true, inApp: true, payment: true, security: true, listing: true, report: true,
          };
          expect(shouldSendEmail(type, allEnabled)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("non-critical events do not send email", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<NotificationType>("message", "listing_status", "roommate_request"),
        (type) => {
          expect(isCriticalEvent(type)).toBe(false);
          const allEnabled: INotificationPreferences = {
            email: true, inApp: true, payment: true, security: true, listing: true, report: true,
          };
          expect(shouldSendEmail(type, allEnabled)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 35: Notification preference enforcement
 *
 * **Validates: Requirements 12.4**
 */
describe("Feature: apartment-finder, Property 35: Notification preference enforcement", () => {
  it("disabled notification types are not delivered", () => {
    fc.assert(
      fc.property(notificationTypeArb, preferencesArb, (type, prefs) => {
        const delivered = shouldDeliver(type, prefs);

        // If inApp is disabled globally, nothing should be delivered
        if (!prefs.inApp) {
          expect(delivered).toBe(false);
          return;
        }

        // Check specific type preferences
        if (type === "payment" && !prefs.payment) expect(delivered).toBe(false);
        if (type === "security" && !prefs.security) expect(delivered).toBe(false);
        if (type === "listing_status" && !prefs.listing) expect(delivered).toBe(false);
        if (type === "report" && !prefs.report) expect(delivered).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("email not sent when email preference is disabled", () => {
    fc.assert(
      fc.property(notificationTypeArb, (type) => {
        const emailDisabled: INotificationPreferences = {
          email: false, inApp: true, payment: true, security: true, listing: true, report: true,
        };
        expect(shouldSendEmail(type, emailDisabled)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
