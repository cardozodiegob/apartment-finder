/**
 * `findings.emit` tool implementation.
 *
 * Pipeline for every emit:
 *   1. Resolve the reporter. The executor's `agentRole` supplies a
 *      default `reporterAgentRole` when the caller provides neither
 *      `reporterAgentRole` nor `reporterPersona`.
 *   2. Compute the dedup signature (category + title + repro steps).
 *   3. If a matching record exists in the same sprint, atomically bump
 *      its `duplicateCount` (the `{sprintId, dedupSignature}` unique
 *      index enforces this at the DB layer too).
 *   4. Otherwise allocate the next per-sprint sequence number, generate
 *      the human-facing id (`F-<sprint_short>-<n>`), persist the record,
 *      and append a rendered markdown block to `findings.md`.
 *   5. Apply notification rules:
 *        - `security` + (`high`|`critical`) → tag tech_lead +
 *          security_engineer in `log.md`.
 *        - `critical` severity → set `sprint.hasCriticalFinding = true`.
 *
 * The schema keeps `reporterAgentRole` and `reporterPersona` both
 * optional (unlike `findingInputSchema`, which demands exactly one);
 * the tool injects `ctx.agentRole` as the default so agents never have
 * to re-state their own identity. The mutual-exclusion rule (both set
 * simultaneously is an error) is still enforced here.
 *
 * Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7
 */

import { Types } from "mongoose";
import { z } from "zod";

import dbConnect from "@/lib/db/connection";
import Finding, { type IFinding } from "@/lib/db/models/Finding";
import Sprint from "@/lib/db/models/Sprint";
import {
  computeDedupSignature,
  generateFindingId,
} from "@/lib/sprint/findings/dedup";
import {
  AGENT_ROLES,
  CUSTOMER_PERSONAS,
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
  type AgentRole,
  type CustomerPersona,
  type FindingCategory,
  type FindingSeverity,
} from "@/lib/sprint/types";
import { createWorkspaceWriter } from "@/lib/sprint/workspace";

import type { ToolDefinition } from "../executor";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const paramsSchema = z
  .object({
    category: z.enum(FINDING_CATEGORIES),
    severity: z.enum(FINDING_SEVERITIES),
    title: z.string().trim().min(1, "title must be a non-empty string"),
    description: z
      .string()
      .trim()
      .min(1, "description must be a non-empty string"),
    reproductionSteps: z
      .array(z.string().trim().min(1, "reproduction step must be non-empty"))
      .min(1, "reproductionSteps must contain at least one step"),
    evidenceUrls: z
      .array(z.string().url("evidence must be a URL"))
      .default([]),
    reporterAgentRole: z.enum(AGENT_ROLES).optional(),
    reporterPersona: z.enum(CUSTOMER_PERSONAS).optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.reporterAgentRole !== undefined &&
      val.reporterPersona !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "finding must not set both reporterAgentRole and reporterPersona",
        path: ["reporterPersona"],
      });
    }
  });

export type FindingsEmitParams = z.infer<typeof paramsSchema>;

export interface FindingsEmitOutput {
  /** Human-facing finding id (`F-<sprint_short>-<n>`). */
  id: string;
  /** True when the incoming finding collapsed onto an existing record. */
  deduplicated: boolean;
  /** Post-operation `duplicateCount` on the persisted record. */
  duplicateCount: number;
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

interface RenderFindingInput {
  id: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  reporterAgentRole?: AgentRole;
  reporterPersona?: CustomerPersona;
  description: string;
  reproductionSteps: readonly string[];
  evidenceUrls: readonly string[];
  createdAt: Date;
}

function renderFindingMarkdown(f: RenderFindingInput): string {
  const reporter =
    f.reporterAgentRole ?? f.reporterPersona ?? "unknown";
  const lines: string[] = [
    "\n---\n",
    `### ${f.id} — ${f.title}\n\n`,
    `- Category: ${f.category}\n`,
    `- Severity: ${f.severity}\n`,
    `- Reporter: ${reporter}\n`,
    `- Created: ${f.createdAt.toISOString()}\n\n`,
    `**Description:** ${f.description}\n\n`,
    `**Reproduction steps:**\n\n`,
  ];
  for (let i = 0; i < f.reproductionSteps.length; i++) {
    lines.push(`${i + 1}. ${f.reproductionSteps[i]}\n`);
  }
  if (f.evidenceUrls.length > 0) {
    const links = f.evidenceUrls.map((u) => `[${u}](${u})`).join(", ");
    lines.push(`\n**Evidence:** ${links}\n`);
  }
  lines.push("\n");
  return lines.join("");
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const findingsEmitToolDef: ToolDefinition<
  FindingsEmitParams,
  FindingsEmitOutput
> = {
  name: "findings.emit",
  schema: paramsSchema,
  async run(params, ctx): Promise<FindingsEmitOutput> {
    await dbConnect();

    // Default the reporter to the calling agent when neither identity is
    // provided. If the caller supplied a persona, leave agent role unset.
    const reporterAgentRole: AgentRole | undefined =
      params.reporterAgentRole ??
      (params.reporterPersona === undefined ? ctx.agentRole : undefined);
    const reporterPersona: CustomerPersona | undefined = params.reporterPersona;

    const sprintObjectId = new Types.ObjectId(ctx.sprintId);
    const dedupSignature = computeDedupSignature({
      category: params.category,
      title: params.title,
      reproductionSteps: params.reproductionSteps,
    });

    // Dedup fast-path: bump counter and return without appending to findings.md.
    const existing = await Finding.findOne({
      sprintId: sprintObjectId,
      dedupSignature,
    });
    if (existing) {
      existing.duplicateCount = (existing.duplicateCount ?? 0) + 1;
      await existing.save();
      return {
        id: existing.id,
        deduplicated: true,
        duplicateCount: existing.duplicateCount,
      };
    }

    // New finding — allocate next sequence number (1-based, per sprint).
    const priorCount = await Finding.countDocuments({
      sprintId: sprintObjectId,
    });
    const id = generateFindingId(ctx.sprintId, priorCount + 1);
    const createdAt = new Date();

    const doc = await Finding.create({
      id,
      sprintId: sprintObjectId,
      reporterAgentRole,
      reporterPersona,
      category: params.category,
      severity: params.severity,
      title: params.title,
      description: params.description,
      reproductionSteps: params.reproductionSteps,
      evidenceUrls: params.evidenceUrls,
      dedupSignature,
      duplicateCount: 0,
      createdAt,
    });

    // Append rendered block to findings.md. The writer auto-emits a log entry.
    const writer = createWorkspaceWriter(ctx.sprintId);
    const block = renderFindingMarkdown({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      severity: doc.severity,
      reporterAgentRole: doc.reporterAgentRole,
      reporterPersona: doc.reporterPersona,
      description: doc.description,
      reproductionSteps: doc.reproductionSteps,
      evidenceUrls: doc.evidenceUrls,
      createdAt: doc.createdAt,
    });
    await writer.append("findings.md", block, {
      actor: reporterAgentRole ?? reporterPersona ?? "unknown",
      toolName: "findings.emit",
    });

    // Notification: security + (high|critical) → tag tech_lead + sec-eng.
    if (
      params.category === "security" &&
      (params.severity === "high" || params.severity === "critical")
    ) {
      const notify =
        `[${createdAt.toISOString()}] @tech_lead @security_engineer: ` +
        `Security ${params.severity} finding ${id} — ${params.title}\n`;
      await writer.append("log.md", notify, {
        actor: "sprint_runner",
        toolName: "findings.emit",
      });
    }

    // Critical severity → flip the sprint-level critical flag.
    if (params.severity === "critical") {
      await Sprint.updateOne(
        { _id: sprintObjectId },
        { $set: { hasCriticalFinding: true } },
      );
    }

    return { id, deduplicated: false, duplicateCount: 0 };
  },
};

// Re-export for test convenience — the renderer has no I/O and is
// useful to snapshot-test independently of Mongo.
export { renderFindingMarkdown };
export type { RenderFindingInput };

// Explicit `IFinding` re-export keeps the type visible to callers that
// want to pass existing documents through the renderer later.
export type { IFinding };
