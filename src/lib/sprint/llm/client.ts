/**
 * Provider-agnostic LLM client for the Virtual Team Sprint Runner.
 *
 * Supports `bedrock` / `openai` / `anthropic`, selected by
 * `SPRINT_LLM_PROVIDER`. Enforces a 120s per-request timeout,
 * 1/4/16s exponential-backoff retry (max 3 attempts), and a per-sprint
 * token budget from `SPRINT_TOKEN_BUDGET`. Credentials are read from
 * provider-specific env vars and never appear in thrown errors or logs.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import type { LlmProvider, SprintError } from "../types";
import { loadSprintEnv } from "../env";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LlmRequest {
  /** System prompt (role prompt, loaded from src/lib/sprint/prompts/<role>.md). */
  readonly systemPrompt: string;
  /** User-style prompt (context + task for this step). */
  readonly userPrompt: string;
  /** Max tokens to generate; provider-specific ceiling. */
  readonly maxTokens?: number;
  /** Optional per-request override of the provider timeout (ms). Defaults to 120_000. */
  readonly timeoutMs?: number;
}

export interface LlmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface LlmResponse {
  /** Raw text content from the model (not yet parsed as a tool call). */
  readonly text: string;
  readonly usage: LlmUsage;
  readonly model: string;
  readonly provider: LlmProvider;
}

export interface LlmClient {
  readonly provider: LlmProvider;
  readonly model: string;
  generate(req: LlmRequest): Promise<LlmResponse>;
}

export interface WorkspaceLogWriter {
  append(
    doc: string,
    block: string,
    opts: { actor: string; toolName: string },
  ): Promise<unknown>;
}

export interface CreateLlmClientOptions {
  /** Workspace writer used to append failure entries to log.md. */
  workspace?: WorkspaceLogWriter;
  /** Called on each retry. */
  onRetry?: (info: { provider: LlmProvider; attempt: number; cause: string }) => void;
  /** Shared per-sprint token budget tracker. Defaults to one seeded from SPRINT_TOKEN_BUDGET. */
  usageTracker?: UsageTracker;
  /** Sleep override — used by tests to advance fake timers. */
  sleep?: (ms: number) => Promise<void>;
}

// ---------------------------------------------------------------------------
// LlmClientError — carries a structured SprintError payload
// ---------------------------------------------------------------------------

type LlmClientSprintError = Extract<
  SprintError,
  { code: "LLM_ERROR" | "LLM_TIMEOUT" | "TOKEN_BUDGET_EXHAUSTED" }
>;

export class LlmClientError extends Error {
  public readonly sprintError: LlmClientSprintError;

  public constructor(sprintError: LlmClientSprintError, message?: string) {
    super(message ?? defaultMessageFor(sprintError));
    this.name = "LlmClientError";
    this.sprintError = sprintError;
  }
}

function defaultMessageFor(err: LlmClientSprintError): string {
  switch (err.code) {
    case "LLM_ERROR":
      return `LLM request failed (provider=${err.provider}, retryable=${err.retryable}): ${err.cause}`;
    case "LLM_TIMEOUT":
      return `LLM request timed out (provider=${err.provider})`;
    case "TOKEN_BUDGET_EXHAUSTED":
      return `Sprint token budget exhausted (sprintId=${err.sprintId})`;
  }
}

// ---------------------------------------------------------------------------
// Usage tracker — enforces the per-sprint token budget
// ---------------------------------------------------------------------------

export interface UsageTracker {
  /** Throws `TOKEN_BUDGET_EXHAUSTED` if the budget is already exhausted. */
  assertAvailable(): void;
  /** Record usage from a completed call. */
  record(usage: LlmUsage): void;
  /** Read the running totals. */
  snapshot(): {
    budget: number;
    used: number;
    remaining: number;
  };
}

export function createUsageTracker(options?: {
  budget?: number;
  sprintId?: string;
}): UsageTracker {
  const budget = options?.budget ?? readDefaultBudget();
  const sprintId = options?.sprintId ?? "unknown";
  let used = 0;
  return {
    assertAvailable() {
      if (used >= budget) {
        throw new LlmClientError({
          code: "TOKEN_BUDGET_EXHAUSTED",
          sprintId,
        });
      }
    },
    record(usage) {
      used += Math.max(0, usage.totalTokens);
    },
    snapshot() {
      return { budget, used, remaining: Math.max(0, budget - used) };
    },
  };
}

function readDefaultBudget(): number {
  try {
    return loadSprintEnv().SPRINT_TOKEN_BUDGET;
  } catch {
    // Fall back to permissive default when env isn't loadable (tests).
    return Number.MAX_SAFE_INTEGER;
  }
}

// ---------------------------------------------------------------------------
// Credential-safe error rendering
// ---------------------------------------------------------------------------

const SECRET_PATTERNS: readonly RegExp[] = [
  /sk-[A-Za-z0-9_-]{10,}/g, // OpenAI / Anthropic API key prefix
  /AKIA[0-9A-Z]{16}/g, // AWS access key id
  /ASIA[0-9A-Z]{16}/g, // AWS STS key id
];

/**
 * Strip known secret-shaped substrings. A false positive (`[REDACTED]` in
 * a benign string) is strictly better than leaking a key in `log.md`.
 */
export function redactSecrets(message: string): string {
  let out = message;
  for (const pat of SECRET_PATTERNS) {
    out = out.replace(pat, "[REDACTED]");
  }
  return out;
}

/** Coerce an unknown thrown value into a safe, string message. */
export function sanitizeErrorMessage(err: unknown): string {
  if (err instanceof LlmClientError) return redactSecrets(err.message);
  if (err instanceof Error) return redactSecrets(err.message);
  try {
    return redactSecrets(String(err));
  } catch {
    return "<unrenderable error>";
  }
}

// ---------------------------------------------------------------------------
// Timeout + retry helpers
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 120_000;
const RETRY_DELAYS_MS: readonly number[] = [1_000, 4_000, 16_000];
const MAX_ATTEMPTS = 3;

/**
 * Race `fn()` against a timer. On timeout rejects with `LLM_TIMEOUT`.
 */
async function withTimeout<T>(
  provider: LlmProvider,
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new LlmClientError({ code: "LLM_TIMEOUT", provider }));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Per-provider retry classification. `retryable=true` means eligible for backoff. */
interface RetryClassification {
  retryable: boolean;
  cause: string;
}

function isTimeout(err: unknown): boolean {
  return err instanceof LlmClientError && err.sprintError.code === "LLM_TIMEOUT";
}

/** Run `attempt()` with 1/4/16s exponential backoff, up to 3 attempts. */
async function retryWithBackoff<T>(args: {
  provider: LlmProvider;
  attempt: (attemptIndex: number) => Promise<T>;
  classify: (err: unknown) => RetryClassification;
  onRetry?: (info: { provider: LlmProvider; attempt: number; cause: string }) => void;
  workspace?: WorkspaceLogWriter;
  sleep: (ms: number) => Promise<void>;
}): Promise<T> {
  const { provider, attempt, classify, onRetry, workspace, sleep } = args;
  let lastClass: RetryClassification | undefined;

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      return await attempt(i);
    } catch (err) {
      // Timeouts behave like retryable transport failures.
      const classified: RetryClassification = isTimeout(err)
        ? { retryable: true, cause: "request timed out" }
        : classify(err);
      lastClass = classified;

      const attemptsRemaining = MAX_ATTEMPTS - i;
      if (!classified.retryable || attemptsRemaining === 0) {
        throw new LlmClientError({
          code: "LLM_ERROR",
          provider,
          retryable: false,
          cause: redactSecrets(classified.cause),
        });
      }

      const delay = RETRY_DELAYS_MS[i - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      const safeCause = redactSecrets(classified.cause);
      onRetry?.({ provider, attempt: i, cause: safeCause });

      if (workspace) {
        // Best-effort: never let log failure swallow the retry loop.
        try {
          await workspace.append(
            "log.md",
            `[${new Date().toISOString()}] ${provider} LLM request failed (attempt ${i}/${MAX_ATTEMPTS}): ${safeCause}; retrying in ${delay}ms\n`,
            { actor: "llm_client", toolName: "llm.generate" },
          );
        } catch {
          // logging must never surface as an LLM error
        }
      }

      await sleep(delay);
    }
  }

  // Unreachable — loop returns or throws. TS exhaustiveness only.
  throw new LlmClientError({
    code: "LLM_ERROR",
    provider,
    retryable: false,
    cause: redactSecrets(lastClass?.cause ?? "exhausted retries"),
  });
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Provider adapters
// ---------------------------------------------------------------------------

/**
 * Internal per-provider contract. The public {@link LlmClient} wraps this
 * with timeout / retry / budget enforcement.
 */
interface ProviderAdapter {
  readonly provider: LlmProvider;
  readonly model: string;
  callOnce(req: LlmRequest, signal: AbortSignal): Promise<LlmResponse>;
  classify(err: unknown): RetryClassification;
}

// -------- shared HTTP-error shape helpers ---------------------------------

function extractStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const record = err as Record<string, unknown>;
  if (typeof record.status === "number") return record.status;
  const response = record.response;
  if (typeof response === "object" && response !== null) {
    const r = response as Record<string, unknown>;
    if (typeof r.status === "number") return r.status;
  }
  return undefined;
}

function extractName(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const name = (err as Record<string, unknown>).name;
  return typeof name === "string" ? name : undefined;
}

/** Retry on 429 and 5xx; everything else non-retryable. Used by OpenAI + Anthropic. */
function classifyByStatus(err: unknown): RetryClassification {
  const status = extractStatus(err);
  const cause =
    err instanceof Error ? err.message : typeof err === "string" ? err : "unknown error";
  if (status === undefined) {
    // No status = transport / connection error. Retryable.
    return { retryable: true, cause };
  }
  if (status === 429 || status >= 500) {
    return { retryable: true, cause };
  }
  return { retryable: false, cause };
}

// -------- Bedrock ---------------------------------------------------------

const BEDROCK_RETRYABLE_NAMES = new Set([
  "ThrottlingException",
  "ServiceUnavailableException",
  "InternalServerException",
  "ModelTimeoutException",
  "ModelStreamErrorException",
]);

const BEDROCK_NON_RETRYABLE_NAMES = new Set([
  "AccessDeniedException",
  "ValidationException",
  "ResourceNotFoundException",
]);

function classifyBedrock(err: unknown): RetryClassification {
  const name = extractName(err);
  const status = extractStatus(err);
  const cause =
    err instanceof Error ? err.message : typeof err === "string" ? err : "unknown error";

  if (name && BEDROCK_NON_RETRYABLE_NAMES.has(name)) {
    return { retryable: false, cause };
  }
  if (name && BEDROCK_RETRYABLE_NAMES.has(name)) {
    return { retryable: true, cause };
  }
  if (status !== undefined) {
    if (status === 429 || status >= 500) {
      return { retryable: true, cause };
    }
    return { retryable: false, cause };
  }
  // No signal — assume transport / connection error. Retryable.
  return { retryable: true, cause };
}

async function createBedrockAdapter(model: string): Promise<ProviderAdapter> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import(
    "@aws-sdk/client-bedrock-runtime"
  );
  const client = new BedrockRuntimeClient({});

  return {
    provider: "bedrock",
    model,
    async callOnce(req, signal) {
      const body = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: req.maxTokens ?? 4096,
        system: req.systemPrompt,
        messages: [{ role: "user", content: req.userPrompt }],
      };
      const command = new InvokeModelCommand({
        modelId: model,
        contentType: "application/json",
        accept: "application/json",
        body: new TextEncoder().encode(JSON.stringify(body)),
      });
      const output = await client.send(command, { abortSignal: signal });
      const raw = new TextDecoder().decode(output.body);
      const parsed = JSON.parse(raw) as {
        content?: Array<{ type?: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const text =
        parsed.content
          ?.filter((c) => c.type === "text" && typeof c.text === "string")
          .map((c) => c.text as string)
          .join("") ?? "";
      const inputTokens = parsed.usage?.input_tokens ?? 0;
      const outputTokens = parsed.usage?.output_tokens ?? 0;
      return {
        text,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        model,
        provider: "bedrock",
      };
    },
    classify: classifyBedrock,
  };
}

// -------- OpenAI ----------------------------------------------------------

async function createOpenAiAdapter(model: string): Promise<ProviderAdapter> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new LlmClientError({
      code: "LLM_ERROR",
      provider: "openai",
      retryable: false,
      cause: "OPENAI_API_KEY is not set",
    });
  }
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });

  return {
    provider: "openai",
    model,
    async callOnce(req, signal) {
      const completion = await client.chat.completions.create(
        {
          model,
          max_tokens: req.maxTokens ?? 4096,
          messages: [
            { role: "system", content: req.systemPrompt },
            { role: "user", content: req.userPrompt },
          ],
        },
        { signal },
      );
      const text = completion.choices[0]?.message?.content ?? "";
      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;
      return {
        text,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        model,
        provider: "openai",
      };
    },
    classify: classifyByStatus,
  };
}

// -------- Anthropic -------------------------------------------------------

async function createAnthropicAdapter(model: string): Promise<ProviderAdapter> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new LlmClientError({
      code: "LLM_ERROR",
      provider: "anthropic",
      retryable: false,
      cause: "ANTHROPIC_API_KEY is not set",
    });
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  return {
    provider: "anthropic",
    model,
    async callOnce(req, signal) {
      const message = await client.messages.create(
        {
          model,
          max_tokens: req.maxTokens ?? 4096,
          system: req.systemPrompt,
          messages: [{ role: "user", content: req.userPrompt }],
        },
        { signal },
      );
      const text = message.content
        .filter(
          (block): block is Extract<(typeof message.content)[number], { type: "text" }> =>
            block.type === "text" && typeof (block as { text?: unknown }).text === "string",
        )
        .map((block) => block.text)
        .join("");
      const inputTokens = message.usage?.input_tokens ?? 0;
      const outputTokens = message.usage?.output_tokens ?? 0;
      return {
        text,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        model,
        provider: "anthropic",
      };
    },
    classify: classifyByStatus,
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build a provider-agnostic {@link LlmClient} from the sprint env.
 * Reads `SPRINT_LLM_PROVIDER` / `SPRINT_LLM_MODEL`. Provider credentials
 * are read by the underlying SDKs from their own env vars and never logged.
 */
export function createLlmClient(options: CreateLlmClientOptions = {}): LlmClient {
  const env = loadSprintEnv();
  const provider = env.SPRINT_LLM_PROVIDER;
  const model = env.SPRINT_LLM_MODEL;
  const usage = options.usageTracker ?? createUsageTracker({ budget: env.SPRINT_TOKEN_BUDGET });
  const sleep = options.sleep ?? defaultSleep;

  // Adapter creation is deferred so the factory is cheap + synchronous.
  let adapterPromise: Promise<ProviderAdapter> | undefined;
  const getAdapter = (): Promise<ProviderAdapter> => {
    if (adapterPromise === undefined) {
      adapterPromise = buildAdapter(provider, model).catch((err) => {
        adapterPromise = undefined;
        throw err;
      });
    }
    return adapterPromise;
  };

  return {
    provider,
    model,
    async generate(req: LlmRequest): Promise<LlmResponse> {
      usage.assertAvailable();
      const adapter = await getAdapter();
      const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      const response = await retryWithBackoff({
        provider,
        attempt: () =>
          withTimeout(provider, timeoutMs, (signal) => adapter.callOnce(req, signal)),
        classify: adapter.classify,
        onRetry: options.onRetry,
        workspace: options.workspace,
        sleep,
      });

      usage.record(response.usage);
      return response;
    },
  };
}

async function buildAdapter(
  provider: LlmProvider,
  model: string,
): Promise<ProviderAdapter> {
  switch (provider) {
    case "bedrock":
      return createBedrockAdapter(model);
    case "openai":
      return createOpenAiAdapter(model);
    case "anthropic":
      return createAnthropicAdapter(model);
  }
}
