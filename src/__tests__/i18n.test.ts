import { describe, it, expect } from "vitest";
import {
  locales,
  defaultLocale,
  parseAcceptLanguage,
  type SupportedLocale,
} from "@/i18n/request";

import enMessages from "../../messages/en.json";
import esMessages from "../../messages/es.json";
import frMessages from "../../messages/fr.json";
import deMessages from "../../messages/de.json";
import ptMessages from "../../messages/pt.json";
import itMessages from "../../messages/it.json";

const allMessages: Record<string, Record<string, unknown>> = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
  de: deMessages,
  pt: ptMessages,
  it: itMessages,
};

const requiredKeys = ["nav", "common", "auth", "listings"];
const navKeys = ["home", "search", "listings", "login", "register", "admin"];
const commonKeys = ["loading", "error", "save", "cancel", "delete", "edit"];
const authKeys = ["email", "password", "login", "register", "forgotPassword"];
const listingsKeys = ["title", "description", "price", "location", "filters"];

describe("i18n configuration", () => {
  it("supports 6 locales", () => {
    expect(locales).toHaveLength(6);
    expect(locales).toEqual(["en", "es", "fr", "de", "pt", "it"]);
  });

  it("defaults to English", () => {
    expect(defaultLocale).toBe("en");
  });

  describe("message files", () => {
    for (const locale of locales) {
      it(`${locale} has all required top-level keys`, () => {
        const messages = allMessages[locale];
        for (const key of requiredKeys) {
          expect(messages).toHaveProperty(key);
        }
      });

      it(`${locale} has all nav keys`, () => {
        const nav = allMessages[locale].nav as Record<string, string>;
        for (const key of navKeys) {
          expect(nav).toHaveProperty(key);
          expect(typeof nav[key]).toBe("string");
          expect(nav[key].length).toBeGreaterThan(0);
        }
      });

      it(`${locale} has all common keys`, () => {
        const common = allMessages[locale].common as Record<string, string>;
        for (const key of commonKeys) {
          expect(common).toHaveProperty(key);
          expect(typeof common[key]).toBe("string");
          expect(common[key].length).toBeGreaterThan(0);
        }
      });

      it(`${locale} has all auth keys`, () => {
        const auth = allMessages[locale].auth as Record<string, string>;
        for (const key of authKeys) {
          expect(auth).toHaveProperty(key);
          expect(typeof auth[key]).toBe("string");
          expect(auth[key].length).toBeGreaterThan(0);
        }
      });

      it(`${locale} has all listings keys`, () => {
        const listings = allMessages[locale].listings as Record<string, string>;
        for (const key of listingsKeys) {
          expect(listings).toHaveProperty(key);
          expect(typeof listings[key]).toBe("string");
          expect(listings[key].length).toBeGreaterThan(0);
        }
      });
    }
  });
});

describe("parseAcceptLanguage", () => {
  it("returns default locale for null input", () => {
    expect(parseAcceptLanguage(null)).toBe("en");
  });

  it("returns default locale for empty string", () => {
    expect(parseAcceptLanguage("")).toBe("en");
  });

  it("detects exact locale match", () => {
    expect(parseAcceptLanguage("fr")).toBe("fr");
    expect(parseAcceptLanguage("de")).toBe("de");
    expect(parseAcceptLanguage("es")).toBe("es");
    expect(parseAcceptLanguage("pt")).toBe("pt");
    expect(parseAcceptLanguage("it")).toBe("it");
  });

  it("detects locale from language-region format", () => {
    expect(parseAcceptLanguage("pt-BR")).toBe("pt");
    expect(parseAcceptLanguage("es-MX")).toBe("es");
    expect(parseAcceptLanguage("fr-CA")).toBe("fr");
    expect(parseAcceptLanguage("de-AT")).toBe("de");
  });

  it("respects quality values", () => {
    expect(parseAcceptLanguage("en;q=0.5, fr;q=0.9")).toBe("fr");
    expect(parseAcceptLanguage("ja;q=0.9, de;q=0.8")).toBe("de");
  });

  it("picks highest quality supported locale", () => {
    expect(parseAcceptLanguage("zh;q=1.0, it;q=0.7, en;q=0.5")).toBe("it");
  });

  it("falls back to default for unsupported languages", () => {
    expect(parseAcceptLanguage("ja, zh, ko")).toBe("en");
  });

  it("handles complex Accept-Language headers", () => {
    expect(
      parseAcceptLanguage("en-US,en;q=0.9,fr;q=0.8,de;q=0.7")
    ).toBe("en");
  });
});
