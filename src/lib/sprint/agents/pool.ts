/**
 * Agent_Pool.
 *
 * At sprint start this module:
 *   1. Validates the requested role list (must include `tech_lead`,
 *      must contain no duplicates, every entry must be a known role).
 *   2. Loads `src/lib/sprint/prompts/<role>.md` and
 *      `src/lib/sprint/tools/<role>.json` from disk.
 *   3. Freezes each role's allow-list so a mid-sprint edit to the
 *      manifest on disk cannot expand a running agent's powers
 *      (Requirement 2.7).
 *   4. Spins up one `Agent` per role, all sharing a single `LlmClient`.
 *
 * The returned {@link AgentPool} is the frozen object the Sprint_Runner
 * consumes: `agents` for the scheduler, `allowedToolsByRole` for the
 * Tool_Executor, and `agentInstances` to persist onto the Sprint record.
 *
 * Requirements: 2.3, 2.4, 2.5, 2.6, 2.7
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  AGENT_ROLES,
  type AgentInstance,
  type AgentRole,
  type LlmProvider,
} from "@/lib/sprint/types";
import {
  createLlmClient,
  type LlmClient,
} from "@/lib/sprint/llm/client";

import { createAgent, type Agent } from "./agent";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CreateAgentPoolOptions {
  readonly sprintId: string;
  /** Roles requested for this sprint. Must include `tech_lead`. */
  readonly roles: readonly AgentRole[];
  readonly provider: LlmProvider;
  readonly model: string;
  /** Optional LLM override for tests. */
  readonly llm?: LlmClient;
  /**
   * Optional override for the prompts directory. Defaults to
   * `<cwd>/src/lib/sprint/prompts`.
   */
  readonly promptsDir?: string;
  /**
   * Optional override for the tool-manifests directory. Defaults to
   * `<cwd>/src/lib/sprint/tools`.
   */
  readonly toolsDir?: string;
}

export interface AgentPool {
  readonly agents: ReadonlyMap<AgentRole, Agent>;
  readonly allowedToolsByRole: Readonly<
    Partial<Record<AgentRole, readonly string[]>>
  >;
  readonly agentInstances: readonly AgentInstance[];
}

export class AgentPoolValidationError extends Error {
  public readonly code:
    | "MISSING_TECH_LEAD"
    | "DUPLICATE_ROLE"
    | "UNKNOWN_ROLE"
    | "EMPTY_ROLES";

  constructor(
    code:
      | "MISSING_TECH_LEAD"
      | "DUPLICATE_ROLE"
      | "UNKNOWN_ROLE"
      | "EMPTY_ROLES",
    message: string,
  ) {
    super(message);
    this.name = "AgentPoolValidationError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Manifest schema
// ---------------------------------------------------------------------------

const manifestSchema = z.object({
  role: z.enum(AGENT_ROLES),
  allowedTools: z.array(z.string().trim().min(1)).min(1),
});

type Manifest = z.infer<typeof manifestSchema>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRoles(roles: readonly AgentRole[]): void {
  if (roles.length === 0) {
    throw new AgentPoolValidationError(
      "EMPTY_ROLES",
      "At least one role is required; tech_lead must be present.",
    );
  }

  const seen = new Set<AgentRole>();
  const known = new Set<AgentRole>(AGENT_ROLES);
  for (const r of roles) {
    if (!known.has(r)) {
      throw new AgentPoolValidationError(
        "UNKNOWN_ROLE",
        `Unknown agent role: "${r}"`,
      );
    }
    if (seen.has(r)) {
      throw new AgentPoolValidationError(
        "DUPLICATE_ROLE",
        `Duplicate role in sprint roster: "${r}"`,
      );
    }
    seen.add(r);
  }

  if (!seen.has("tech_lead")) {
    throw new AgentPoolValidationError(
      "MISSING_TECH_LEAD",
      "Sprint must include the `tech_lead` role.",
    );
  }
}

// ---------------------------------------------------------------------------
// Disk loaders
// ---------------------------------------------------------------------------

async function loadRolePrompt(
  role: AgentRole,
  promptsDir: string,
): Promise<string> {
  const filePath = path.join(promptsDir, `${role}.md`);
  return readFile(filePath, "utf8");
}

async function loadRoleManifest(
  role: AgentRole,
  toolsDir: string,
): Promise<Manifest> {
  const filePath = path.join(toolsDir, `${role}.json`);
  const raw = await readFile(filePath, "utf8");
  const parsed = manifestSchema.parse(JSON.parse(raw));
  if (parsed.role !== role) {
    throw new Error(
      `Manifest ${filePath} has role "${parsed.role}" but was loaded for "${role}"`,
    );
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build the Agent_Pool for a sprint. Fails fast on roster validation
 * and on any missing prompt or manifest file — those errors are surfaced
 * at sprint START so partial startup state is impossible.
 */
export async function createAgentPool(
  options: CreateAgentPoolOptions,
): Promise<AgentPool> {
  validateRoles(options.roles);

  const promptsDir =
    options.promptsDir ??
    path.join(process.cwd(), "src", "lib", "sprint", "prompts");
  const toolsDir =
    options.toolsDir ??
    path.join(process.cwd(), "src", "lib", "sprint", "tools");

  // Load every prompt + manifest in parallel. Failures throw fast.
  const loaded = await Promise.all(
    options.roles.map(async (role) => {
      const [prompt, manifest] = await Promise.all([
        loadRolePrompt(role, promptsDir),
        loadRoleManifest(role, toolsDir),
      ]);
      return { role, prompt, manifest };
    }),
  );

  // One LlmClient is shared — token-budget enforcement happens inside
  // the client's UsageTracker and is therefore consistent across agents.
  const llm =
    options.llm ??
    createLlmClient({
      // The default createLlmClient reads provider/model from env; we
      // don't override here because env has already been validated.
    });

  const agents = new Map<AgentRole, Agent>();
  const allowedToolsByRole: Partial<Record<AgentRole, readonly string[]>> = {};
  const agentInstances: AgentInstance[] = [];

  for (const { role, prompt, manifest } of loaded) {
    const frozenAllowed = Object.freeze([...manifest.allowedTools]);
    allowedToolsByRole[role] = frozenAllowed;

    agents.set(
      role,
      createAgent({
        role,
        sprintId: options.sprintId,
        rolePrompt: prompt,
        llm,
      }),
    );

    agentInstances.push({
      role,
      provider: options.provider,
      model: options.model,
      // Mongo stores a mutable array — give the schema a fresh copy
      // (the frozen one above is the executor's source of truth).
      allowedTools: [...manifest.allowedTools],
      tokensUsed: 0,
    });
  }

  return Object.freeze({
    agents,
    allowedToolsByRole: Object.freeze(allowedToolsByRole),
    agentInstances: Object.freeze([...agentInstances]),
  });
}
