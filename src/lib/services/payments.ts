import Payment from "@/lib/db/models/Payment";
import type { IPayment, PaymentStatus, PaymentCurrency } from "@/lib/db/models/Payment";
import { convert, formatPrice } from "@/lib/services/currency";
import type { SupportedCurrency, SupportedLocale } from "@/lib/services/currency";
import { z } from "zod";
import Stripe from "stripe";

// --- Types ---

export const paymentInputSchema = z.object({
  seekerId: z.string().min(1),
  posterId: z.string().min(1),
  listingId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.enum(["EUR", "GBP", "CHF", "USD"]),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

export interface PaymentSummary {
  payment: IPayment;
  displayAmount: string;
  convertedAmount?: string;
}

// --- Constants ---

const ESCROW_DURATION_MS = 72 * 60 * 60 * 1000; // 72 hours
const PAYMENT_CURRENCIES: PaymentCurrency[] = ["EUR", "GBP", "CHF", "USD"];

// --- Stripe client (lazy init) ---

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
      apiVersion: "2025-05-28.basil",
    });
  }
  return stripeClient;
}

// --- Helper for determining payment state ---

export function determinePaymentStatus(
  seekerConfirmed: boolean,
  posterConfirmed: boolean,
  isExpired: boolean,
  isDisputed: boolean
): PaymentStatus {
  if (isDisputed) return "disputed";
  if (isExpired && !(seekerConfirmed && posterConfirmed)) return "cancelled";
  if (seekerConfirmed && posterConfirmed) return "both_confirmed";
  if (seekerConfirmed) return "seeker_confirmed";
  if (posterConfirmed) return "poster_confirmed";
  return "pending";
}

export function isEscrowHeld(status: PaymentStatus): boolean {
  return ["pending", "seeker_confirmed", "poster_confirmed", "both_confirmed", "processing"].includes(status);
}

export function shouldAutoCancel(payment: { escrowExpiresAt: Date; status: PaymentStatus }): boolean {
  const isExpired = new Date() > new Date(payment.escrowExpiresAt);
  return isExpired && !["both_confirmed", "completed", "cancelled", "disputed"].includes(payment.status);
}

// --- Service ---

export async function initiatePayment(data: PaymentInput): Promise<{ payment: IPayment | null; error: string | null }> {
  const parsed = paymentInputSchema.safeParse(data);
  if (!parsed.success) {
    return { payment: null, error: parsed.error.errors[0].message };
  }

  const { seekerId, posterId, listingId, amount, currency } = parsed.data;

  if (!PAYMENT_CURRENCIES.includes(currency)) {
    return { payment: null, error: "This currency is not supported for payments" };
  }

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: currency.toLowerCase(),
      capture_method: "manual",
      metadata: { seekerId, posterId, listingId },
    });

    const payment = await Payment.create({
      seekerId,
      posterId,
      listingId,
      amount,
      currency,
      stripePaymentIntentId: paymentIntent.id,
      status: "pending",
      escrowExpiresAt: new Date(Date.now() + ESCROW_DURATION_MS),
    });

    return { payment, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to initiate payment";
    return { payment: null, error: msg };
  }
}

export async function confirmPayment(
  paymentId: string,
  userId: string
): Promise<{ payment: IPayment | null; error: string | null }> {
  try {
    const payment = await Payment.findById(paymentId);
    if (!payment) return { payment: null, error: "Payment not found" };

    if (shouldAutoCancel(payment)) {
      payment.status = "cancelled";
      await payment.save();
      return { payment: null, error: "Payment was cancelled due to timeout" };
    }

    const isSeeker = payment.seekerId.toString() === userId;
    const isPoster = payment.posterId.toString() === userId;

    if (!isSeeker && !isPoster) {
      return { payment: null, error: "Not authorized to confirm this payment" };
    }

    if (isSeeker && !payment.seekerConfirmedAt) {
      payment.seekerConfirmedAt = new Date();
    } else if (isPoster && !payment.posterConfirmedAt) {
      payment.posterConfirmedAt = new Date();
    }

    // Determine new status
    const bothConfirmed = !!payment.seekerConfirmedAt && !!payment.posterConfirmedAt;

    if (bothConfirmed) {
      payment.status = "both_confirmed";
      // Capture the payment via Stripe
      try {
        const stripe = getStripe();
        await stripe.paymentIntents.capture(payment.stripePaymentIntentId);
        payment.status = "completed";
        payment.receiptUrl = `/payments/${payment._id}/receipt`;
      } catch {
        payment.status = "processing";
      }
    } else if (payment.seekerConfirmedAt) {
      payment.status = "seeker_confirmed";
    } else if (payment.posterConfirmedAt) {
      payment.status = "poster_confirmed";
    }

    await payment.save();
    return { payment, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to confirm payment";
    return { payment: null, error: msg };
  }
}

export async function cancelPayment(
  paymentId: string,
  reason: string
): Promise<{ payment: IPayment | null; error: string | null }> {
  try {
    const payment = await Payment.findById(paymentId);
    if (!payment) return { payment: null, error: "Payment not found" };

    if (["completed", "cancelled", "disputed"].includes(payment.status)) {
      return { payment: null, error: `Cannot cancel payment in ${payment.status} status` };
    }

    try {
      const stripe = getStripe();
      await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
    } catch {
      // Continue even if Stripe cancel fails
    }

    payment.status = "cancelled";
    payment.disputeReason = reason;
    await payment.save();
    return { payment, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to cancel payment";
    return { payment: null, error: msg };
  }
}

export async function raiseDispute(
  paymentId: string,
  userId: string,
  reason: string
): Promise<{ payment: IPayment | null; error: string | null }> {
  try {
    const payment = await Payment.findById(paymentId);
    if (!payment) return { payment: null, error: "Payment not found" };

    const isParty = payment.seekerId.toString() === userId || payment.posterId.toString() === userId;
    if (!isParty) return { payment: null, error: "Not authorized to dispute this payment" };

    payment.status = "disputed";
    payment.disputeReason = reason;
    await payment.save();
    return { payment, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to raise dispute";
    return { payment: null, error: msg };
  }
}

export async function getPaymentSummary(
  paymentId: string,
  userCurrency?: SupportedCurrency,
  locale: SupportedLocale = "en"
): Promise<{ summary: PaymentSummary | null; error: string | null }> {
  try {
    const payment = await Payment.findById(paymentId);
    if (!payment) return { summary: null, error: "Payment not found" };

    const displayAmount = formatPrice(payment.amount, payment.currency as SupportedCurrency, locale);

    let convertedAmount: string | undefined;
    if (userCurrency && userCurrency !== payment.currency) {
      const converted = await convert(payment.amount, payment.currency as SupportedCurrency, userCurrency);
      convertedAmount = formatPrice(converted, userCurrency, locale);
    }

    return {
      summary: { payment, displayAmount, convertedAmount },
      error: null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to get payment summary";
    return { summary: null, error: msg };
  }
}
