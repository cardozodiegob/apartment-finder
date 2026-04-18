/**
 * Persona context wrappers for the Journey_Runner.
 *
 * Each {@link CustomerPersona} may carry side-channel rules — network
 * throttling, locale overrides, a11y enforcement, or access to the
 * state-changing DAST probe set. {@link applyPersonaContext} is the
 * single seam that maps a persona onto the JourneyContext mutations
 * described in Requirements 4.8–4.11 and the design's "Dispatch rules"
 * section.
 *
 * The function is intentionally persona-agnostic for unknown values
 * (defensive default: no context mutation, no special privileges).
 *
 * Requirements: 4.8, 4.9, 4.10, 4.11
 */

import type { BrowserContext } from "playwright";

import type { CustomerPersona } from "@/lib/sprint/types";
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/lib/sprint/personas";

import type { JourneyContext } from "./runner";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ApplyPersonaContextResult {
  /** A new JourneyContext; the input is never mutated. */
  readonly ctx: JourneyContext;
  /** True → the runner must force `axeCheck: true` on every browser step. */
  readonly forceAxeCheck: boolean;
  /**
   * True → the adversarial_probe persona may hit the state-changing DAST
   * probe set. No other persona is permitted to run those probes.
   */
  readonly allowStateChangingProbes: boolean;
}

// ---------------------------------------------------------------------------
// Persona → JourneyContext transforms
// ---------------------------------------------------------------------------

/** Default locale to pick for `non_english_speaker` when the ctx is still "en". */
const DEFAULT_NON_ENGLISH_LOCALE: SupportedLocale = "es";

/** Throttle profile for mobile_slow_network — 400 kbps / 100 ms RTT. */
const MOBILE_SLOW_PROFILE = Object.freeze({
  downKbps: 400,
  rttMs: 100,
});

function pickNonEnglishLocale(current: string): SupportedLocale {
  if (current !== "en") {
    // The caller's override already moved us off "en"; respect it when
    // it matches one of the app's supported locales.
    const match = SUPPORTED_LOCALES.find(
      (loc) => loc.toLowerCase() === current.toLowerCase(),
    );
    if (match && match !== "en") return match;
  }
  return DEFAULT_NON_ENGLISH_LOCALE;
}

/**
 * Apply the persona's side-channel rules to a JourneyContext and — when a
 * live Playwright `BrowserContext` is provided — configure CDP network
 * throttling and default request headers on it.
 *
 * The input `ctx` is cloned; callers receive a fresh object.
 */
export async function applyPersonaContext(
  persona: CustomerPersona,
  ctx: JourneyContext,
  browserContext?: BrowserContext,
): Promise<ApplyPersonaContextResult> {
  // Start with a shallow clone — the runner relies on referential
  // independence between input and output.
  const next: JourneyContext = { ...ctx };

  switch (persona) {
    case "mobile_slow_network": {
      next.network = { ...MOBILE_SLOW_PROFILE };
      if (browserContext !== undefined) {
        try {
          // CDP session per-browser-context. `.newCDPSession(page)` is
          // the typical shape, but Playwright also supports attaching a
          // CDP session at the browser-context level via a dummy page.
          const page = await browserContext.newPage();
          try {
            const cdp = await browserContext.newCDPSession(page);
            await cdp.send("Network.enable");
            await cdp.send("Network.emulateNetworkConditions", {
              offline: false,
              // Convert kilobits/sec → bytes/sec for the CDP protocol.
              downloadThroughput: (MOBILE_SLOW_PROFILE.downKbps * 1024) / 8,
              uploadThroughput: (MOBILE_SLOW_PROFILE.downKbps * 1024) / 8,
              latency: MOBILE_SLOW_PROFILE.rttMs,
            });
          } finally {
            await page.close().catch(() => undefined);
          }
        } catch {
          // CDP configuration is best-effort: if Chromium isn't actually
          // running (e.g. API-only mode or a non-Chromium driver), the
          // context-level rule still carries into the result.
        }
      }
      return {
        ctx: next,
        forceAxeCheck: false,
        allowStateChangingProbes: false,
      };
    }

    case "non_english_speaker": {
      const chosen = pickNonEnglishLocale(next.locale);
      next.locale = chosen;
      if (browserContext !== undefined) {
        try {
          await browserContext.setExtraHTTPHeaders({
            "Accept-Language": chosen,
          });
          // Set a locale cookie scoped to the test base URL host so
          // server-side locale detection sees it on the next request.
          try {
            const url = new URL(next.baseUrl);
            await browserContext.addCookies([
              {
                name: "NEXT_LOCALE",
                value: chosen,
                domain: url.hostname,
                path: "/",
              },
            ]);
          } catch {
            // ignore cookie errors; header is sufficient.
          }
        } catch {
          // best-effort; API mode ignores browser context.
        }
      }
      return {
        ctx: next,
        forceAxeCheck: false,
        allowStateChangingProbes: false,
      };
    }

    case "screen_reader_user": {
      // No ctx mutation — the runner consults `forceAxeCheck` to add
      // axe-core to every browser step and emits one finding per WCAG
      // 2.1 AA violation.
      return {
        ctx: next,
        forceAxeCheck: true,
        allowStateChangingProbes: false,
      };
    }

    case "adversarial_probe": {
      // Only this persona may hit the state-changing DAST probes.
      return {
        ctx: next,
        forceAxeCheck: false,
        allowStateChangingProbes: true,
      };
    }

    default: {
      return {
        ctx: next,
        forceAxeCheck: false,
        allowStateChangingProbes: false,
      };
    }
  }
}
