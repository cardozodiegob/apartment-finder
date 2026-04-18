/**
 * `a11y.run_axe` tool — launches Playwright chromium, navigates to each
 * URL, and runs axe-core. One Finding is emitted per WCAG 2.1 AA
 * violation; the raw axe output is persisted to
 * `.kiro/sprints/<sprintId>/a11y/<sanitized_url>.json`.
 *
 * Playwright is optional at runtime: when `chromium.launch()` fails
 * (e.g. `npx playwright install` hasn't been run) the tool returns a
 * `skipped` status and emits no findings.
 *
 * Requirements: 4.10, 10.3
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  assertHostAllowed,
  NetworkAllowListError,
} from "@/lib/sprint/net-allowlist";
import { axeImpactToSeverity } from "@/lib/sprint/journey/runner";

import type { ToolDefinition, ToolRunContext } from "../executor";
import { findingsEmitToolDef } from "./findings-emit";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const paramsSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(20),
});

export type A11yRunAxeParams = z.infer<typeof paramsSchema>;

export interface A11yRunAxeOutput {
  status: "ok" | "skipped";
  reason?: string;
  urlsScanned: number;
  violationsFound: number;
  findingsEmitted: number;
  outputDir?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeUrlForFileName(url: string): string {
  const replaced = url.replace(/[^A-Za-z0-9._-]+/g, "_");
  const trimmed = replaced.replace(/^_+|_+$/g, "");
  return trimmed.length > 0 ? trimmed.slice(0, 200) : "url";
}

function a11yOutputDir(sprintId: string): string {
  return path.join(process.cwd(), ".kiro", "sprints", sprintId, "a11y");
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const a11yRunAxeToolDef: ToolDefinition<
  A11yRunAxeParams,
  A11yRunAxeOutput
> = {
  name: "a11y.run_axe",
  schema: paramsSchema,
  async run(params, ctx: ToolRunContext): Promise<A11yRunAxeOutput> {
    // Validate every URL BEFORE we launch Playwright — cheap + safer.
    for (const url of params.urls) {
      try {
        assertHostAllowed(url);
      } catch (err) {
        if (err instanceof NetworkAllowListError) {
          throw new Error(
            `a11y.run_axe rejected URL "${url}": ${err.message}`,
          );
        }
        throw err;
      }
    }

    // Lazy-load playwright + axe so the tool degrades gracefully.
    let chromium: typeof import("playwright").chromium;
    try {
      ({ chromium } = await import("playwright"));
    } catch {
      return {
        status: "skipped",
        reason: "playwright package not importable",
        urlsScanned: 0,
        violationsFound: 0,
        findingsEmitted: 0,
      };
    }

    let browser: Awaited<ReturnType<typeof chromium.launch>>;
    try {
      browser = await chromium.launch();
    } catch (err) {
      return {
        status: "skipped",
        reason: `playwright browsers not installed: ${
          err instanceof Error ? err.message : String(err)
        }`,
        urlsScanned: 0,
        violationsFound: 0,
        findingsEmitted: 0,
      };
    }

    const outputDir = a11yOutputDir(ctx.sprintId);
    await mkdir(outputDir, { recursive: true });

    let urlsScanned = 0;
    let violationsFound = 0;
    let findingsEmitted = 0;

    try {
      const { default: AxeBuilder } = await import("@axe-core/playwright");
      const browserContext = await browser.newContext();

      for (const url of params.urls) {
        const page = await browserContext.newPage();
        try {
          await page.goto(url, { waitUntil: "domcontentloaded" });
          const results = await new AxeBuilder({ page })
            .options({
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21aa"],
              },
            })
            .analyze();

          // Persist raw output per URL.
          const fileName = `${sanitizeUrlForFileName(url)}.json`;
          const filePath = path.join(outputDir, fileName);
          await writeFile(
            filePath,
            JSON.stringify(
              {
                url,
                scannedAt: new Date().toISOString(),
                violations: results.violations,
                passes: results.passes.length,
                incomplete: results.incomplete.length,
              },
              null,
              2,
            ),
            "utf8",
          );

          urlsScanned++;
          violationsFound += results.violations.length;

          for (const violation of results.violations) {
            await findingsEmitToolDef.run(
              {
                category: "accessibility",
                severity: axeImpactToSeverity(violation.impact),
                title: `a11y: ${violation.id} — ${violation.help}`,
                description: [
                  violation.description,
                  "",
                  `WCAG tags: ${violation.tags.join(", ")}`,
                  `Affected nodes: ${violation.nodes.length}`,
                  `Help URL: ${violation.helpUrl}`,
                  `Page URL: ${url}`,
                ].join("\n"),
                reproductionSteps: [
                  `Navigate to ${url}`,
                  `Run axe-core with tags wcag2a, wcag2aa, wcag21aa`,
                  `Rule ${violation.id} fires on ${violation.nodes.length} node(s)`,
                ],
                evidenceUrls: [],
              },
              ctx,
            );
            findingsEmitted++;
          }
        } finally {
          await page.close().catch(() => undefined);
        }
      }

      await browserContext.close().catch(() => undefined);
    } finally {
      await browser.close().catch(() => undefined);
    }

    return {
      status: "ok",
      urlsScanned,
      violationsFound,
      findingsEmitted,
      outputDir: path
        .relative(process.cwd(), outputDir)
        .split(path.sep)
        .join("/"),
    };
  },
};
