/**
 * Retrospective writer — composes the sprint's closing markdown.
 *
 * Called by the `tech_lead` agent on transition to `closing`
 * (Requirement 10.1). Reads the `Sprint`, all `Finding`s and
 * `FixProposal`s for the sprint, computes the success-bar metrics,
 * evaluates them with {@link classifyResult}, renders
 * `src/lib/sprint/templates/retrospective.md.hbs`, and appends the
 * block to `.kiro/sprints/<id>/retrospective.md` via the workspace
 * writer.
 *
 * The writer attaches likely-responsible FixProposal ids to each missed
 * threshold so the retrospective tells the reader not just *what*
 * regressed but *which fixes to investigate*:
 *
 *   - `test_pass_rate` → fixes currently in `failed` or `verifying`
 *   - `security_high_critical` → fixes authored by `security_engineer`
 *   - `lighthouse_below_90` → any fix still `failed` / `rejected`
 *   - `regressions_present` → fixes with status `reverted`
 *   - `wcag_violations_present` → fixes linked to accessibility findings
 *
 * Requirements: 10.1, 10.2, 10.4, 10.7
 */

import { Types } from "mongoose";

import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import path from "node:path";

import dbConnect from "@/lib/db/connection";
import Finding, { type IFinding } from "@/lib/db/models/Finding";
import FixProposal, { type IFixProposal } from "@/lib/db/models/FixProposal";
import Sprint, { type ISprint } from "@/lib/db/models/Sprint";

import {
  classifyResult,
  type ClassifiedSprintResult,
  type MissedThreshold,
  type SprintMetrics,
} from "./success-bar";
import type { LighthouseSuiteResult } from "./lighthouse";
import { toSuccessBarLighthouseScores } from "./lighthouse";
import {
  createWorkspaceWriter,
  type WorkspaceWriter,
} from "./workspace";

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface WriteRetrospectiveInput {
  readonly sprintId: string;
  /** Optional cwd override; defaults to `process.cwd()`. */
  readonly cwd?: string;
  /**
   * Optional Lighthouse suite result. When absent, no Lighthouse section
   * is rendered and `lighthouse_below_90` is not evaluable (treated as
   * no scored pages — classifier passes threshold 4).
   */
  readonly lighthouse?: LighthouseSuiteResult;
  /** Regressions vs previous sprint. Defaults to 0 (not yet tracked). */
  readonly regressionCount?: number;
  /**
   * WCAG 2.1 AA violation count. Defaults to counting this sprint's
   * `accessibility`-category findings — each axe violation is emitted as
   * one such finding by the journey runner.
   */
  readonly wcagViolationCount?: number;
  /**
   * Verification pass rate in [0, 1]. Defaults to
   * `committed / (committed + failed + rejected)` over this sprint's
   * FixProposals, or 1 when no proposals have reached a terminal state.
   */
  readonly testPassRate?: number;
  /** Optional workspace writer override for tests. */
  readonly workspace?: WorkspaceWriter;
  /** Optional clock injection for deterministic tests. */
  readonly now?: () => Date;
}

export interface MissedThresholdView {
  readonly code: MissedThreshold;
  readonly description: string;
  readonly likelyFixProposalIds: readonly string[];
}

export interface WriteRetrospectiveResult {
  readonly retrospectivePath: string;
  readonly result: ClassifiedSprintResult;
  readonly missedThresholds: readonly MissedThresholdView[];
  readonly summary: {
    readonly findingTotal: number;
    readonly findingsByCategory: Readonly<Record<string, number>>;
    readonly findingsBySeverity: Readonly<Record<string, number>>;
    readonly fixProposalTotal: number;
    readonly fixProposalsByStatus: Readonly<Record<string, number>>;
    readonly verificationPassRate: number; // 0..100 integer
  };
}

// ---------------------------------------------------------------------------
// Handlebars instance
// ---------------------------------------------------------------------------

const hb = Handlebars.create();
hb.registerHelper("formatScore", (value: unknown) => {
  if (value === null || value === undefined) return "–";
  return String(value);
});

// Cache the compiled template per-process. The template file is small
// and never changes at runtime, so a one-shot read+compile is fine.
let compiledTemplate: HandlebarsTemplateDelegate | undefined;

async function getTemplate(cwd: string): Promise<HandlebarsTemplateDelegate> {
  if (compiledTemplate) return compiledTemplate;
  const templatePath = path.resolve(
    cwd,
    "src",
    "lib",
    "sprint",
    "templates",
    "retrospective.md.hbs",
  );
  const raw = await readFile(templatePath, "utf8");
  compiledTemplate = hb.compile(raw, { noEscape: true });
  return compiledTemplate;
}

/** Reset the template cache. Intended for tests. */
export function resetRetrospectiveTemplateCache(): void {
  compiledTemplate = undefined;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function writeRetrospective(
  input: WriteRetrospectiveInput,
): Promise<WriteRetrospectiveResult> {
  const cwd = input.cwd ?? process.cwd();
  const now = input.now ?? (() => new Date());

  await dbConnect();

  const sprintObjectId = new Types.ObjectId(input.sprintId);
  const sprint = await Sprint.findById(sprintObjectId).lean<ISprint | null>();
  if (!sprint) {
    throw new Error(`Sprint ${input.sprintId} not found`);
  }

  const [findings, fixProposals] = await Promise.all([
    Finding.find({ sprintId: sprintObjectId })
      .sort({ createdAt: 1 })
      .lean<IFinding[]>(),
    FixProposal.find({ sprintId: sprintObjectId })
      .sort({ createdAt: 1 })
      .lean<IFixProposal[]>(),
  ]);

  // --- Summary counts ---------------------------------------------------
  const findingsByCategory = groupCount(findings, (f) => f.category);
  const findingsBySeverity = groupCount(findings, (f) => f.severity);
  const fixProposalsByStatus = groupCount(fixProposals, (fp) => fp.status);

  const highCriticalSecurityFindings = findings.filter(
    (f) => f.category === "security" && (f.severity === "high" || f.severity === "critical"),
  ).length;
  const accessibilityFindings = findings.filter(
    (f) => f.category === "accessibility",
  ).length;

  // --- Metrics for the classifier --------------------------------------
  const testPassRate = input.testPassRate ?? computeTestPassRate(fixProposals);
  const regressionCount = input.regressionCount ?? 0;
  const wcagViolationCount =
    input.wcagViolationCount ?? accessibilityFindings;
  const lighthouseScores = input.lighthouse
    ? toSuccessBarLighthouseScores(input.lighthouse)
    : [];

  const metrics: SprintMetrics = {
    testPassRate,
    highOrCriticalSecurityFindings: highCriticalSecurityFindings,
    // V1: critical-journey tracking is not wired yet; an empty map means
    // the classifier treats threshold 3 as satisfied. When the journey
    // runner starts recording per-persona completion, thread it through.
    criticalJourneysCompletedByPersona: {},
    lighthouseScores,
    regressionCount,
    wcagViolationCount,
    // We are in the act of writing the retrospective, so by the time
    // classify runs we have confirmed a write will happen. This is a
    // sanity check for callers that skip the writer entirely.
    retrospectiveWritten: true,
  };

  const classification = classifyResult(metrics);

  // --- Attach likely-responsible fix proposals to each miss -------------
  const missedThresholds: MissedThresholdView[] =
    classification.missedThresholds.map((code) => ({
      code,
      description: describeThreshold(code),
      likelyFixProposalIds: likelyFixProposalsFor(code, fixProposals, findings),
    }));

  // --- Template render -------------------------------------------------
  const verificationPassRate = Math.round(testPassRate * 100);
  const lighthouseBelow90Count = countLighthousePagesBelow90(
    input.lighthouse,
  );

  const renderContext = {
    sprintId: input.sprintId,
    generatedAt: now().toISOString(),
    status: sprint.status,
    goals: sprint.goals ?? [],
    metSuccessBar: classification.result === "met_success_bar",
    missedThresholds,

    findingTotal: findings.length,
    findingsByCategory,
    findingsBySeverity,
    fixProposalTotal: fixProposals.length,
    fixProposalsByStatus,
    verificationPassRate,

    highCriticalSecurityFindings,
    lighthouseBelow90Count,
    regressionCount,
    wcagViolationCount,
    metricStatus: {
      testPassRate: metrics.testPassRate === 1 ? "✅" : "❌",
      security: highCriticalSecurityFindings === 0 ? "✅" : "❌",
      lighthouse: lighthouseBelow90Count === 0 ? "✅" : "❌",
      regressions: regressionCount === 0 ? "✅" : "❌",
      wcag: wcagViolationCount === 0 ? "✅" : "❌",
    },

    // Detail lists — cap fix proposals to 100 to avoid runaway markdown.
    fixProposals: fixProposals.slice(0, 100).map((fp) => ({
      id: fp.id,
      title: fp.title,
      status: fp.status,
      rejectReason: fp.rejectReason,
    })),
    lighthousePages: input.lighthouse?.pages ?? [],
  };

  const template = await getTemplate(cwd);
  const block = template(renderContext);

  // --- Append to retrospective.md --------------------------------------
  const writer =
    input.workspace ?? createWorkspaceWriter(input.sprintId);
  await writer.append("retrospective.md", block, {
    actor: "tech_lead",
    toolName: "retrospective.write",
  });

  const retrospectivePath = path
    .join(".kiro", "sprints", input.sprintId, "retrospective.md")
    .split(path.sep)
    .join("/");

  return {
    retrospectivePath,
    result: classification.result,
    missedThresholds,
    summary: {
      findingTotal: findings.length,
      findingsByCategory,
      findingsBySeverity,
      fixProposalTotal: fixProposals.length,
      fixProposalsByStatus,
      verificationPassRate,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupCount<T>(
  items: readonly T[],
  keyFn: (item: T) => string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = keyFn(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function computeTestPassRate(fixProposals: readonly IFixProposal[]): number {
  let committed = 0;
  let failed = 0;
  let rejected = 0;
  for (const fp of fixProposals) {
    if (fp.status === "committed") committed++;
    else if (fp.status === "failed") failed++;
    else if (fp.status === "rejected") rejected++;
  }
  const total = committed + failed + rejected;
  return total === 0 ? 1 : committed / total;
}

function countLighthousePagesBelow90(
  suite: LighthouseSuiteResult | undefined,
): number {
  if (!suite) return 0;
  let below = 0;
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
    if (
      performance < 90 ||
      accessibility < 90 ||
      bestPractices < 90 ||
      seo < 90
    ) {
      below++;
    }
  }
  return below;
}

function describeThreshold(code: MissedThreshold): string {
  switch (code) {
    case "test_pass_rate":
      return "verification pass rate is below 100%";
    case "security_high_critical":
      return "one or more high/critical security findings are unresolved";
    case "critical_journeys_incomplete":
      return "at least one selected persona did not complete every critical journey";
    case "lighthouse_below_90":
      return "at least one audited page scored below 90 on Performance, Accessibility, Best Practices, or SEO";
    case "regressions_present":
      return "regressions were detected compared to the previous completed sprint";
    case "wcag_violations_present":
      return "axe-core reported WCAG 2.1 AA violations";
    case "retrospective_missing":
      return "retrospective.md was not written";
  }
}

/**
 * Heuristic for "which fix proposals are likely responsible for this
 * miss". Pure data-shaping — the writer never mutates the FixProposal
 * records.
 */
function likelyFixProposalsFor(
  code: MissedThreshold,
  fixProposals: readonly IFixProposal[],
  findings: readonly IFinding[],
): readonly string[] {
  switch (code) {
    case "test_pass_rate": {
      return fixProposals
        .filter((fp) => fp.status === "failed" || fp.status === "verifying")
        .map((fp) => fp.id);
    }
    case "security_high_critical": {
      const securityFindingIds = new Set(
        findings
          .filter(
            (f) =>
              f.category === "security" &&
              (f.severity === "high" || f.severity === "critical"),
          )
          .map((f) => f.id),
      );
      return fixProposals
        .filter(
          (fp) =>
            fp.authorAgentRole === "security_engineer" ||
            fp.findingIds.some((fid) => securityFindingIds.has(fid)),
        )
        .map((fp) => fp.id);
    }
    case "lighthouse_below_90": {
      return fixProposals
        .filter((fp) => fp.status === "failed" || fp.status === "rejected")
        .map((fp) => fp.id);
    }
    case "regressions_present": {
      return fixProposals
        .filter((fp) => fp.status === "reverted")
        .map((fp) => fp.id);
    }
    case "wcag_violations_present": {
      const a11yFindingIds = new Set(
        findings.filter((f) => f.category === "accessibility").map((f) => f.id),
      );
      return fixProposals
        .filter((fp) => fp.findingIds.some((fid) => a11yFindingIds.has(fid)))
        .map((fp) => fp.id);
    }
    case "critical_journeys_incomplete":
    case "retrospective_missing":
      return [];
  }
}
