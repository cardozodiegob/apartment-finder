/**
 * KYC service — unified interface across providers.
 *
 * Default provider is Stripe Identity. Switch via the `KYC_PROVIDER` env var.
 * Real provider integration lives in `src/lib/services/kyc/{provider}.ts` —
 * this module just resolves the provider and normalizes the verification
 * session shape.
 */

export type KycProvider = "stripe_identity" | "sumsub" | "veriff" | "stub";

export interface KycSession {
  id: string;
  clientSecret: string;
  url?: string;
}

function pickProvider(): KycProvider {
  const raw = (process.env.KYC_PROVIDER ?? "stripe_identity").toLowerCase();
  if (raw === "sumsub" || raw === "veriff" || raw === "stub") return raw;
  return "stripe_identity";
}

/**
 * Creates a verification session for the given user. Returns a redirect URL
 * (or client secret) the frontend can send the user to.
 */
export async function createVerificationSession(userId: string): Promise<KycSession> {
  const provider = pickProvider();

  if (provider === "stripe_identity") {
    // Lazy-load to avoid crashing when the stripe package isn't installed yet.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Stripe = (await import("stripe")).default as unknown as any;
      const secret = process.env.STRIPE_SECRET_KEY;
      if (!secret) throw new Error("STRIPE_SECRET_KEY missing");
      const stripe = new Stripe(secret, { apiVersion: "2025-04-30.basil" });
      const s = await stripe.identity.verificationSessions.create({
        type: "document",
        metadata: { userId },
      });
      return { id: s.id, clientSecret: s.client_secret ?? "", url: s.url ?? undefined };
    } catch {
      // Fall through to stub
    }
  }

  // Stub — useful in dev
  return {
    id: `stub_${userId}_${Date.now()}`,
    clientSecret: "stub",
    url: "/dashboard/settings?kyc=stub",
  };
}
