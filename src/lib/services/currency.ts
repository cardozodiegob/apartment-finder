export type SupportedCurrency = "EUR" | "USD" | "GBP" | "CHF" | "SEK" | "NOK" | "DKK" | "PLN" | "CZK" | "BRL";
export type SupportedLocale = "en" | "es" | "fr" | "de" | "pt" | "it";

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  "EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "BRL",
];

export interface ExchangeRates {
  base: SupportedCurrency;
  rates: Partial<Record<SupportedCurrency, number>>;
  fetchedAt: number; // epoch ms
}

// --- In-memory cache (24h TTL) ---

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ratesCache = new Map<SupportedCurrency, ExchangeRates>();

// Fallback rates (approximate, used when API is unavailable)
const FALLBACK_RATES: Record<SupportedCurrency, number> = {
  EUR: 1, USD: 1.08, GBP: 0.86, CHF: 0.94, SEK: 11.2,
  NOK: 11.5, DKK: 7.46, PLN: 4.32, CZK: 25.1, BRL: 5.35,
};

export function _getRatesCache(): Map<SupportedCurrency, ExchangeRates> {
  return ratesCache;
}

// --- Locale to Intl locale mapping ---

const LOCALE_MAP: Record<SupportedLocale, string> = {
  en: "en-GB", es: "es-ES", fr: "fr-FR", de: "de-DE", pt: "pt-PT", it: "it-IT",
};

// --- Service ---

export async function getRates(base: SupportedCurrency): Promise<ExchangeRates> {
  const cached = ratesCache.get(base);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY || "";
    const url = apiKey
      ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`
      : `https://open.er-api.com/v6/latest/${base}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error("API error");

    const data = await res.json();
    const conversionRates = data.rates || data.conversion_rates || {};

    const rates: Partial<Record<SupportedCurrency, number>> = {};
    for (const currency of SUPPORTED_CURRENCIES) {
      if (conversionRates[currency] !== undefined) {
        rates[currency] = conversionRates[currency];
      }
    }

    const result: ExchangeRates = { base, rates, fetchedAt: Date.now() };
    ratesCache.set(base, result);
    return result;
  } catch {
    // Fallback to hardcoded rates
    const rates: Partial<Record<SupportedCurrency, number>> = {};
    const baseRate = FALLBACK_RATES[base];
    for (const currency of SUPPORTED_CURRENCIES) {
      rates[currency] = FALLBACK_RATES[currency] / baseRate;
    }
    const result: ExchangeRates = { base, rates, fetchedAt: Date.now() };
    ratesCache.set(base, result);
    return result;
  }
}

export async function convert(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency
): Promise<number> {
  if (from === to) return amount;
  const exchangeRates = await getRates(from);
  const rate = exchangeRates.rates[to];
  if (!rate) {
    // Cross-rate via EUR fallback
    const fromToEur = FALLBACK_RATES.EUR / FALLBACK_RATES[from];
    const eurToTarget = FALLBACK_RATES[to] / FALLBACK_RATES.EUR;
    return Math.round(amount * fromToEur * eurToTarget * 100) / 100;
  }
  return Math.round(amount * rate * 100) / 100;
}

export function formatPrice(
  amount: number,
  currency: SupportedCurrency,
  locale: SupportedLocale
): string {
  const intlLocale = LOCALE_MAP[locale] || "en-GB";
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date, locale: SupportedLocale): string {
  const intlLocale = LOCALE_MAP[locale] || "en-GB";
  return new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatNumber(value: number, locale: SupportedLocale): string {
  const intlLocale = LOCALE_MAP[locale] || "en-GB";
  return new Intl.NumberFormat(intlLocale).format(value);
}
