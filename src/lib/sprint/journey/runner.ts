/**
 * Journey_Runner — drives a Customer_Persona through a declarative list
 * of `JourneyStep`s against the isolated test app instance.
 *
 * Contract (design §"Journey_Runner" + Requirement 4.3–4.11):
 *   - Pure state machine: every step either passes, fails (with a
 *     Finding record attached to the result), or is skipped.
 *   - Dispatch rules:
 *       journey.critical → browser mode for every step
 *       journey.bulk     → api mode for every step; steps lacking an
 *                          `api` definition are skipped with a note
 *       otherwise        → step.mode
 *     `critical && bulk` is rejected at validation time.
 *   - Every outbound HTTP request passes through `assertHostAllowed`
 *     before transmission; a non-allow-listed URL rejects the step.
 *   - Playwright is *optional* at runtime: if `chromium.launch()` fails
 *     (e.g. `npx playwright install` hasn't been run) the runner falls
 *     back to API mode for the whole journey and marks browser-mode
 *     steps "skip" with a clear note.
 *   - Findings emitted from assertion failures flow through
 *     `findings.emit` (the same validated pipeline agents use) when the
 *     caller supplies a tool run-context; when no context is given (e.g.
 *     unit tests) the findings are collected in-memory on the result.
 *
 * Requirements: 4.3, 4.4, 4.5, 4.6, 4.7
 */

import type {
  BrowserContext,
  Page,
  chromium as ChromiumType,
} from "playwright";

import type {
  CustomerPersona,
  FindingCategory,
  FindingSeverity,
  JourneyMode,
} from "@/lib/sprint/types";

import {
  assertHostAllowed,
  NetworkAllowListError,
} from "@/lib/sprint/net-allowlist";
import { findingsEmitToolDef } from "@/lib/sprint/tools/impl/findings-emit";
import type { ToolRunContext } from "@/lib/sprint/tools/executor";

import { applyPersonaContext } from "./personaContext";

// ---------------------------------------------------------------------------
// Public types (exported so the tool wrappers can build journeys)
// ---------------------------------------------------------------------------

export interface PlaywrightAction {
  kind: "goto" | "click" | "fill" | "assertVisible" | "assertText" | "screenshot" | "wait";
  selector?: string;
  value?: string;
  url?: string;
  timeoutMs?: number;
}

export interface JourneyApiRequest {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface JourneyApiExpect {
  status?: number;
  statusIn?: number[];
  jsonPath?: Record<string, unknown>;
}

export interface JourneyBrowserStep {
  actions: PlaywrightAction[];
  axeCheck?: boolean;
}

export interface JourneyStep {
  id: string;
  mode: JourneyMode;
  description: string;
  severity: FindingSeverity;
  request?: JourneyApiRequest;
  expect?: JourneyApiExpect;
  playwright?: JourneyBrowserStep;
}

export interface Journey {
  id: string;
  persona: CustomerPersona;
  critical: boolean;
  bulk: boolean;
  steps: JourneyStep[];
}

export interface JourneyContext {
  /** Base URL of the isolated test app instance (e.g. `http://localhost:3010`). */
  baseUrl: string;
  /** Locale code, e.g. `en` or `es`. */
  locale: string;
  /** Set when a persona requires network throttling. */
  network?: { downKbps: number; rttMs: number };
  /**
   * Optional Playwright module override (for tests). When absent the
   * runner dynamically imports `playwright` and gracefully falls back
   * to API-only mode when it fails.
   */
  playwright?: typeof import("playwright");
  /** Override the HTTP client. Defaults to `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
  /**
   * Optional tool-run-context. When provided, assertion-failure findings
   * are persisted via `findings.emit`. When absent (e.g. unit tests) the
   * findings are collected on `JourneyResult.findings` only.
   */
  toolCtx?: ToolRunContext;
}

export interface JourneyFindingRecord {
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  reproductionSteps: string[];
}

export interface JourneyStepResult {
  stepId: string;
  status: "pass" | "fail" | "skip";
  modeEffective: JourneyMode;
  evidence?: string;
  errorMessage?: string;
}

export interface JourneyResult {
  journeyId: string;
  persona: CustomerPersona;
  status: "completed" | "failed" | "incomplete";
  stepResults: JourneyStepResult[];
  findings: JourneyFindingRecord[];
  /** Set when Playwright launch fails and the runner falls back to API. */
  browsersUnavailable?: boolean;
  /** Human-readable note returned alongside `browsersUnavailable`. */
  fallbackNote?: string;
}

export interface JourneyRunner {
  run(journey: Journey, ctx: JourneyContext): Promise<JourneyResult>;
}

// ---------------------------------------------------------------------------
// Dispatch rule (pure)
// ---------------------------------------------------------------------------

export function resolveEffectiveMode(
  journey: Pick<Journey, "critical" | "bulk">,
  stepMode: JourneyMode,
): JourneyMode {
  if (journey.critical) return "browser";
  if (journey.bulk) return "api";
  return stepMode;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class JourneyValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "JourneyValidationError";
  }
}

function validateJourney(journey: Journey): void {
  if (journey.critical && journey.bulk) {
    throw new JourneyValidationError(
      `Journey "${journey.id}" cannot set both critical and bulk`,
    );
  }
  if (journey.steps.length === 0) {
    throw new JourneyValidationError(
      `Journey "${journey.id}" must declare at least one step`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers — JSON-path assertion & URL join
// ---------------------------------------------------------------------------

/**
 * `jsonPath: { "data.user.id": 7 }` → assert that reading `.data.user.id`
 * from the parsed response returns exactly `7` (deep-equal via JSON
 * serialization). Supports both dot and bracketed numeric path segments:
 * `items[0].id`.
 */
function readJsonPath(value: unknown, path: string): unknown {
  const segments: string[] = [];
  let current = "";
  for (const ch of path) {
    if (ch === ".") {
      if (current !== "") segments.push(current);
      current = "";
    } else if (ch === "[") {
      if (current !== "") segments.push(current);
      current = "";
    } else if (ch === "]") {
      if (current !== "") segments.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current !== "") segments.push(current);

  let node: unknown = value;
  for (const seg of segments) {
    if (node === null || node === undefined) return undefined;
    if (typeof node !== "object") return undefined;
    const asRecord = node as Record<string, unknown>;
    // Numeric segments index arrays; string segments index objects.
    if (/^\d+$/.test(seg) && Array.isArray(node)) {
      node = (node as unknown[])[Number(seg)];
    } else {
      node = asRecord[seg];
    }
  }
  return node;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function joinUrl(baseUrl: string, pathname: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const tail = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${tail}`;
}

// ---------------------------------------------------------------------------
// Playwright lazy-load helper with graceful fallback
// ---------------------------------------------------------------------------

interface LoadedPlaywright {
  chromium: typeof ChromiumType;
}

async function tryLoadPlaywright(
  ctx: JourneyContext,
): Promise<LoadedPlaywright | undefined> {
  if (ctx.playwright) {
    return { chromium: ctx.playwright.chromium };
  }
  try {
    const mod = await import("playwright");
    return { chromium: mod.chromium };
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Axe violation → finding severity mapping (also used by a11y.run_axe)
// ---------------------------------------------------------------------------

export function axeImpactToSeverity(
  impact: string | null | undefined,
): FindingSeverity {
  switch (impact) {
    case "critical":
    case "serious":
      return "high";
    case "moderate":
      return "medium";
    case "minor":
    default:
      return "low";
  }
}

// ---------------------------------------------------------------------------
// Step execution — API mode
// ---------------------------------------------------------------------------

interface RunStepOutcome {
  stepResult: JourneyStepResult;
  findings: JourneyFindingRecord[];
}

async function runApiStep(
  journey: Journey,
  step: JourneyStep,
  ctx: JourneyContext,
): Promise<RunStepOutcome> {
  const findings: JourneyFindingRecord[] = [];

  if (!step.request) {
    return {
      stepResult: {
        stepId: step.id,
        status: "skip",
        modeEffective: "api",
        errorMessage: "api step missing request definition",
      },
      findings,
    };
  }

  const url = joinUrl(ctx.baseUrl, step.request.path);

  try {
    assertHostAllowed(url);
  } catch (err) {
    const msg =
      err instanceof NetworkAllowListError
        ? err.message
        : String(err);
    findings.push({
      category: "security",
      severity: "high",
      title: `Network allow-list blocked outbound request in step "${step.id}"`,
      description: msg,
      reproductionSteps: [
        `Run journey "${journey.id}"`,
        `Attempt request: ${step.request.method} ${step.request.path}`,
      ],
    });
    return {
      stepResult: {
        stepId: step.id,
        status: "fail",
        modeEffective: "api",
        errorMessage: msg,
      },
      findings,
    };
  }

  const fetchImpl: typeof globalThis.fetch = ctx.fetch ?? globalThis.fetch;
  const method = step.request.method.toUpperCase();
  const init: RequestInit = { method };
  const headers: Record<string, string> = { ...(step.request.headers ?? {}) };
  if (step.request.body !== undefined) {
    if (!headers["content-type"] && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    init.body = JSON.stringify(step.request.body);
  }
  init.headers = headers;

  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const finding: JourneyFindingRecord = {
      category: "bug",
      severity: step.severity,
      title: `Network error during "${step.description}"`,
      description: `Request ${method} ${step.request.path} failed: ${msg}`,
      reproductionSteps: [
        `Run journey "${journey.id}"`,
        `Perform ${method} ${step.request.path}`,
      ],
    };
    findings.push(finding);
    return {
      stepResult: {
        stepId: step.id,
        status: "fail",
        modeEffective: "api",
        errorMessage: msg,
      },
      findings,
    };
  }

  const failures: string[] = [];

  // Read the body once — JSON when possible, text otherwise.
  let rawBody = "";
  try {
    rawBody = await response.text();
  } catch {
    rawBody = "";
  }
  let parsedBody: unknown;
  try {
    parsedBody = rawBody === "" ? undefined : JSON.parse(rawBody);
  } catch {
    parsedBody = undefined;
  }

  const expect = step.expect;
  if (expect) {
    if (expect.status !== undefined && response.status !== expect.status) {
      failures.push(
        `expected status ${expect.status}, got ${response.status}`,
      );
    }
    if (
      expect.statusIn !== undefined &&
      !expect.statusIn.includes(response.status)
    ) {
      failures.push(
        `expected status in [${expect.statusIn.join(", ")}], got ${response.status}`,
      );
    }
    if (expect.jsonPath) {
      if (parsedBody === undefined) {
        failures.push(
          "expected JSON body for jsonPath assertion but response was not JSON",
        );
      } else {
        for (const [pathExpr, expected] of Object.entries(expect.jsonPath)) {
          const actual = readJsonPath(parsedBody, pathExpr);
          if (!deepEqual(actual, expected)) {
            failures.push(
              `jsonPath "${pathExpr}" expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
            );
          }
        }
      }
    }
  }

  if (failures.length === 0) {
    return {
      stepResult: {
        stepId: step.id,
        status: "pass",
        modeEffective: "api",
        evidence: `${method} ${step.request.path} → ${response.status}`,
      },
      findings,
    };
  }

  const description = [
    `Assertion failed in step "${step.description}".`,
    `Request: ${method} ${step.request.path}`,
    `Response status: ${response.status}`,
    `Response body (first 400 chars): ${rawBody.slice(0, 400)}`,
    "",
    ...failures.map((f) => `- ${f}`),
  ].join("\n");

  findings.push({
    category: "bug",
    severity: step.severity,
    title: `Step "${step.id}" assertion failed`,
    description,
    reproductionSteps: [
      `Run journey "${journey.id}"`,
      `Perform ${method} ${step.request.path}`,
      `Inspect response (status ${response.status})`,
    ],
  });

  return {
    stepResult: {
      stepId: step.id,
      status: "fail",
      modeEffective: "api",
      errorMessage: failures.join("; "),
    },
    findings,
  };
}

// ---------------------------------------------------------------------------
// Step execution — Browser mode (Playwright)
// ---------------------------------------------------------------------------

interface RunBrowserStepDeps {
  browserContext: BrowserContext;
  forceAxeCheck: boolean;
}

async function runBrowserStep(
  journey: Journey,
  step: JourneyStep,
  ctx: JourneyContext,
  deps: RunBrowserStepDeps,
): Promise<RunStepOutcome> {
  const findings: JourneyFindingRecord[] = [];
  const pw = step.playwright;
  if (!pw || pw.actions.length === 0) {
    return {
      stepResult: {
        stepId: step.id,
        status: "skip",
        modeEffective: "browser",
        errorMessage: "browser step missing playwright actions",
      },
      findings,
    };
  }

  let page: Page | undefined;
  try {
    page = await deps.browserContext.newPage();

    for (const action of pw.actions) {
      await executePlaywrightAction(page, action, ctx);
    }

    // Optional axe-core sweep (Requirement 4.10).
    const axeCheck = pw.axeCheck === true || deps.forceAxeCheck;
    if (axeCheck) {
      try {
        // Lazy import so the dep is optional for journeys that don't use it.
        const { default: AxeBuilder } = await import(
          "@axe-core/playwright"
        );
        const results = await new AxeBuilder({ page })
          .options({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })
          .analyze();
        for (const violation of results.violations) {
          findings.push({
            category: "accessibility",
            severity: axeImpactToSeverity(violation.impact),
            title: `a11y: ${violation.id} — ${violation.help}`,
            description: [
              violation.description,
              "",
              `WCAG tags: ${violation.tags.join(", ")}`,
              `Affected nodes: ${violation.nodes.length}`,
              `Help URL: ${violation.helpUrl}`,
            ].join("\n"),
            reproductionSteps: [
              `Run journey "${journey.id}"`,
              `Navigate per step "${step.id}"`,
              `Open the page and run axe-core; rule ${violation.id} fires on ${violation.nodes.length} nodes`,
            ],
          });
        }
      } catch (err) {
        // Axe failing isn't a hard runner failure — record as a low-sev note.
        const msg = err instanceof Error ? err.message : String(err);
        findings.push({
          category: "accessibility",
          severity: "low",
          title: `axe-core could not run for step "${step.id}"`,
          description: msg,
          reproductionSteps: [
            `Run journey "${journey.id}"`,
            `Execute step "${step.id}" with axeCheck enabled`,
          ],
        });
      }
    }

    return {
      stepResult: {
        stepId: step.id,
        status: "pass",
        modeEffective: "browser",
        evidence: `browser step "${step.id}" completed (${pw.actions.length} actions)`,
      },
      findings,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let screenshot: string | undefined;
    if (page) {
      try {
        const buf = await page.screenshot({ fullPage: false });
        screenshot = buf.toString("base64").slice(0, 64);
      } catch {
        screenshot = undefined;
      }
    }
    findings.push({
      category: "ux",
      severity: step.severity,
      title: `Browser step "${step.id}" failed`,
      description: [
        `Assertion or action failed in "${step.description}".`,
        msg,
        screenshot ? `Screenshot (b64 prefix): ${screenshot}…` : "",
      ]
        .filter((l) => l !== "")
        .join("\n"),
      reproductionSteps: [
        `Run journey "${journey.id}"`,
        `Execute browser step "${step.id}" on ${ctx.baseUrl}`,
      ],
    });
    return {
      stepResult: {
        stepId: step.id,
        status: "fail",
        modeEffective: "browser",
        errorMessage: msg,
        evidence: screenshot ? `screenshot-b64-prefix:${screenshot}` : undefined,
      },
      findings,
    };
  } finally {
    if (page) {
      await page.close().catch(() => undefined);
    }
  }
}

async function executePlaywrightAction(
  page: Page,
  action: PlaywrightAction,
  ctx: JourneyContext,
): Promise<void> {
  const timeout = action.timeoutMs ?? 15_000;
  switch (action.kind) {
    case "goto": {
      const target = action.url ?? "/";
      const url = target.startsWith("http")
        ? target
        : joinUrl(ctx.baseUrl, target);
      assertHostAllowed(url);
      await page.goto(url, { timeout });
      return;
    }
    case "click":
      if (!action.selector) throw new Error(`click action missing selector`);
      await page.click(action.selector, { timeout });
      return;
    case "fill":
      if (!action.selector) throw new Error(`fill action missing selector`);
      await page.fill(action.selector, action.value ?? "", { timeout });
      return;
    case "assertVisible":
      if (!action.selector) {
        throw new Error(`assertVisible action missing selector`);
      }
      await page.waitForSelector(action.selector, { state: "visible", timeout });
      return;
    case "assertText":
      if (!action.selector) {
        throw new Error(`assertText action missing selector`);
      }
      {
        const el = await page.waitForSelector(action.selector, { timeout });
        const text = (await el.textContent()) ?? "";
        if (action.value && !text.includes(action.value)) {
          throw new Error(
            `assertText: expected "${action.value}" in "${text.slice(0, 120)}"`,
          );
        }
      }
      return;
    case "screenshot":
      await page.screenshot({ fullPage: false });
      return;
    case "wait":
      await page.waitForTimeout(action.timeoutMs ?? 500);
      return;
    default: {
      const exhaustive: never = action.kind;
      throw new Error(`unknown playwright action: ${String(exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Runner factory
// ---------------------------------------------------------------------------

export function createJourneyRunner(): JourneyRunner {
  return {
    async run(journey: Journey, ctx: JourneyContext): Promise<JourneyResult> {
      validateJourney(journey);

      const personaApplied = await applyPersonaContext(journey.persona, ctx);
      const effectiveCtx = personaApplied.ctx;

      // Decide up-front whether ANY step will try browser mode so we can
      // lazily launch Playwright once per journey.
      const stepsWithModes = journey.steps.map((step) => ({
        step,
        mode: resolveEffectiveMode(journey, step.mode),
      }));
      const anyBrowserStep = stepsWithModes.some((s) => s.mode === "browser");

      let loaded: LoadedPlaywright | undefined;
      let browser: Awaited<ReturnType<typeof ChromiumType.launch>> | undefined;
      let browserContext: BrowserContext | undefined;
      let browsersUnavailable = false;
      let fallbackNote: string | undefined;

      if (anyBrowserStep) {
        loaded = await tryLoadPlaywright(effectiveCtx);
        if (!loaded) {
          browsersUnavailable = true;
          fallbackNote =
            "playwright package not importable; browser steps will be skipped";
        } else {
          try {
            browser = await loaded.chromium.launch();
            browserContext = await browser.newContext({
              locale: effectiveCtx.locale,
            });
            // Re-apply persona side-effects against the live BrowserContext
            // for CDP throttling / headers / cookies.
            await applyPersonaContext(
              journey.persona,
              effectiveCtx,
              browserContext,
            );
          } catch (err) {
            browsersUnavailable = true;
            fallbackNote = `playwright browsers not installed: ${
              err instanceof Error ? err.message : String(err)
            }`;
            if (browser) {
              await browser.close().catch(() => undefined);
            }
            browser = undefined;
            browserContext = undefined;
          }
        }
      }

      const stepResults: JourneyStepResult[] = [];
      const allFindings: JourneyFindingRecord[] = [];
      let runnerFailure: string | undefined;

      try {
        for (const { step, mode } of stepsWithModes) {
          if (mode === "browser") {
            if (!browserContext) {
              stepResults.push({
                stepId: step.id,
                status: "skip",
                modeEffective: "browser",
                errorMessage:
                  fallbackNote ?? "browser unavailable; step skipped",
              });
              continue;
            }
            const outcome = await runBrowserStep(journey, step, effectiveCtx, {
              browserContext,
              forceAxeCheck: personaApplied.forceAxeCheck,
            });
            stepResults.push(outcome.stepResult);
            allFindings.push(...outcome.findings);
          } else {
            const outcome = await runApiStep(journey, step, effectiveCtx);
            stepResults.push(outcome.stepResult);
            allFindings.push(...outcome.findings);
          }
        }
      } catch (err) {
        runnerFailure = err instanceof Error ? err.message : String(err);
      } finally {
        if (browserContext) {
          await browserContext.close().catch(() => undefined);
        }
        if (browser) {
          await browser.close().catch(() => undefined);
        }
      }

      // Emit findings through the validated pipeline when a ToolRunContext
      // was provided. Errors here are swallowed — the in-memory result is
      // still authoritative.
      if (effectiveCtx.toolCtx && allFindings.length > 0) {
        for (const finding of allFindings) {
          try {
            await findingsEmitToolDef.run(
              {
                category: finding.category,
                severity: finding.severity,
                title: finding.title,
                description: finding.description,
                reproductionSteps: finding.reproductionSteps,
                evidenceUrls: [],
                reporterPersona: journey.persona,
              },
              effectiveCtx.toolCtx,
            );
          } catch {
            // Persistence failure does not abort the journey.
          }
        }
      }

      const anyFailed = stepResults.some((r) => r.status === "fail");
      const status: JourneyResult["status"] = runnerFailure
        ? "incomplete"
        : anyFailed
          ? "failed"
          : "completed";

      return {
        journeyId: journey.id,
        persona: journey.persona,
        status,
        stepResults,
        findings: allFindings,
        ...(browsersUnavailable ? { browsersUnavailable: true } : {}),
        ...(fallbackNote ? { fallbackNote } : {}),
      };
    },
  };
}
