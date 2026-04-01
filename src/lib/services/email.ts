import { Resend } from "resend";
import EmailLog from "@/lib/db/models/EmailLog";
import Notification from "@/lib/db/models/Notification";
import User from "@/lib/db/models/User";

// --- Types ---

export type EmailTemplate =
  | "verification"
  | "password_reset"
  | "payment_confirmation"
  | "report_resolution";

export interface EmailSendOptions {
  to: string;
  template: EmailTemplate;
  locale: string;
  data: Record<string, unknown>;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

// --- Constants ---

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000; // 1s, 4s, 16s (base^(2*attempt))

const APP_NAME = "Apartment Finder";

/** Templates that are considered essential (no unsubscribe link). */
const ESSENTIAL_TEMPLATES: EmailTemplate[] = ["verification", "password_reset"];

// --- Resend client (lazy singleton) ---

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export function getFromAddress(): string {
  return process.env.EMAIL_FROM || `${APP_NAME} <noreply@apartmentfinder.eu>`;
}

// --- Delay helper ---

export function computeBackoffMs(attempt: number): number {
  // attempt 0 → 1s, attempt 1 → 4s, attempt 2 → 16s
  return BACKOFF_BASE_MS * Math.pow(4, attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Hard-bounce detection ---

export function isHardBounce(error: unknown): boolean {
  if (error && typeof error === "object" && "statusCode" in error) {
    if ((error as { statusCode: number }).statusCode === 422) return true;
  }
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  return message.toLowerCase().includes("invalid");
}

// --- Locale-aware email content ---

interface EmailContent {
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string;
}

const MESSAGES: Record<string, Record<EmailTemplate, EmailContent>> = {
  en: {
    verification: {
      subject: "Verify your email address",
      heading: "Welcome to Apartment Finder!",
      body: "Please verify your email address by clicking the button below.",
      ctaLabel: "Verify Email",
    },
    password_reset: {
      subject: "Reset your password",
      heading: "Password Reset Request",
      body: "We received a request to reset your password. Click the button below to set a new password.",
      ctaLabel: "Reset Password",
    },
    payment_confirmation: {
      subject: "Payment confirmed",
      heading: "Payment Confirmation",
      body: "Your payment has been successfully processed.",
    },
    report_resolution: {
      subject: "Your report has been resolved",
      heading: "Report Resolution",
      body: "The report you submitted has been reviewed and resolved by our team.",
    },
  },
};

function getContent(template: EmailTemplate, locale: string): EmailContent {
  const lang = MESSAGES[locale] ? locale : "en";
  return MESSAGES[lang][template];
}

// --- HTML template rendering ---

function renderHtml(
  template: EmailTemplate,
  locale: string,
  data: Record<string, unknown>
): string {
  const content = getContent(template, locale);
  const isEssential = ESSENTIAL_TEMPLATES.includes(template);
  const link = (data.link as string) ?? "#";
  const unsubscribeUrl = (data.unsubscribeUrl as string) ?? "#";

  const ctaBlock = content.ctaLabel
    ? `<tr><td style="padding:24px 0"><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">${content.ctaLabel}</a></td></tr>`
    : "";

  const detailsBlock =
    template === "payment_confirmation" && data.amount
      ? `<tr><td style="padding:8px 0;color:#374151">Amount: <strong>${data.amount}</strong></td></tr>`
      : "";

  const unsubscribeBlock = !isEssential
    ? `<tr><td style="padding:16px 0;font-size:12px;color:#9ca3af"><a href="${unsubscribeUrl}" style="color:#9ca3af">Unsubscribe</a> from these emails.</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="background:#2563eb;padding:24px;text-align:center;color:#fff;font-size:20px;font-weight:700">${APP_NAME}</td></tr>
<tr><td style="padding:32px">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:22px;font-weight:700;color:#111827;padding-bottom:16px">${content.heading}</td></tr>
<tr><td style="font-size:16px;color:#374151;line-height:1.6;padding-bottom:8px">${content.body}</td></tr>
${detailsBlock}
${ctaBlock}
</table>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb">
<table width="100%" cellpadding="0" cellspacing="0">
${unsubscribeBlock}
<tr><td style="font-size:12px;color:#9ca3af;padding-top:4px">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// --- Core send with retry + logging ---

export async function sendEmail(
  options: EmailSendOptions
): Promise<EmailResult> {
  const { to, template, locale, data } = options;
  const resend = getResendClient();
  const from = getFromAddress();
  const content = getContent(template, locale);
  const html = renderHtml(template, locale, data);

  let lastError: string | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await resend.emails.send({ from, to, subject: content.subject, html });

      // Log success
      await logAttempt(to, template, "sent", attempt + 1);

      return { success: true };
    } catch (err: unknown) {
      lastError =
        err instanceof Error ? err.message : String(err ?? "Unknown error");

      // Check for hard bounce — don't retry
      if (isHardBounce(err)) {
        await logAttempt(to, template, "bounced", attempt + 1, lastError);
        return { success: false, error: lastError };
      }

      // Log transient failure
      await logAttempt(to, template, "failed", attempt + 1, lastError);

      // Wait before next retry (skip wait on last attempt)
      if (attempt < MAX_RETRIES - 1) {
        await sleep(computeBackoffMs(attempt));
      }
    }
  }

  // All retries exhausted — create fallback in-app notification
  await createFallbackNotification(to, template, lastError);

  return { success: false, error: lastError };
}

// --- Logging helper ---

async function logAttempt(
  recipient: string,
  template: string,
  status: "sent" | "failed" | "bounced",
  attempts: number,
  error?: string
): Promise<void> {
  try {
    await EmailLog.create({
      recipient,
      template,
      status,
      attempts,
      lastAttemptAt: new Date(),
      error,
    });
  } catch {
    // Logging failure should not break email flow
  }
}

// --- Fallback notification ---

async function createFallbackNotification(
  recipientEmail: string,
  template: string,
  error?: string
): Promise<void> {
  try {
    const user = await User.findOne({ email: recipientEmail });
    if (!user) return;

    const templateLabels: Record<string, string> = {
      verification: "Email Verification",
      password_reset: "Password Reset",
      payment_confirmation: "Payment Confirmation",
      report_resolution: "Report Resolution",
    };

    await Notification.create({
      userId: user._id,
      type: "security",
      title: `Email delivery failed: ${templateLabels[template] ?? template}`,
      body: `We were unable to deliver an email to ${recipientEmail}. ${error ? `Reason: ${error}` : "Please check your email settings."}`,
      metadata: { emailTemplate: template, emailError: error },
    });
  } catch {
    // Best-effort fallback — don't throw
  }
}
