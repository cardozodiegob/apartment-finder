/**
 * `security.audit_deps` tool implementation.
 *
 * Shells out to `npm audit --json` and emits one Finding per advisory
 * via `findings.emit`. The raw audit JSON is persisted to
 * `.kiro/sprints/<sprintId>/security/npm-audit.json`.
 *
 * `npm audit` exits non-zero when vulnerabilities are present — that's
 * a normal outcome for this tool, so we catch the rejection and parse
 * whatever stdout was produced anyway.
 *
 * Requirements: 7.3, 7.8
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { z } from "zod";

import type { FindingSeverity } from "@/lib/sprint/types";
import { writeSecurityScanOutput } from "@/lib/sprint/security/scanUtils";

import type { ToolDefinition } from "../executor";
import { findingsEmitToolDef } from "./findings-emit";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const paramsSchema = z.object({}).strict();

export type SecurityAuditDepsParams = z.infer<typeof paramsSchema>;

export interface SecurityAuditDepsOutput {
  vulnerabilityCount: number;
  findingsEmitted: number;
  scanFile: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map npm audit severity strings onto the sprint finding severity ladder. */
function mapNpmSeverity(npmSeverity: string | undefined): FindingSeverity {
  switch ((npmSeverity ?? "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "moderate":
      return "medium";
    case "low":
      return "low";
    case "info":
      return "low";
    default:
      return "low";
  }
}

/**
 * Run `npm audit --json` and return the parsed JSON. `npm audit` exits
 * non-zero when vulnerabilities are found; `execFile` rejects with the
 * stdout buffer attached to the error, which we still parse.
 */
async function runNpmAudit(): Promise<Record<string, unknown>> {
  try {
    const { stdout } = await execFileAsync("npm", ["audit", "--json"], {
      cwd: process.cwd(),
      maxBuffer: 50 * 1024 * 1024,
      // npm is a batch on Windows; spawn via shell so `npm` resolves.
      shell: process.platform === "win32",
      windowsHide: true,
    });
    return JSON.parse(stdout);
  } catch (err) {
    const maybe = err as {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };
    const stdout =
      typeof maybe.stdout === "string"
        ? maybe.stdout
        : Buffer.isBuffer(maybe.stdout)
          ? maybe.stdout.toString("utf8")
          : "";
    if (stdout.length === 0) {
      throw new Error(
        `npm audit failed without JSON output: ${maybe.message ?? String(err)}`,
      );
    }
    try {
      return JSON.parse(stdout);
    } catch (parseErr) {
      throw new Error(
        `npm audit produced non-JSON output: ${(parseErr as Error).message}`,
      );
    }
  }
}

interface NpmAdvisoryVia {
  source?: number;
  name?: string;
  dependency?: string;
  title?: string;
  url?: string;
  severity?: string;
  range?: string;
}

interface NpmVulnerability {
  name?: string;
  severity?: string;
  via?: Array<string | NpmAdvisoryVia>;
  effects?: string[];
  range?: string;
  fixAvailable?: boolean | { name?: string; version?: string; isSemVerMajor?: boolean };
}

function describeFixAvailable(fa: NpmVulnerability["fixAvailable"]): string {
  if (fa === undefined) return "fix availability unknown";
  if (fa === false) return "no fix currently available";
  if (fa === true) return "fix available via `npm audit fix`";
  const parts: string[] = [];
  if (fa.name) parts.push(fa.name);
  if (fa.version) parts.push(`@${fa.version}`);
  if (fa.isSemVerMajor) parts.push("(semver-major upgrade)");
  return `fix available: ${parts.join("") || "yes"}`;
}

function describeVia(via: NpmVulnerability["via"]): string {
  if (!via || via.length === 0) return "no via information";
  return via
    .map((entry) => {
      if (typeof entry === "string") return entry;
      const bits: string[] = [];
      if (entry.title) bits.push(entry.title);
      if (entry.name) bits.push(`(${entry.name})`);
      if (entry.severity) bits.push(`[${entry.severity}]`);
      if (entry.url) bits.push(entry.url);
      return bits.join(" ");
    })
    .join("; ");
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const securityAuditDepsToolDef: ToolDefinition<
  SecurityAuditDepsParams,
  SecurityAuditDepsOutput
> = {
  name: "security.audit_deps",
  schema: paramsSchema,
  async run(_params, ctx): Promise<SecurityAuditDepsOutput> {
    const audit = await runNpmAudit();

    // Persist raw output BEFORE emitting findings so the artifact is
    // never lost mid-emit.
    const scanFile = await writeSecurityScanOutput(
      ctx.sprintId,
      "npm-audit.json",
      audit,
    );

    const vulnerabilities = (audit.vulnerabilities ?? {}) as Record<
      string,
      NpmVulnerability
    >;
    const entries = Object.entries(vulnerabilities);
    let findingsEmitted = 0;

    for (const [pkgName, vuln] of entries) {
      const severity = mapNpmSeverity(vuln.severity);
      const viaDesc = describeVia(vuln.via);
      const fixDesc = describeFixAvailable(vuln.fixAvailable);
      const rangeDesc = vuln.range ? `Affected range: ${vuln.range}` : "";
      const description = [
        `npm audit reports a ${vuln.severity ?? "unknown-severity"} vulnerability in \`${pkgName}\`.`,
        "",
        `Advisories: ${viaDesc}`,
        rangeDesc,
        `Fix: ${fixDesc}`,
      ]
        .filter((l) => l !== "")
        .join("\n");

      await findingsEmitToolDef.run(
        {
          category: "security",
          severity,
          title: `npm audit: ${pkgName} (${vuln.severity ?? "unknown"})`,
          description,
          reproductionSteps: [
            "Run `npm audit` in the repo root",
            `Observe advisory for ${pkgName}`,
          ],
          evidenceUrls: [],
        },
        ctx,
      );
      findingsEmitted++;
    }

    return {
      vulnerabilityCount: entries.length,
      findingsEmitted,
      scanFile,
    };
  },
};
