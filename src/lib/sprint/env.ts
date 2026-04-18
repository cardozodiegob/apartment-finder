/**
 * Environment loader for the Virtual Team Sprint Runner.
 *
 * Reads `.env.sprint` from the repo root (if present), validates the keys
 * required by the sprint runner with Zod, and returns a frozen `SprintEnv`
 * config object. Throws `SprintEnvError` (wrapping a `SprintError` of code
 * `ENV_MISSING`) on the first missing required key.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.6, 12.4, 12.5
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

import type { LlmProvider, SprintError } from "./types";
import { LLM_PROVIDERS } from "./types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The frozen, validated config returned by {@link loadSprintEnv}.
 *
 * Only the keys the sprint runner actually consumes are surfaced here;
 * provider credentials are loaded into `process.env` and read by the
 * provider SDKs directly.
 */
export interface SprintEnv {
  readonly SPRINT_LLM_PROVIDER: LlmProvider;
  readonly SPRINT_LLM_MODEL: string;
  readonly SPRINT_TEST_PORT: number;
  readonly SPRINT_TEST_BASE_URL: string;
  readonly SPRINT_TOKEN_BUDGET: number;
  readonly SPRINT_VERBOSE_LOGS: boolean;
  readonly MONGODB_URI: string;
}

/**
 * Error thrown by {@link loadSprintEnv} when a required key is missing or
 * fails validation. Carries the structured {@link SprintError} payload
 * (code `ENV_MISSING`) so callers can inspect it programmatically.
 */
export class SprintEnvError extends Error {
  public readonly sprintError: Extract<SprintError, { code: "ENV_MISSING" }>;

  constructor(key: string, message?: string) {
    super(
      message ?? `Sprint env key "${key}" is missing or invalid (see .env.sprint.example)`,
    );
    this.name = "SprintEnvError";
    this.sprintError = { code: "ENV_MISSING", key };
  }
}

// ---------------------------------------------------------------------------
// Zod schema — the single source of truth for what a valid .env.sprint
// file must contain. Keys are listed in the order they appear in
// .env.sprint.example so the first-missing-key error is predictable.
// ---------------------------------------------------------------------------

const REQUIRED_KEYS = [
  "SPRINT_LLM_PROVIDER",
  "SPRINT_LLM_MODEL",
  "SPRINT_TEST_PORT",
  "SPRINT_TEST_BASE_URL",
  "SPRINT_TOKEN_BUDGET",
  "MONGODB_URI",
] as const;

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((v, ctx) => {
    if (typeof v === "boolean") return v;
    const normalized = v.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0" || normalized === "") {
      return false;
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `expected "true" or "false", got "${v}"`,
    });
    return z.NEVER;
  });

const sprintEnvSchema = z.object({
  SPRINT_LLM_PROVIDER: z.enum(LLM_PROVIDERS),
  SPRINT_LLM_MODEL: z.string().trim().min(1, "must be a non-empty string"),
  SPRINT_TEST_PORT: z.coerce
    .number()
    .int("must be an integer")
    .min(1, "must be >= 1")
    .max(65535, "must be <= 65535"),
  SPRINT_TEST_BASE_URL: z.string().url("must be a valid URL"),
  SPRINT_TOKEN_BUDGET: z.coerce
    .number()
    .int("must be an integer")
    .positive("must be a positive integer"),
  SPRINT_VERBOSE_LOGS: booleanFromString.default(false),
  MONGODB_URI: z.string().trim().min(1, "must be a non-empty string"),
});

// Per-provider credential requirements. Only the block matching the
// selected SPRINT_LLM_PROVIDER is enforced.
const providerCredentialRequirements: Record<LlmProvider, readonly string[]> = {
  bedrock: ["AWS_REGION"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
};

// ---------------------------------------------------------------------------
// Cache — loadSprintEnv is memoized per process. Tests can reset via
// resetSprintEnv().
// ---------------------------------------------------------------------------

let cached: SprintEnv | undefined;

/** Clear the memoized config. Intended for tests. */
export function resetSprintEnv(): void {
  cached = undefined;
}

// ---------------------------------------------------------------------------
// Minimal .env parser. We intentionally don't pull in `dotenv` — the format
// we need to support is simple (KEY=VALUE, optional quotes, `#` comments,
// blank lines) and we want to keep the sprint runner dependency-light.
// ---------------------------------------------------------------------------

function parseDotEnv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (key === "" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    // Strip a trailing `# comment` only when the value is unquoted.
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
    }
    // Strip matched surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadDotEnvIntoProcess(path: string): void {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    // Missing file is fine — required keys may already live in process.env
    // (e.g. CI). loadSprintEnv's validation step will surface any gaps.
    return;
  }
  const parsed = parseDotEnv(raw);
  for (const [key, value] of Object.entries(parsed)) {
    // Do not clobber existing process.env values (`override: false`).
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// loadSprintEnv — the public entry point.
// ---------------------------------------------------------------------------

/**
 * Load, validate, and freeze the sprint runner's environment config.
 *
 * Reads `.env.sprint` from the repo root (without clobbering existing
 * `process.env` keys), validates the result against the schema, and caches
 * the frozen config for subsequent calls.
 *
 * @throws {SprintEnvError} when a required key is missing or fails
 *   validation; `err.sprintError.key` is the first offending key.
 */
export function loadSprintEnv(): SprintEnv {
  if (cached !== undefined) return cached;

  loadDotEnvIntoProcess(resolve(process.cwd(), ".env.sprint"));

  // Check required keys in declaration order so the reported missing key
  // is deterministic (matches ENV_MISSING contract from types.ts).
  for (const key of REQUIRED_KEYS) {
    const v = process.env[key];
    if (v === undefined || v.trim() === "") {
      throw new SprintEnvError(key, `Sprint env key "${key}" is required but missing`);
    }
  }

  const parsed = sprintEnvSchema.safeParse({
    SPRINT_LLM_PROVIDER: process.env.SPRINT_LLM_PROVIDER,
    SPRINT_LLM_MODEL: process.env.SPRINT_LLM_MODEL,
    SPRINT_TEST_PORT: process.env.SPRINT_TEST_PORT,
    SPRINT_TEST_BASE_URL: process.env.SPRINT_TEST_BASE_URL,
    SPRINT_TOKEN_BUDGET: process.env.SPRINT_TOKEN_BUDGET,
    SPRINT_VERBOSE_LOGS: process.env.SPRINT_VERBOSE_LOGS,
    MONGODB_URI: process.env.MONGODB_URI,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const key = (first?.path[0] as string | undefined) ?? "unknown";
    throw new SprintEnvError(
      key,
      `Sprint env key "${key}" is invalid: ${first?.message ?? "validation failed"}`,
    );
  }

  const config = parsed.data;

  // Requirement 12.4 — the sprint runner must never reuse production
  // credentials. Crude safety check: warn (don't throw) if the URI looks
  // production-ish. The coordinator will still refuse to run if the user
  // insists, via a separate runtime check.
  if (/\b(prod|production)\b/i.test(config.MONGODB_URI)) {
    // eslint-disable-next-line no-console
    console.warn(
      "[sprint-env] MONGODB_URI appears to reference a production database " +
        "(contains 'prod'/'production'). The sprint runner must use a " +
        "dedicated test database — see Requirement 12.4.",
    );
  }

  // Provider-specific credential presence check.
  for (const credKey of providerCredentialRequirements[config.SPRINT_LLM_PROVIDER]) {
    const v = process.env[credKey];
    if (v === undefined || v.trim() === "") {
      throw new SprintEnvError(
        credKey,
        `Sprint env key "${credKey}" is required when SPRINT_LLM_PROVIDER="${config.SPRINT_LLM_PROVIDER}"`,
      );
    }
  }

  cached = Object.freeze({
    SPRINT_LLM_PROVIDER: config.SPRINT_LLM_PROVIDER,
    SPRINT_LLM_MODEL: config.SPRINT_LLM_MODEL,
    SPRINT_TEST_PORT: config.SPRINT_TEST_PORT,
    SPRINT_TEST_BASE_URL: config.SPRINT_TEST_BASE_URL,
    SPRINT_TOKEN_BUDGET: config.SPRINT_TOKEN_BUDGET,
    SPRINT_VERBOSE_LOGS: config.SPRINT_VERBOSE_LOGS,
    MONGODB_URI: config.MONGODB_URI,
  });

  return cached;
}
