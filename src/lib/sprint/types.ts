/**
 * Shared domain types for the Virtual Team Sprint Runner.
 *
 * Each enum is exported BOTH as a const readonly tuple (for reuse by Zod
 * schemas and fast-check generators) AND as a string-union type derived
 * from the tuple.
 *
 * These types are imported by the sprint runner core, Mongoose models,
 * API routes, property-based tests, and the admin UI, so they are the
 * single source of truth for domain vocabulary.
 */

// ---------------------------------------------------------------------------
// AgentRole — the 10 simulated team members in a sprint.
// ---------------------------------------------------------------------------

export const AGENT_ROLES = [
  "tech_lead",
  "senior_dev",
  "frontend_dev",
  "backend_dev",
  "qa_engineer",
  "security_engineer",
  "ux_designer",
  "product_manager",
  "devops_engineer",
  "accessibility_specialist",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

// ---------------------------------------------------------------------------
// CustomerPersona — the 10 simulated end-users driven through the app.
// ---------------------------------------------------------------------------

export const CUSTOMER_PERSONAS = [
  "student_sharer",
  "relocating_professional",
  "family_long_term",
  "remote_worker",
  "landlord_poster",
  "non_english_speaker",
  "mobile_slow_network",
  "screen_reader_user",
  "adversarial_probe",
  "elderly_user",
] as const;

export type CustomerPersona = (typeof CUSTOMER_PERSONAS)[number];

// ---------------------------------------------------------------------------
// SprintStatus — lifecycle states of a sprint.
// ---------------------------------------------------------------------------

export const SPRINT_STATUSES = [
  "pending",
  "running",
  "closing",
  "completed",
  "aborted",
] as const;

export type SprintStatus = (typeof SPRINT_STATUSES)[number];

// ---------------------------------------------------------------------------
// SprintResult — outcome of a completed sprint relative to the success bar.
// `undefined` is a valid value while the sprint is in-flight; the exported
// tuple only enumerates the defined results.
// ---------------------------------------------------------------------------

export const SPRINT_RESULTS = [
  "met_success_bar",
  "below_success_bar",
] as const;

export type SprintResult = (typeof SPRINT_RESULTS)[number] | undefined;

// ---------------------------------------------------------------------------
// FindingCategory — taxonomy for issues surfaced during a sprint.
// ---------------------------------------------------------------------------

export const FINDING_CATEGORIES = [
  "ux",
  "security",
  "performance",
  "accessibility",
  "bug",
  "i18n",
  "seo",
] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// FindingSeverity — severity ladder for findings.
// ---------------------------------------------------------------------------

export const FINDING_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

// ---------------------------------------------------------------------------
// FixStatus — lifecycle of a proposed fix.
// ---------------------------------------------------------------------------

export const FIX_STATUSES = [
  "draft",
  "verifying",
  "passed",
  "failed",
  "committed",
  "rejected",
  "promoted_to_spec",
  "reverted",
] as const;

export type FixStatus = (typeof FIX_STATUSES)[number];

// ---------------------------------------------------------------------------
// JourneyMode — how a persona journey step is executed.
// ---------------------------------------------------------------------------

export const JOURNEY_MODES = ["api", "browser"] as const;

export type JourneyMode = (typeof JOURNEY_MODES)[number];

// ---------------------------------------------------------------------------
// LLM provider identifiers — used by AgentInstance.provider and env config.
// ---------------------------------------------------------------------------

export const LLM_PROVIDERS = ["bedrock", "openai", "anthropic"] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];

// ---------------------------------------------------------------------------
// FileChange — a single file mutation proposed by a FixProposal.
// Mirrors the shape in the design's Data Models section.
// ---------------------------------------------------------------------------

export const FILE_CHANGE_OPERATIONS = [
  "create",
  "modify",
  "delete",
] as const;

export type FileChangeOperation = (typeof FILE_CHANGE_OPERATIONS)[number];

export interface FileChange {
  /** Repo-relative path (e.g. `src/lib/foo.ts`). */
  path: string;
  operation: FileChangeOperation;
  addedLines: number;
  removedLines: number;
  /** Unified diff body. */
  diff: string;
}

// ---------------------------------------------------------------------------
// ToolCall / ToolResult — the contract between Agents and the Tool_Executor.
// ---------------------------------------------------------------------------

export interface ToolCall {
  kind: "tool_call";
  /** Dotted tool name, e.g. `workspace.append`. */
  tool: string;
  /** Validated by the tool's Zod schema inside Tool_Executor. */
  parameters: unknown;
}

export const TOOL_RESULT_ERROR_CODES = [
  "UNKNOWN_TOOL",
  "NOT_ALLOWED",
  "INVALID_PARAMS",
  "EXECUTION_ERROR",
] as const;

export type ToolResultErrorCode = (typeof TOOL_RESULT_ERROR_CODES)[number];

export interface ToolResult {
  ok: boolean;
  output?: unknown;
  errorCode?: ToolResultErrorCode;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// VerificationStep / VerificationReport — output of the Verification_Gate.
// ---------------------------------------------------------------------------

export const VERIFICATION_STEP_NAMES = [
  "vitest",
  "next-lint",
  "tsc",
  "playwright",
] as const;

export type VerificationStepName = (typeof VERIFICATION_STEP_NAMES)[number];

export const VERIFICATION_STEP_STATUSES = [
  "pass",
  "fail",
  "skipped",
  "timeout",
] as const;

export type VerificationStepStatus =
  (typeof VERIFICATION_STEP_STATUSES)[number];

export interface VerificationStep {
  name: VerificationStepName;
  status: VerificationStepStatus;
  durationMs: number;
  /** Captured stdout+stderr, truncated. */
  output: string;
}

export const VERIFICATION_OVERALL_STATUSES = ["passed", "failed"] as const;

export type VerificationOverallStatus =
  (typeof VERIFICATION_OVERALL_STATUSES)[number];

export interface VerificationReport {
  fixProposalId: string;
  overall: VerificationOverallStatus;
  steps: VerificationStep[];
  startedAt: Date;
  completedAt: Date;
}

// ---------------------------------------------------------------------------
// AgentInstance — the embedded shape stored on each Sprint record.
// Frozen at sprint start; per Requirement 2.7 it records role, provider,
// model, allowed tools, and token usage for each instantiated agent.
// ---------------------------------------------------------------------------

export interface AgentInstance {
  role: AgentRole;
  provider: LlmProvider;
  /** Model identifier, e.g. `anthropic.claude-3-5-sonnet-20241022-v2:0`. */
  model: string;
  /** Frozen copy of the role's tool manifest at sprint start. */
  allowedTools: string[];
  tokensUsed: number;
}

// ---------------------------------------------------------------------------
// SprintError — discriminated union for all internal sprint runner errors.
// HTTP surfacing is handled by the existing `ApiErrorResponse` layer; this
// union is the internal error vocabulary consumed by the coordinator, the
// tool executor, the git wrapper, and the verification gate.
// ---------------------------------------------------------------------------

export type SprintError =
  | { code: "VALIDATION"; message: string; field?: string }
  | { code: "ILLEGAL_TRANSITION"; from: SprintStatus; event: string }
  | { code: "CONCURRENT_SPRINT"; runningSprintId: string }
  | { code: "TOOL_NOT_ALLOWED"; role: AgentRole; tool: string }
  | { code: "TOOL_PARAMS_INVALID"; tool: string; issues: unknown }
  | {
      code: "LLM_ERROR";
      provider: LlmProvider;
      retryable: boolean;
      cause: string;
    }
  | { code: "LLM_TIMEOUT"; provider: LlmProvider }
  | { code: "TOKEN_BUDGET_EXHAUSTED"; sprintId: string }
  | { code: "VERIFICATION_TIMEOUT"; step: string }
  | { code: "GIT_SAFETY_VIOLATION"; attempted: string }
  | { code: "WORKSPACE_LOCKED"; path: string }
  | { code: "TEST_INSTANCE_UNREACHABLE"; port: number }
  | { code: "ENV_MISSING"; key: string };

/** Every possible `SprintError["code"]` value, for reuse by schemas/tests. */
export const SPRINT_ERROR_CODES = [
  "VALIDATION",
  "ILLEGAL_TRANSITION",
  "CONCURRENT_SPRINT",
  "TOOL_NOT_ALLOWED",
  "TOOL_PARAMS_INVALID",
  "LLM_ERROR",
  "LLM_TIMEOUT",
  "TOKEN_BUDGET_EXHAUSTED",
  "VERIFICATION_TIMEOUT",
  "GIT_SAFETY_VIOLATION",
  "WORKSPACE_LOCKED",
  "TEST_INSTANCE_UNREACHABLE",
  "ENV_MISSING",
] as const;

export type SprintErrorCode = (typeof SPRINT_ERROR_CODES)[number];
