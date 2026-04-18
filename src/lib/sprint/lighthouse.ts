/**
 * Lighthouse suite runner for the sprint retrospective.
 *
 * The devops_engineer (or tech_lead) agent calls this during the
 * `closing` phase to measure the test instance on a small, fixed set of
 * pages — the homepage and the search page by default. Scores for the
 * four Lighthouse categories (Performance, Accessibility, Best
 * Practices, SEO) are collected and fed into
 * {@link import("./success-bar").classifyResult}.
 *
 * This module is a pure orchestration helper: it knows how to iterate a
 * list of pages, launch Chromium, run Lighthouse, and shape the result
 * for the success-bar classifier. It does NOT emit Findings, write to
 * the workspace, or persist anything to MongoDB — the caller
 * (retrospective writer / tech_lead agent) does that.
 *
 * Failure modes are graceful: if either `chrome-launcher` or
 * `lighthouse` can't be imported, if Chromium can't be launched, or if a
 * per-page run throws, the page result is marked `status: "skipped"`
 * with a `reason` describing what happened. The sprint still closes.
 *
 * Requirements: 10.3, 10.5
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  assertHostAllowed,
  NetworkAllowListError,
} from "@/lib/sprint/net-allowlist";

import type { LighthousePageScores, SprintMetrics } from "./success-bar";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Lighthouse categories we score. Fixed list per Requirement 10.5. */
const LIGHTHOUSE_CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const;

type LighthouseCategory = (typeof LIGHTHOUSE_CATEGORIES)[number];

/** Pages scored by default — homepage and search page (Requirement 10.2). */
const DEFAULT_PAGES: readonly string[] = Object.freeze(["/", "/search"]);

export interface LighthouseRunInput {
  /** 24-hex sprint id used to locate the per-sprint artifact directory. */
  readonly sprintId: string;
  /** Base URL of the isolated test instance, e.g. `http://localhost:3100`. */
  readonly baseUrl: string;
  /** Page paths to audit. Defaults to `["/", "/search"]`. */
  readonly pages?: readonly string[];
}

export interface LighthousePageResult {
  /** Absolute URL that was audited. */
  readonly url: string;
  /** The originating page path (e.g. `"/"` or `"/search"`). */
  readonly page: string;
  /** `"ok"` iff Lighthouse produced scores; otherwise `"skipped"`. */
  readonly status: "ok" | "skipped";
  /** Populated when `status === "skipped"`. */
  readonly reason?: string;
  readonly scores: {
    readonly performance: number | null;
    readonly accessibility: number | null;
    readonly bestPractices: number | null;
    readonly seo: number | null;
  };
  /** Repo-relative path to the persisted LHR JSON, if the run completed. */
  readonly reportFile?: string;
}

export interface LighthouseSuiteResult {
  readonly pages: readonly LighthousePageResult[];
  /** True when at least one page returned `status: "ok"` with all four scores. */
  readonly anyComplete: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeUrlForFileName(url: string): string {
  const replaced = url.replace(/[^A-Za-z0-9._-]+/g, "_");
  const trimmed = replaced.replace(/^_+|_+$/g, "");
  return trimmed.length > 0 ? trimmed.slice(0, 200) : "url";
}

function lighthouseOutputDir(sprintId: string, cwd: string): string {
  return path.join(cwd, ".kiro", "sprints", sprintId, "lighthouse");
}

function joinUrl(baseUrl: string, page: string): string {
  // Strip trailing slash from base, ensure leading slash on page, so the
  // result is always canonical.
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = page.startsWith("/") ? page : `/${page}`;
  return `${base}${suffix}`;
}

/** Shape of the relevant bits of the Lighthouse result we consume. */
interface LhrLike {
  categories?: Record<
    string,
    { score?: number | null | undefined } | undefined
  >;
}

type LighthouseFn = (
  url: string,
  opts: Record<string, unknown>,
) => Promise<{ lhr: LhrLike } | undefined>;

type ChromeLauncher = typeof import("chrome-launcher");

// Cached module imports so we attempt the dynamic import once per
// process. `undefined` means "not yet tried"; `null` means "tried and
// failed" (a string reason is attached).
let cachedLaunch: ChromeLauncher["launch"] | null | undefined;
let cachedLaunchReason: string | undefined;
let cachedLighthouseFn: LighthouseFn | null | undefined;
let cachedLighthouseReason: string | undefined;

async function loadChromeLauncher(): Promise<ChromeLauncher["launch"] | null> {
  if (cachedLaunch !== undefined) return cachedLaunch;
  try {
    const mod = await import("chrome-launcher");
    cachedLaunch = mod.launch;
    return cachedLaunch;
  } catch (err) {
    cachedLaunch = null;
    cachedLaunchReason = `chrome-launcher not installed: ${
      err instanceof Error ? err.message : String(err)
    }`;
    return null;
  }
}

async function loadLighthouseFn(): Promise<LighthouseFn | null> {
  if (cachedLighthouseFn !== undefined) return cachedLighthouseFn;
  try {
    const mod = (await import("lighthouse")) as unknown as {
      default?: LighthouseFn;
    } & typeof import("lighthouse");
    cachedLighthouseFn =
      (mod.default as LighthouseFn | undefined) ??
      (mod as unknown as LighthouseFn);
    return cachedLighthouseFn;
  } catch (err) {
    cachedLighthouseFn = null;
    cachedLighthouseReason = `lighthouse package not installed: ${
      err instanceof Error ? err.message : String(err)
    }`;
    return null;
  }
}

function skippedPage(
  url: string,
  page: string,
  reason: string,
): LighthousePageResult {
  return {
    url,
    page,
    status: "skipped",
    reason,
    scores: {
      performance: null,
      accessibility: null,
      bestPractices: null,
      seo: null,
    },
  };
}

function extractScores(
  lhr: LhrLike,
): LighthousePageResult["scores"] {
  const get = (cat: LighthouseCategory): number | null => {
    const raw = lhr.categories?.[cat]?.score;
    // Lighthouse scores are normalized 0..1; scale to 0..100 integers for
    // parity with the Requirement 10.5 ">= 90" thresholds.
    return typeof raw === "number" ? Math.round(raw * 100) : null;
  };
  return {
    performance: get("performance"),
    accessibility: get("accessibility"),
    bestPractices: get("best-practices"),
    seo: get("seo"),
  };
}

// ---------------------------------------------------------------------------
// runLighthouseSuite
// ---------------------------------------------------------------------------

/**
 * Run Lighthouse against each page in `input.pages` (defaulting to the
 * homepage and the search page) on the isolated test instance and
 * return one result per page. Each run's full LHR is persisted to
 * `.kiro/sprints/<sprintId>/lighthouse/<sanitized_url>.json` for later
 * inspection in the admin UI.
 *
 * Host allow-list: every target URL is run through
 * {@link assertHostAllowed}; a URL outside the allow-list produces a
 * skipped result rather than throwing, so the suite can proceed for the
 * remaining pages.
 */
export async function runLighthouseSuite(
  input: LighthouseRunInput,
): Promise<LighthouseSuiteResult> {
  const pages = input.pages ?? DEFAULT_PAGES;
  const cwd = process.cwd();

  // Short-circuit when either dependency is missing: mark every page
  // skipped with the same reason rather than launching Chromium.
  const launch = await loadChromeLauncher();
  if (launch === null) {
    return {
      pages: pages.map((page) =>
        skippedPage(
          joinUrl(input.baseUrl, page),
          page,
          cachedLaunchReason ?? "chrome-launcher unavailable",
        ),
      ),
      anyComplete: false,
    };
  }

  const lighthouseFn = await loadLighthouseFn();
  if (lighthouseFn === null) {
    return {
      pages: pages.map((page) =>
        skippedPage(
          joinUrl(input.baseUrl, page),
          page,
          cachedLighthouseReason ?? "lighthouse package unavailable",
        ),
      ),
      anyComplete: false,
    };
  }

  const outputDir = lighthouseOutputDir(input.sprintId, cwd);
  await mkdir(outputDir, { recursive: true });

  const results: LighthousePageResult[] = [];
  for (const page of pages) {
    const url = joinUrl(input.baseUrl, page);

    try {
      assertHostAllowed(url);
    } catch (err) {
      const reason =
        err instanceof NetworkAllowListError
          ? `url rejected by allow-list: ${err.message}`
          : `url rejected: ${
              err instanceof Error ? err.message : String(err)
            }`;
      results.push(skippedPage(url, page, reason));
      continue;
    }

    let chrome: Awaited<ReturnType<typeof launch>>;
    try {
      chrome = await launch({
        chromeFlags: ["--headless=new", "--no-sandbox"],
      });
    } catch (err) {
      results.push(
        skippedPage(
          url,
          page,
          `chrome could not be launched: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );
      continue;
    }

    try {
      const result = await lighthouseFn(url, {
        port: chrome.port,
        output: "json",
        onlyCategories: [...LIGHTHOUSE_CATEGORIES],
        logLevel: "error",
      });

      if (!result || !result.lhr) {
        results.push(skippedPage(url, page, "lighthouse returned no report"));
        continue;
      }

      const scores = extractScores(result.lhr);
      const fileName = `${sanitizeUrlForFileName(url)}.json`;
      const filePath = path.join(outputDir, fileName);
      await writeFile(
        filePath,
        JSON.stringify(
          {
            url,
            page,
            scannedAt: new Date().toISOString(),
            categories: [...LIGHTHOUSE_CATEGORIES],
            scores,
            lhr: result.lhr,
          },
          null,
          2,
        ),
        "utf8",
      );

      results.push({
        url,
        page,
        status: "ok",
        scores,
        reportFile: path
          .relative(cwd, filePath)
          .split(path.sep)
          .join("/"),
      });
    } catch (err) {
      results.push(
        skippedPage(
          url,
          page,
          `lighthouse run threw: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );
    } finally {
      try {
        await chrome.kill();
      } catch {
        // ignore — chrome-launcher best-effort cleanup
      }
    }
  }

  const anyComplete = results.some(
    (p) =>
      p.status === "ok" &&
      p.scores.performance !== null &&
      p.scores.accessibility !== null &&
      p.scores.bestPractices !== null &&
      p.scores.seo !== null,
  );

  return { pages: results, anyComplete };
}

// ---------------------------------------------------------------------------
// Adapter for the success-bar classifier
// ---------------------------------------------------------------------------

/**
 * Convert a suite result into the shape consumed by
 * {@link import("./success-bar").classifyResult}. Pages with
 * `status: "skipped"` or a `null` score in any of the four axes are
 * excluded — the classifier's threshold is "every scored page is >= 90",
 * so a page we couldn't score contributes nothing to the verdict.
 */
export function toSuccessBarLighthouseScores(
  suite: LighthouseSuiteResult,
): SprintMetrics["lighthouseScores"] {
  const out: LighthousePageScores[] = [];
  for (const p of suite.pages) {
    if (p.status !== "ok") continue;
    const { performance, accessibility, bestPractices, seo } = p.scores;
    if (
      performance === null ||
      accessibility === null ||
      bestPractices === null ||
      seo === null
    ) {
      continue;
    }
    out.push({
      page: p.page,
      performance,
      accessibility,
      bestPractices,
      seo,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Internal: reset caches (intended for tests)
// ---------------------------------------------------------------------------

/** Reset the memoized dynamic imports. Exported for tests only. */
export function resetLighthouseModuleCache(): void {
  cachedLaunch = undefined;
  cachedLaunchReason = undefined;
  cachedLighthouseFn = undefined;
  cachedLighthouseReason = undefined;
}
