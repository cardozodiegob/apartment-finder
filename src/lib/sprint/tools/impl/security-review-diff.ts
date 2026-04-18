/**
 * `security.review_diff` tool implementation.
 *
 * Reviews the unified diffs attached to a FixProposal by running the
 * SAST rule set against the ADDED lines only (so known issues in the
 * surrounding file don't re-trigger), plus a small set of diff-level
 * heuristics for auth-guard removal, `dangerouslySetInnerHTML`
 * introduction, and `eval(` introduction.
 *
 * Findings are emitted via `findings.emit`; raw output is persisted to
 * `.kiro/sprints/<sprintId>/security/review-<fixProposalId>.json`.
 *
 * Requirements: 7.5, 7.8
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { Types } from "mongoose";
import { z } from "zod";

import dbConnect from "@/lib/db/connection";
import FixProposal from "@/lib/db/models/FixProposal";
import {
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
  type FindingCategory,
  type FindingSeverity,
} from "@/lib/sprint/types";
import {
  collectRegexHits,
  truncate,
  writeSecurityScanOutput,
} from "@/lib/sprint/security/scanUtils";

import type { ToolDefinition } from "../executor";
import { findingsEmitToolDef } from "./findings-emit";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const FIX_ID_RE = /^P-[a-z0-9]{6}-\d+$/;

const paramsSchema = z.object({
  fixProposalId: z
    .string()
    .regex(FIX_ID_RE, "fixProposalId must match P-<6-alnum>-<n>"),
});

export type SecurityReviewDiffParams = z.infer<typeof paramsSchema>;

export interface SecurityReviewDiffOutput {
  fixProposalId: string;
  addedLinesScanned: number;
  removedLinesScanned: number;
  findingsEmitted: number;
  scanFile: string;
}

// ---------------------------------------------------------------------------
// SAST rule shape (subset; duplicates the zod schema in security-scan-sast)
// ---------------------------------------------------------------------------

const sastRuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(FINDING_SEVERITIES),
  category: z.enum(FINDING_CATEGORIES),
  regex: z.string(),
  regexFlags: z.string().optional(),
});
const sastRulesSchema = z.object({ rules: z.array(sastRuleSchema) });
type SastRule = z.infer<typeof sastRuleSchema>;

async function loadSastRules(): Promise<SastRule[]> {
  const rulesPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "sprint",
    "security",
    "sast-rules.json",
  );
  const raw = await readFile(rulesPath, "utf8");
  return sastRulesSchema.parse(JSON.parse(raw)).rules;
}

// ---------------------------------------------------------------------------
// Diff parsing
// ---------------------------------------------------------------------------

/**
 * Extract just the added and removed lines from a unified diff. The
 * returned arrays preserve file-internal ordering — useful for the
 * auth-guard heuristic which compares added vs. removed references.
 */
function extractDiffLines(diff: string): {
  added: string[];
  removed: string[];
} {
  const added: string[] = [];
  const removed: string[] = [];
  for (const raw of diff.split(/\r?\n/)) {
    if (raw.startsWith("+++") || raw.startsWith("---")) continue;
    if (raw.startsWith("+")) {
      added.push(raw.slice(1));
    } else if (raw.startsWith("-")) {
      removed.push(raw.slice(1));
    }
  }
  return { added, removed };
}

// ---------------------------------------------------------------------------
// Heuristic rule hits
// ---------------------------------------------------------------------------

interface DiffFinding {
  ruleId: string;
  title: string;
  severity: FindingSeverity;
  category: FindingCategory;
  file: string;
  addedLineIndex: number;
  match: string;
  description: string;
}

const AUTH_GUARDS = [
  "requireAuth",
  "requireAdmin",
  "requireSession",
  "getSession",
  "getServerSession",
];

const SANITIZER_HINTS = ["DOMPurify", "sanitize", "sanitizer"];

function runHeuristics(
  filePath: string,
  added: string[],
  removed: string[],
): DiffFinding[] {
  const results: DiffFinding[] = [];
  const addedJoined = added.join("\n");
  const removedJoined = removed.join("\n");

  // --- 1. Auth-guard removal ---------------------------------------------
  for (const guard of AUTH_GUARDS) {
    const removedCount = countOccurrences(removedJoined, guard);
    const addedCount = countOccurrences(addedJoined, guard);
    if (removedCount > addedCount) {
      results.push({
        ruleId: "diff-auth-guard-removed",
        title: `Auth guard \`${guard}\` removed from ${filePath}`,
        severity: "critical",
        category: "security",
        file: filePath,
        addedLineIndex: 0,
        match: guard,
        description: `The diff removes ${
          removedCount - addedCount
        } reference(s) to \`${guard}\` without an equivalent replacement. Confirm the route is intentionally being opened up.`,
      });
    }
  }

  // --- 2. dangerouslySetInnerHTML introduced without a sanitizer ---------
  added.forEach((line, idx) => {
    if (!line.includes("dangerouslySetInnerHTML")) return;
    const windowStart = Math.max(0, idx - 10);
    const windowEnd = Math.min(added.length, idx + 10);
    const neighborhood = added.slice(windowStart, windowEnd).join("\n");
    const hasSanitizer = SANITIZER_HINTS.some((h) =>
      neighborhood.includes(h),
    );
    if (!hasSanitizer) {
      results.push({
        ruleId: "diff-dangerously-set-inner-html",
        title: `dangerouslySetInnerHTML introduced in ${filePath} without a visible sanitizer`,
        severity: "high",
        category: "security",
        file: filePath,
        addedLineIndex: idx + 1,
        match: truncate(line.trim(), 160),
        description:
          "The diff adds `dangerouslySetInnerHTML` but no DOMPurify/sanitize helper is visible within ±10 added lines. Verify the HTML input is sanitized before rendering.",
      });
    }
  });

  // --- 3. eval( introduced -----------------------------------------------
  added.forEach((line, idx) => {
    // Ignore lines that contain `eval` as part of a longer word.
    const regex = /\beval\s*\(/g;
    if (!regex.test(line)) return;
    results.push({
      ruleId: "diff-eval-introduced",
      title: `eval() introduced in ${filePath}`,
      severity: "critical",
      category: "security",
      file: filePath,
      addedLineIndex: idx + 1,
      match: truncate(line.trim(), 160),
      description:
        "The diff introduces `eval(...)`. Replace with structured parsing or a safe alternative before committing.",
    });
  });

  return results;
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const securityReviewDiffToolDef: ToolDefinition<
  SecurityReviewDiffParams,
  SecurityReviewDiffOutput
> = {
  name: "security.review_diff",
  schema: paramsSchema,
  async run(params, ctx): Promise<SecurityReviewDiffOutput> {
    await dbConnect();

    const fp = await FixProposal.findOne({
      sprintId: new Types.ObjectId(ctx.sprintId),
      id: params.fixProposalId,
    });
    if (!fp) {
      throw new Error(`Fix proposal ${params.fixProposalId} not found`);
    }

    const rules = await loadSastRules();

    const allFindings: DiffFinding[] = [];
    let addedLinesScanned = 0;
    let removedLinesScanned = 0;

    for (const change of fp.fileChanges) {
      const { added, removed } = extractDiffLines(change.diff ?? "");
      addedLinesScanned += added.length;
      removedLinesScanned += removed.length;

      // --- SAST rules against added lines only ---------------------------
      const addedJoined = added.join("\n");
      for (const rule of rules) {
        const flags = rule.regexFlags ?? "";
        const withGlobal = flags.includes("g") ? flags : `${flags}g`;
        const regex = new RegExp(rule.regex, withGlobal);
        const hits = collectRegexHits(addedJoined, regex);
        for (const hit of hits) {
          allFindings.push({
            ruleId: rule.id,
            title: `${rule.title} introduced in ${change.path}`,
            severity: rule.severity,
            category: rule.category,
            file: change.path,
            addedLineIndex: hit.line,
            match: truncate(hit.matchText, 200),
            description: `${rule.description}\n\nMatched in added diff: "${truncate(hit.matchText, 200)}"`,
          });
        }
      }

      // --- Heuristics ---------------------------------------------------
      allFindings.push(...runHeuristics(change.path, added, removed));
    }

    // Persist raw output.
    const scanFile = await writeSecurityScanOutput(
      ctx.sprintId,
      `review-${fp.id}.json`,
      {
        tool: "security.review_diff",
        scannedAt: new Date().toISOString(),
        fixProposalId: fp.id,
        addedLinesScanned,
        removedLinesScanned,
        hits: allFindings,
      },
    );

    // Emit findings.
    let findingsEmitted = 0;
    for (const finding of allFindings) {
      await findingsEmitToolDef.run(
        {
          category: finding.category,
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          reproductionSteps: [
            `Inspect the diff for ${finding.file}`,
            `Added line ${finding.addedLineIndex}: ${finding.match}`,
            `Diff-review rule: ${finding.ruleId}`,
          ],
          evidenceUrls: [],
        },
        ctx,
      );
      findingsEmitted++;
    }

    return {
      fixProposalId: fp.id,
      addedLinesScanned,
      removedLinesScanned,
      findingsEmitted,
      scanFile,
    };
  },
};
