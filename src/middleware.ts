import { NextRequest, NextResponse } from "next/server";
import {
  locales,
  defaultLocale,
  parseAcceptLanguage,
  type SupportedLocale,
} from "@/i18n/request";

export function middleware(request: NextRequest) {
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
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
