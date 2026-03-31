import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

export type SupportedLocale = "en" | "es" | "fr" | "de" | "pt" | "it";

export const locales: SupportedLocale[] = [
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "it",
];
export const defaultLocale: SupportedLocale = "en";

export function parseAcceptLanguage(
  acceptLanguage: string | null
): SupportedLocale {
  if (!acceptLanguage) return defaultLocale;

  const preferred = acceptLanguage
    .split(",")
    .map((part) => {
      const [lang, qPart] = part.trim().split(";");
      const q = qPart ? parseFloat(qPart.replace("q=", "")) : 1;
      return { lang: lang.trim().toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of preferred) {
    const exact = locales.find((l) => l === lang);
    if (exact) return exact;

    const prefix = lang.split("-")[0];
    const match = locales.find((l) => l === prefix);
    if (match) return match;
  }

  return defaultLocale;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const cookieLocale = cookieStore.get("locale")?.value as
    | SupportedLocale
    | undefined;

  let locale: SupportedLocale;

  if (cookieLocale && locales.includes(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const acceptLanguage = headerStore.get("accept-language");
    locale = parseAcceptLanguage(acceptLanguage);
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
