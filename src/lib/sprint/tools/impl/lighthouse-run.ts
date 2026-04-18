/**
 * `lighthouse.run` tool — runs Lighthouse against a single URL on the
 * isolated test app instance. Uses the `lighthouse` npm package
 * programmatically via `chrome-launcher`; falls back to a `skipped`
 * result when Chromium can't be launched (e.g. Playwright browsers not
 * installed).
 *
 * No findings are emitted — the devops_engineer agent turns the
 * resulting scores into findings when they fall below the thresholds in
 * Requirement 10.5.
 *
 * Requirements: 10.3
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  assertHostAllowed,
  NetworkAllowListError,
} from "@/lib/sprint/net-allowlist";

import type { ToolDefinition, ToolRunContext } from "../executor";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const LIGHTHOUSE_CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const;

type LighthouseCategory = (typeof LIGHTHOUSE_CATEGORIES)[number];

const paramsSchema = z.object({
  url: z.string().url(),
  categories: z
    .array(z.enum(LIGHTHOUSE_CATEGORIES))
    .optional()
    .transform((v) =>
      v && v.length > 0 ? v : ([...LIGHTHOUSE_CATEGORIES] as LighthouseCategory[]),
    ),
});

export type LighthouseRunParams = z.infer<typeof paramsSchema>;

export interface LighthouseRunOutput {
  status: "ok" | "skipped";
  reason?: string;
  url: string;
  scores: Partial<Record<LighthouseCategory, number | null>>;
  reportFile?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeUrlForFileName(url: string): string {
  const replaced = url.replace(/[^A-Za-z0-9._-]+/g, "_");
  const trimmed = replaced.replace(/^_+|_+$/g, "");
  return trimmed.length > 0 ? trimmed.slice(0, 200) : "url";
}

function lighthouseOutputDir(sprintId: string): string {
  return path.join(
    process.cwd(),
    ".kiro",
    "sprints",
    sprintId,
    "lighthouse",
  );
}

/** Shape of the relevant bits of the Lighthouse result we consume. */
interface LhrLike {
  categories?: Record<
    string,
    { score?: number | null | undefined } | undefined
  >;
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const lighthouseRunToolDef: ToolDefinition<
  LighthouseRunParams,
  LighthouseRunOutput
> = {
  name: "lighthouse.run",
  schema: paramsSchema,
  async run(params, ctx: ToolRunContext): Promise<LighthouseRunOutput> {
    try {
      assertHostAllowed(params.url);
    } catch (err) {
      if (err instanceof NetworkAllowListError) {
        throw new Error(
          `lighthouse.run rejected URL "${params.url}": ${err.message}`,
        );
      }
      throw err;
    }

    // Lazy-load chrome-launcher + lighthouse so the tool degrades
    // gracefully when either dep is missing.
    let launch: typeof import("chrome-launcher").launch;
    try {
      ({ launch } = await import("chrome-launcher"));
    } catch {
      return {
        status: "skipped",
        reason: "chrome-launcher not installed",
        url: params.url,
        scores: {},
      };
    }

    // Lighthouse exports a CommonJS default function.
    let lighthouseFn: (
      url: string,
      opts: Record<string, unknown>,
    ) => Promise<{ lhr: LhrLike } | undefined>;
    try {
      const mod = (await import("lighthouse")) as unknown as {
        default?: typeof lighthouseFn;
      } & typeof import("lighthouse");
      // `lighthouse` ships both `module.exports = fn` (CJS) and a named
      // default export depending on bundler; handle both.
      lighthouseFn =
        (mod.default as typeof lighthouseFn | undefined) ??
        (mod as unknown as typeof lighthouseFn);
    } catch {
      return {
        status: "skipped",
        reason: "lighthouse package not installed",
        url: params.url,
        scores: {},
      };
    }

    let chrome: Awaited<ReturnType<typeof launch>>;
    try {
      chrome = await launch({
        chromeFlags: ["--headless=new", "--no-sandbox"],
      });
    } catch (err) {
      return {
        status: "skipped",
        reason: `chrome could not be launched: ${
          err instanceof Error ? err.message : String(err)
        }`,
        url: params.url,
        scores: {},
      };
    }

    try {
      const result = await lighthouseFn(params.url, {
        port: chrome.port,
        output: "json",
        onlyCategories: params.categories,
        logLevel: "error",
      });

      if (!result || !result.lhr) {
        return {
          status: "skipped",
          reason: "lighthouse returned no report",
          url: params.url,
          scores: {},
        };
      }

      const lhr = result.lhr;
      const scores: Partial<Record<LighthouseCategory, number | null>> = {};
      for (const cat of params.categories) {
        const raw = lhr.categories?.[cat]?.score;
        // Lighthouse scores are normalized 0..1; scale to 0..100 for
        // consistency with Requirement 10.5 thresholds ("90 or above").
        scores[cat] =
          typeof raw === "number" ? Math.round(raw * 100) : null;
      }

      const outputDir = lighthouseOutputDir(ctx.sprintId);
      await mkdir(outputDir, { recursive: true });
      const fileName = `${sanitizeUrlForFileName(params.url)}.json`;
      const filePath = path.join(outputDir, fileName);
      await writeFile(
        filePath,
        JSON.stringify(
          {
            url: params.url,
            scannedAt: new Date().toISOString(),
            categories: params.categories,
            scores,
            lhr,
          },
          null,
          2,
        ),
        "utf8",
      );

      return {
        status: "ok",
        url: params.url,
        scores,
        reportFile: path
          .relative(process.cwd(), filePath)
          .split(path.sep)
          .join("/"),
      };
    } finally {
      try {
        await chrome.kill();
      } catch {
        // ignore
      }
    }
  },
};
