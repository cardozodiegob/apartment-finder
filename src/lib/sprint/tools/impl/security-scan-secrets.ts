/**
 * `security.scan_secrets` tool implementation.
 *
 * Runs the pattern set in `src/lib/sprint/security/secret-patterns.json`
 * over the repository working tree. Two pattern kinds are supported:
 *
 *   - `regex`    — scans every text file under `root`. Optional
 *                  `contextHints` narrow the match by requiring at
 *                  least one hint to appear within a ±200 char window.
 *   - `filename` — matches basenames from `git ls-files`. Used to
 *                  detect committed `.env` files and similar.
 *
 * Every hit is emitted as a Finding through `findings.emit`. Raw output
 * is written to `.kiro/sprints/<sprintId>/security/secrets.json`.
 *
 * Requirements: 7.4, 7.8
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import {
  FINDING_SEVERITIES,
  type FindingSeverity,
} from "@/lib/sprint/types";
import {
  collectRegexHits,
  MAX_SCANNABLE_BYTES,
  truncate,
  walkFiles,
  writeSecurityScanOutput,
} from "@/lib/sprint/security/scanUtils";

import type { ToolDefinition } from "../executor";
import { findingsEmitToolDef } from "./findings-emit";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const paramsSchema = z.object({
  /** Repo-relative directory to scan for regex patterns. Defaults to `.`. */
  root: z.string().trim().min(1).default("."),
});

export type SecurityScanSecretsParams = z.infer<typeof paramsSchema>;

export interface SecurityScanSecretsOutput {
  patternsApplied: number;
  filesScanned: number;
  trackedFilesChecked: number;
  findingsEmitted: number;
  scanFile: string;
}

// ---------------------------------------------------------------------------
// Pattern-file shape
// ---------------------------------------------------------------------------

const regexPatternSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(FINDING_SEVERITIES),
  kind: z.literal("regex"),
  regex: z.string(),
  regexFlags: z.string().optional(),
  contextHints: z.array(z.string()).optional(),
});

const filenamePatternSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(FINDING_SEVERITIES),
  kind: z.literal("filename"),
  filenames: z.array(z.string()).min(1),
  allowedFilenames: z.array(z.string()).optional(),
  source: z.literal("git-ls-files").optional(),
});

const secretPatternsSchema = z.object({
  patterns: z
    .array(z.union([regexPatternSchema, filenamePatternSchema]))
    .min(1),
});

type RegexPattern = z.infer<typeof regexPatternSchema>;
type FilenamePattern = z.infer<typeof filenamePatternSchema>;

// ---------------------------------------------------------------------------
// Raw output records
// ---------------------------------------------------------------------------

interface RegexHitRecord {
  patternId: string;
  title: string;
  severity: FindingSeverity;
  file: string;
  line: number;
  match: string;
}

interface FilenameHitRecord {
  patternId: string;
  title: string;
  severity: FindingSeverity;
  file: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadPatterns(): Promise<(RegexPattern | FilenamePattern)[]> {
  const patternsPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "sprint",
    "security",
    "secret-patterns.json",
  );
  const raw = await readFile(patternsPath, "utf8");
  return secretPatternsSchema.parse(JSON.parse(raw)).patterns;
}

async function gitTrackedFiles(): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files"], {
      cwd: process.cwd(),
      maxBuffer: 50 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout.split(/\r?\n/).filter((l) => l.length > 0);
  } catch {
    return [];
  }
}

function surroundingWindow(
  content: string,
  index: number,
  matchLength: number,
  radius = 200,
): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(content.length, index + matchLength + radius);
  return content.slice(start, end);
}

function matchesAnyHint(window: string, hints: readonly string[]): boolean {
  const lower = window.toLowerCase();
  return hints.some((h) => lower.includes(h.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const securityScanSecretsToolDef: ToolDefinition<
  SecurityScanSecretsParams,
  SecurityScanSecretsOutput
> = {
  name: "security.scan_secrets",
  schema: paramsSchema,
  async run(params, ctx): Promise<SecurityScanSecretsOutput> {
    const patterns = await loadPatterns();
    const regexPatterns = patterns.filter(
      (p): p is RegexPattern => p.kind === "regex",
    );
    const filenamePatterns = patterns.filter(
      (p): p is FilenamePattern => p.kind === "filename",
    );

    const rootAbs = path.resolve(process.cwd(), params.root);
    const files = await walkFiles(rootAbs);

    const regexHits: RegexHitRecord[] = [];
    const filenameHits: FilenameHitRecord[] = [];
    let filesScanned = 0;

    // ---- Regex pass -------------------------------------------------------
    for (const entry of files) {
      if (entry.sizeBytes > MAX_SCANNABLE_BYTES) continue;
      let content: string;
      try {
        content = await readFile(entry.absolutePath, "utf8");
      } catch {
        continue;
      }
      filesScanned++;

      const repoRel = path
        .relative(process.cwd(), entry.absolutePath)
        .split(path.sep)
        .join("/");

      for (const pattern of regexPatterns) {
        const flags = pattern.regexFlags ?? "";
        const withGlobal = flags.includes("g") ? flags : `${flags}g`;
        const regex = new RegExp(pattern.regex, withGlobal);
        const hits = collectRegexHits(content, regex);
        for (const hit of hits) {
          if (pattern.contextHints && pattern.contextHints.length > 0) {
            const window = surroundingWindow(
              content,
              hit.index,
              hit.matchText.length,
            );
            if (!matchesAnyHint(window, pattern.contextHints)) continue;
          }
          regexHits.push({
            patternId: pattern.id,
            title: pattern.title,
            severity: pattern.severity,
            file: repoRel,
            line: hit.line,
            match: truncate(hit.matchText, 120),
          });
        }
      }
    }

    // ---- Filename pass (git-tracked files) --------------------------------
    let trackedFilesChecked = 0;
    if (filenamePatterns.length > 0) {
      const tracked = await gitTrackedFiles();
      trackedFilesChecked = tracked.length;
      for (const pattern of filenamePatterns) {
        const allowed = new Set(pattern.allowedFilenames ?? []);
        const targets = new Set(pattern.filenames);
        for (const tf of tracked) {
          const basename = path.posix.basename(tf);
          if (!targets.has(basename)) continue;
          if (allowed.has(basename)) continue;
          filenameHits.push({
            patternId: pattern.id,
            title: pattern.title,
            severity: pattern.severity,
            file: tf,
          });
        }
      }
    }

    // ---- Persist raw output ----------------------------------------------
    const scanFile = await writeSecurityScanOutput(
      ctx.sprintId,
      "secrets.json",
      {
        tool: "security.scan_secrets",
        scannedAt: new Date().toISOString(),
        root: params.root,
        patternsApplied: patterns.length,
        filesScanned,
        trackedFilesChecked,
        regexHits,
        filenameHits,
      },
    );

    // ---- Emit findings ----------------------------------------------------
    const descriptionById = new Map(patterns.map((p) => [p.id, p.description]));
    let findingsEmitted = 0;

    for (const hit of regexHits) {
      await findingsEmitToolDef.run(
        {
          category: "security",
          severity: hit.severity,
          title: `${hit.title} in ${hit.file}:${hit.line}`,
          description: [
            descriptionById.get(hit.patternId) ?? hit.title,
            "",
            `Matched: "${hit.match}"`,
          ].join("\n"),
          reproductionSteps: [
            `Open ${hit.file}`,
            `Inspect line ${hit.line}`,
            `Secret pattern: ${hit.patternId}`,
          ],
          evidenceUrls: [],
        },
        ctx,
      );
      findingsEmitted++;
    }

    for (const hit of filenameHits) {
      await findingsEmitToolDef.run(
        {
          category: "security",
          severity: hit.severity,
          title: `${hit.title}: ${hit.file}`,
          description: [
            descriptionById.get(hit.patternId) ?? hit.title,
            "",
            `Tracked file: ${hit.file}`,
          ].join("\n"),
          reproductionSteps: [
            "Run `git ls-files` from the repo root",
            `Confirm ${hit.file} appears in the output`,
            `Secret pattern: ${hit.patternId}`,
          ],
          evidenceUrls: [],
        },
        ctx,
      );
      findingsEmitted++;
    }

    return {
      patternsApplied: patterns.length,
      filesScanned,
      trackedFilesChecked,
      findingsEmitted,
      scanFile,
    };
  },
};
