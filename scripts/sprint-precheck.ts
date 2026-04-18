/**
 * Sprint runner preflight check.
 *
 * Validates the five environmental preconditions that the sprint runner
 * cannot recover from at runtime:
 *
 *   1. `.env.sprint` loads cleanly (required keys + LLM provider creds)
 *   2. MongoDB is reachable at the configured URI
 *   3. A Next.js production build exists (`.next/` present and non-empty)
 *   4. Playwright browsers are installed (optional — reported as a warning)
 *   5. The configured `SPRINT_TEST_PORT` is free
 *
 * Non-zero exit codes:
 *   1 — env load failure
 *   2 — MongoDB connectivity failure
 *   3 — missing `.next/` production build
 *   4 — port already in use
 *
 * Playwright-missing is only a warning; the journey runner and a11y tool
 * fall back to API-mode / skipped runs in that case.
 *
 * Usage: `npx tsx scripts/sprint-precheck.ts`
 */

import { existsSync, statSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";

import mongoose from "mongoose";

import { loadSprintEnv, SprintEnvError } from "@/lib/sprint/env";

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly severity: "required" | "warning";
  readonly exitCode?: number;
  readonly message: string;
  readonly hint?: string;
}

async function checkEnv(): Promise<CheckResult> {
  try {
    const env = loadSprintEnv();
    return {
      name: "env",
      ok: true,
      severity: "required",
      message:
        `SPRINT_LLM_PROVIDER=${env.SPRINT_LLM_PROVIDER}, ` +
        `SPRINT_TEST_PORT=${env.SPRINT_TEST_PORT}`,
    };
  } catch (err) {
    const msg =
      err instanceof SprintEnvError
        ? `${err.message} (key: ${err.sprintError.key})`
        : err instanceof Error
          ? err.message
          : String(err);
    return {
      name: "env",
      ok: false,
      severity: "required",
      exitCode: 1,
      message: msg,
      hint:
        "Copy .env.sprint.example to .env.sprint and fill in real values. " +
        "See SPRINT_RUNBOOK.md for details.",
    };
  }
}

async function checkMongo(uri: string): Promise<CheckResult> {
  const conn = mongoose.createConnection(uri, {
    bufferCommands: false,
    connectTimeoutMS: 5_000,
    serverSelectionTimeoutMS: 5_000,
  });
  try {
    await conn.asPromise();
    const db = conn.db;
    if (!db) throw new Error("no db handle on connection");
    await db.admin().command({ ping: 1 });
    return {
      name: "mongodb",
      ok: true,
      severity: "required",
      message: `reachable at ${redactUri(uri)}`,
    };
  } catch (err) {
    return {
      name: "mongodb",
      ok: false,
      severity: "required",
      exitCode: 2,
      message: err instanceof Error ? err.message : String(err),
      hint:
        "Start MongoDB locally (e.g. `mongod` or `brew services start " +
        "mongodb-community`) or update MONGODB_URI in .env.sprint.",
    };
  } finally {
    await conn.close().catch(() => undefined);
  }
}

async function checkProductionBuild(): Promise<CheckResult> {
  const nextDir = path.resolve(process.cwd(), ".next");
  if (!existsSync(nextDir)) {
    return {
      name: "build",
      ok: false,
      severity: "required",
      exitCode: 3,
      message: "`.next/` directory is missing",
      hint: "Run `npm run build` before starting a sprint.",
    };
  }
  const buildIdPath = path.join(nextDir, "BUILD_ID");
  if (!existsSync(buildIdPath)) {
    return {
      name: "build",
      ok: false,
      severity: "required",
      exitCode: 3,
      message: "`.next/BUILD_ID` is missing — build looks incomplete",
      hint: "Run `npm run build` to produce a complete production build.",
    };
  }
  const buildAgeMs = Date.now() - statSync(buildIdPath).mtimeMs;
  const buildAgeHours = Math.round((buildAgeMs / 3_600_000) * 10) / 10;
  return {
    name: "build",
    ok: true,
    severity: "required",
    message: `.next/ exists (build is ${buildAgeHours}h old)`,
  };
}

async function checkPortFree(port: number): Promise<CheckResult> {
  return new Promise<CheckResult>((resolve) => {
    const server = createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve({
          name: "port",
          ok: false,
          severity: "required",
          exitCode: 4,
          message: `port ${port} is already in use`,
          hint:
            `Stop whatever is listening on :${port}, or change ` +
            `SPRINT_TEST_PORT in .env.sprint.`,
        });
      } else {
        resolve({
          name: "port",
          ok: false,
          severity: "required",
          exitCode: 4,
          message: `port check errored: ${err.message}`,
        });
      }
    });
    server.once("listening", () => {
      server.close(() => {
        resolve({
          name: "port",
          ok: true,
          severity: "required",
          message: `port ${port} is free`,
        });
      });
    });
    server.listen(port, "127.0.0.1");
  });
}

async function checkPlaywright(): Promise<CheckResult> {
  try {
    const mod = await import("playwright");
    const executable = mod.chromium.executablePath();
    if (executable && existsSync(executable)) {
      return {
        name: "playwright",
        ok: true,
        severity: "warning",
        message: `chromium ready at ${executable}`,
      };
    }
    return {
      name: "playwright",
      ok: false,
      severity: "warning",
      message: "playwright is installed but browsers are not",
      hint:
        "Run `npx playwright install chromium` to enable journey + a11y " +
        "runs. Without this, browser steps cleanly skip.",
    };
  } catch (err) {
    return {
      name: "playwright",
      ok: false,
      severity: "warning",
      message: `playwright import failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
      hint:
        "Browser-based journeys + axe + lighthouse runs will skip. API " +
        "journeys will still work.",
    };
  }
}

function redactUri(uri: string): string {
  return uri.replace(/\/\/([^@]+)@/, "//[REDACTED]@");
}

function glyph(ok: boolean, severity: CheckResult["severity"]): string {
  if (ok) return "✅";
  return severity === "required" ? "❌" : "⚠️ ";
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("Running sprint runner preflight checks…\n");

  const envResult = await checkEnv();
  if (!envResult.ok) {
    report([envResult]);
    process.exit(envResult.exitCode ?? 1);
  }

  // Safe to read env now; the env check already validated it.
  const env = loadSprintEnv();

  const results = [envResult];
  results.push(await checkProductionBuild());
  results.push(await checkMongo(env.MONGODB_URI));
  results.push(await checkPortFree(env.SPRINT_TEST_PORT));
  results.push(await checkPlaywright());

  report(results);

  const firstFailedRequired = results.find(
    (r) => !r.ok && r.severity === "required",
  );
  if (firstFailedRequired) {
    process.exit(firstFailedRequired.exitCode ?? 1);
  }
}

function report(results: readonly CheckResult[]): void {
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`${glyph(r.ok, r.severity)}  ${r.name.padEnd(12)} ${r.message}`);
    if (!r.ok && r.hint) {
      // eslint-disable-next-line no-console
      console.log(`   hint: ${r.hint}`);
    }
  }
  // eslint-disable-next-line no-console
  console.log("");
  const anyRequiredFail = results.some(
    (r) => !r.ok && r.severity === "required",
  );
  const anyWarning = results.some(
    (r) => !r.ok && r.severity === "warning",
  );
  if (anyRequiredFail) {
    // eslint-disable-next-line no-console
    console.log("❌ Preflight failed. Resolve the errors above before starting a sprint.");
  } else if (anyWarning) {
    // eslint-disable-next-line no-console
    console.log("⚠️  Preflight passed with warnings — some capabilities will be limited.");
  } else {
    // eslint-disable-next-line no-console
    console.log("✅ All checks passed. You're ready to start a sprint.");
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Preflight crashed:", err);
  process.exit(99);
});
