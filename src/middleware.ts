import { NextRequest, NextResponse } from "next/server";
import {
  locales,
  defaultLocale,
  parseAcceptLanguage,
  type SupportedLocale,
} from "@/i18n/request";

const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

function validateCsrf(request: NextRequest): NextResponse | null {
  if (!MUTATING_METHODS.has(request.method)) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null; // skip if not configured

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Allow same-origin non-browser clients (both headers absent)
  if (!origin && !referer) return null;

  const appOrigin = new URL(appUrl).origin;

  if (origin) {
    if (origin === appOrigin) return null;
    return NextResponse.json(
      { code: "CSRF_ERROR", message: "Cross-site request blocked" },
      { status: 403 }
    );
  }

  // No origin but referer present
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (refererOrigin === appOrigin) return null;
    } catch {
      // invalid referer URL
    }
    return NextResponse.json(
      { code: "CSRF_ERROR", message: "Cross-site request blocked" },
      { status: 403 }
    );
  }

  return null;
}

export function middleware(request: NextRequest) {
  // CSRF validation for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const csrfResponse = validateCsrf(request);
    if (csrfResponse) return csrfResponse;
    return NextResponse.next();
  }

  // Locale detection for page routes
  const response = NextResponse.next();

  const existingLocale = request.cookies.get("locale")?.value as
    | SupportedLocale
    | undefined;

  if (!existingLocale || !locales.includes(existingLocale)) {
    const acceptLanguage = request.headers.get("accept-language");
    const detectedLocale = parseAcceptLanguage(acceptLanguage);

    response.cookies.set("locale", detectedLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};
