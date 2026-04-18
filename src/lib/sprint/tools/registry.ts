/**
 * Frozen registry of every tool implementation known to the sprint runner.
 *
 * The Tool_Executor consults this map — it is the single source of truth
 * for "what tools exist" in this process. New tools must be registered
 * here; forgetting to register is the reason an agent would see an
 * `UNKNOWN_TOOL` rejection even when the role manifest allow-lists a
 * tool name.
 *
 * Requirements: 13.1, 13.2
 */

import type { ToolDefinition } from "./executor";

import { a11yRunAxeToolDef } from "./impl/a11y-run-axe";
import { findingsEmitToolDef } from "./impl/findings-emit";
import { fixCommitToolDef } from "./impl/fix-commit";
import { fixProposeToolDef } from "./impl/fix-propose";
import { fixVerifyToolDef } from "./impl/fix-verify";
import { journeyRunToolDef } from "./impl/journey-run";
import { lighthouseRunToolDef } from "./impl/lighthouse-run";
import { llmThinkToolDef } from "./impl/llm-think";
import { securityAuditDepsToolDef } from "./impl/security-audit-deps";
import { securityReviewDiffToolDef } from "./impl/security-review-diff";
import { securityScanSastToolDef } from "./impl/security-scan-sast";
import { securityScanSecretsToolDef } from "./impl/security-scan-secrets";
import { workspaceAppendToolDef } from "./impl/workspace-append";
import { workspaceCreateTicketToolDef } from "./impl/workspace-create-ticket";
import { workspaceReadToolDef } from "./impl/workspace-read";

export const TOOL_REGISTRY: Readonly<Record<string, ToolDefinition>> =
  Object.freeze({
    [workspaceReadToolDef.name]: workspaceReadToolDef,
    [workspaceAppendToolDef.name]: workspaceAppendToolDef,
    [workspaceCreateTicketToolDef.name]: workspaceCreateTicketToolDef,
    [findingsEmitToolDef.name]: findingsEmitToolDef,
    [fixProposeToolDef.name]: fixProposeToolDef,
    [fixVerifyToolDef.name]: fixVerifyToolDef,
    [fixCommitToolDef.name]: fixCommitToolDef,
    [journeyRunToolDef.name]: journeyRunToolDef,
    [a11yRunAxeToolDef.name]: a11yRunAxeToolDef,
    [lighthouseRunToolDef.name]: lighthouseRunToolDef,
    [securityScanSastToolDef.name]: securityScanSastToolDef,
    [securityScanSecretsToolDef.name]: securityScanSecretsToolDef,
    [securityAuditDepsToolDef.name]: securityAuditDepsToolDef,
    [securityReviewDiffToolDef.name]: securityReviewDiffToolDef,
    [llmThinkToolDef.name]: llmThinkToolDef,
  });

/** Return the canonical registry shape consumed by `createToolExecutor`. */
export function getToolRegistry(): Readonly<Record<string, ToolDefinition>> {
  return TOOL_REGISTRY;
}
