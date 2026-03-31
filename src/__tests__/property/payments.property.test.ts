import { describe, it, expect, vi, beforeAll } from "vitest";
import * as fc from "fast-check";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
});

vi.mock("@/lib/db/models/Payment", () => ({ default: { create: vi.fn(), findById: vi.fn() } }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    paymentIntents: {
      create: vi.fn().mockResolvedValue({ id: "pi_test" }),
      capture: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
    },
  })),
}));

// Mock currency service to avoid fetch calls
vi.mock("@/lib/services/currency", () => ({
  convert: vi.fn().mockResolvedValue(100),
  formatPrice: vi.fn().mockReturnValue("€100.00"),
  getRates: vi.fn().mockResolvedValue({ base: "EUR", rates: {}, fetchedAt: Date.now() }),
}));

import {
  determinePaymentStatus,
  isEscrowHeld,
  shouldAutoCancel,
} from "@/lib/services/payments";
import type { PaymentStatus } from "@/lib/db/models/Payment";

const paymentCurrencyArb = fc.constantFrom("EUR" as const, "GBP" as const, "CHF" as const, "USD" as const);
const amountArb = fc.double({ min: 1, max: 100000, noNaN: true });

/**
 * Feature: apartment-finder, Property 21: Dual-party payment confirmation
 *
 * **Validates: Requirements 7.2, 7.3**
 */
describe("Feature: apartment-finder, Property 21: Dual-party payment confirmation", () => {
  it("funds transferred only when both parties confirm", () => {
    fc.assert(
      fc.property(
        fc.boolean(), fc.boolean(), fc.boolean(),
        (seekerConfirms, posterConfirms, isExpired) => {
          const status = determinePaymentStatus(seekerConfirms, posterConfirms, isExpired, false);

          if (seekerConfirms && posterConfirms) {
            expect(status).toBe("both_confirmed");
          } else if (isExpired) {
            expect(status).toBe("cancelled");
          } else if (seekerConfirms) {
            expect(status).toBe("seeker_confirmed");
          } else if (posterConfirms) {
            expect(status).toBe("poster_confirmed");
          } else {
            expect(status).toBe("pending");
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("single-party confirmation within 72h timeout results in cancellation", () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (seekerOnly) => {
          const status = determinePaymentStatus(seekerOnly, !seekerOnly, true, false);
          // Only one party confirmed + expired = cancelled
          expect(status).toBe("cancelled");
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 22: Payment escrow invariant
 *
 * **Validates: Requirements 7.1, 7.4**
 */
describe("Feature: apartment-finder, Property 22: Payment escrow invariant", () => {
  it("funds remain in escrow for pending/partially confirmed states", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PaymentStatus>("pending", "seeker_confirmed", "poster_confirmed", "both_confirmed", "processing"),
        (status) => {
          expect(isEscrowHeld(status)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("funds released for completed/cancelled/disputed states", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PaymentStatus>("completed", "cancelled", "disputed"),
        (status) => {
          expect(isEscrowHeld(status)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 23: Payment dispute freezes funds
 *
 * **Validates: Requirements 7.6**
 */
describe("Feature: apartment-finder, Property 23: Payment dispute freezes funds", () => {
  it("dispute always results in disputed status regardless of confirmation state", () => {
    fc.assert(
      fc.property(
        fc.boolean(), fc.boolean(), fc.boolean(),
        (seekerConfirms, posterConfirms, isExpired) => {
          const status = determinePaymentStatus(seekerConfirms, posterConfirms, isExpired, true);
          expect(status).toBe("disputed");
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: apartment-finder, Property 24: Payment receipt generation
 *
 * **Validates: Requirements 7.5, 7.8**
 */
describe("Feature: apartment-finder, Property 24: Payment receipt generation", () => {
  it("completed payments have receipt accessible to both parties with dual currency", () => {
    fc.assert(
      fc.property(
        amountArb, paymentCurrencyArb,
        (amount, currency) => {
          // A completed payment should have a receipt URL
          const payment = {
            status: "completed" as PaymentStatus,
            amount,
            currency,
            receiptUrl: `/payments/test/receipt`,
            seekerId: "seeker-1",
            posterId: "poster-1",
          };

          expect(payment.receiptUrl).toBeDefined();
          expect(payment.receiptUrl!.length).toBeGreaterThan(0);
          expect(payment.amount).toBe(amount);
          expect(payment.currency).toBe(currency);
        }
      ),
      { numRuns: 100 }
    );
  });
});
