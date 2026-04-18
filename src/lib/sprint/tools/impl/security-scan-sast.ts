/**
 * `security.scan_sast` tool implementation.
 *
 * Runs the regex rule set in `src/lib/sprint/security/sast-rules.json`
 * over the repository's `src/` tree (configurable via `root`). Each hit
 * is emitted as a Finding via `findings.emit` — the same validated path
 * agents use directly — so dedup, notification, and audit-log rules
 * apply uniformly. The raw output is persisted to
 * `.kiro/sprints/<sprintId>/security/sast.json` (Requirement 7.8).
 *
 * Requirements: 7.1, 7.8
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
  type FindingCategory,
  type FindingSeverity,
} from "@/lib/sprint/types";
import {
  collectRegexHits,
  globToRegex,
  MAX_SCANNABLE_BYTES,
  truncate,
  walkFiles,
  writeSecurityScanOutput,
} from "@/lib/sprint/security/scanUtils";

import type { ToolDefinition } from "../executor";
import { findingsEmitToolDef } from "./findings-emit";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const paramsSchema = z.object({
  /** Relative directory to scan. Defaults to `src`. */
  root: z.string().trim().min(1).default("src"),
});

export type SecurityScanSastParams = z.infer<typeof paramsSchema>;

export interface SecurityScanSastOutput {
  rulesApplied: number;
  filesScanned: number;
  findingsEmitted: number;
  scanFile: string;
}

// ---------------------------------------------------------------------------
// Rule-file shape
// ---------------------------------------------------------------------------

const sastRuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(FINDING_SEVERITIES),
  category: z.enum(FINDING_CATEGORIES),
  filePattern: z.string(),
  regex: z.string(),
  regexFlags: z.string().optional(),
  manualReview: z.boolean().optional(),
});

const sastRulesSchema = z.object({
  rules: z.array(sastRuleSchema).min(1),
});

type SastRule = z.infer<typeof sastRuleSchema>;

// ---------------------------------------------------------------------------
// Raw output record persisted to disk
// ---------------------------------------------------------------------------

interface SastHitRecord {
  ruleId: string;
  title: string;
  severity: FindingSeverity;
  category: FindingCategory;
  file: string;
  line: number;
  match: string;
  manualReview: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadRules(): Promise<SastRule[]> {
  const rulesPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "sprint",
    "security",
    "sast-rules.json",
  );
  const raw = await readFile(rulesPath, "utf8");
  const parsed = sastRulesSchema.parse(JSON.parse(raw));
  return parsed.rules;
}

function compileRule(rule: SastRule): {
  regex: RegExp;
  fileMatcher: RegExp;
} {
  // Ensure the global flag — `collectRegexHits` relies on it.
  const flags = rule.regexFlags ?? "";
  const withGlobal = flags.includes("g") ? flags : `${flags}g`;
  return {
    regex: new RegExp(rule.regex, withGlobal),
    fileMatcher: globToRegex(rule.filePattern),
  };
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const securityScanSastToolDef: ToolDefinition<
  SecurityScanSastParams,
  SecurityScanSastOutput
> = {
  name: "security.scan_sast",
  schema: paramsSchema,
  async run(params, ctx): Promise<SecurityScanSastOutput> {
    const rules = await loadRules();
    const compiled = rules.map((rule) => ({
      rule,
      ...compileRule(rule),
    }));

    const rootAbs = path.resolve(process.cwd(), params.root);
    const files = await walkFiles(rootAbs);

    const hits: SastHitRecord[] = [];
    let filesScanned = 0;

    // Cache file contents read once per file regardless of rule count.
    for (const entry of files) {
      if (entry.sizeBytes > MAX_SCANNABLE_BYTES) continue;
      const repoRel = path
        .relative(process.cwd(), entry.absolutePath)
        .split(path.sep)
        .join("/");

      // Apply only rules whose filePattern matches this file.
      const applicable = compiled.filter((c) => c.fileMatcher.test(repoRel));
      if (applicable.length === 0) continue;

      let content: string;
      try {
        content = await readFile(entry.absolutePath, "utf8");
      } catch {
        continue;
      }
      filesScanned++;

      for (const { rule, regex } of applicable) {
        const ruleHits = collectRegexHits(content, new RegExp(regex.source, regex.flags));
        for (const hit of ruleHits) {
          hits.push({
            ruleId: rule.id,
            title: rule.title,
            severity: rule.severity,
            category: rule.category,
            file: repoRel,
            line: hit.line,
            match: truncate(hit.matchText, 200),
            manualReview: rule.manualReview === true,
          });
        }
      }
    }

    // Persist the raw result before emitting findings so the artifact
    // survives even if emit fails partway through.
    const scanFile = await writeSecurityScanOutput(ctx.sprintId, "sast.json", {
      tool: "security.scan_sast",
      scannedAt: new Date().toISOString(),
      root: params.root,
      rulesApplied: rules.length,
      filesScanned,
      hitCount: hits.length,
      hits,
    });

    // Emit findings through the same validated pipeline agents use.
    let findingsEmitted = 0;
    for (const hit of hits) {
      const title = `${hit.title} in ${hit.file}:${hit.line}`;
      const description = [
        rules.find((r) => r.id === hit.ruleId)?.description ?? hit.title,
        "",
        `Matched: "${hit.match}"`,
        hit.manualReview ? "\nManual review required." : "",
      ]
        .filter((l) => l !== null)
        .join("\n")
        .trim();
      await findingsEmitToolDef.run(
        {
          category: hit.category,
          severity: hit.severity,
          title,
          description,
          reproductionSteps: [
            `Open ${hit.file}`,
            `Inspect line ${hit.line}`,
            `SAST rule: ${hit.ruleId}`,
          ],
          evidenceUrls: [],
        },
        ctx,
      );
      findingsEmitted++;
    }

    return {
      rulesApplied: rules.length,
      filesScanned,
      findingsEmitted,
      scanFile,
    };
  },
};
