/**
 * Sprint runner — isolated child test-instance lifecycle.
 *
 * Spawns `next start` as a child process on the configured
 * `SPRINT_TEST_PORT` with `MONGODB_URI` pointed at the sprint-owned test
 * database. The child inherits the parent's env but receives explicit
 * overrides for `MONGODB_URI`, `PORT`, and any values loaded from
 * `.env.sprint`. `start()` resolves only once the child's health endpoint
 * answers with a 2xx status; if the child exits unexpectedly before or
 * after `start()`, every registered `onUnexpectedExit` callback is
 * invoked with the reason.
 *
 * NOTE: `next start` requires a prior production build (`next build`).
 * This module assumes `.next/` already exists. If the build is missing,
 * the child will exit quickly and the health-check timeout error will
 * suggest inspecting `.next/` presence.
 *
 * Requirements: 12.1, 12.3, 12.4
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildTestMongoUri } from "./test-db";
import { loadSprintEnv } from "./env";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CreateTestInstanceOptions {
  /** 24-char hex sprint id; also used to name the isolated database. */
  readonly sprintId: string;
  /** Port override; defaults to `SPRINT_TEST_PORT` from `.env.sprint`. */
  readonly port?: number;
  /** Health-check path; defaults to `/api/health`. */
  readonly healthCheckPath?: string;
  /** Maximum time to wait for the child to answer the health check. */
  readonly healthCheckTimeoutMs?: number;
  /** Poll interval for the health check. */
  readonly healthCheckIntervalMs?: number;
  /** Absolute working directory for the child. Defaults to `process.cwd()`. */
  readonly cwd?: string;
  /** Path to `.env.sprint`. Defaults to `<cwd>/.env.sprint`. */
  readonly envFilePath?: string;
}

export interface TestInstance {
  readonly sprintId: string;
  readonly port: number;
  readonly baseUrl: string;
  /** Resolves when the child responds 2xx to a health-check request. */
  start(): Promise<void>;
  /** Graceful `SIGTERM`; escalates to `SIGKILL` after a 5 s grace period. */
  stop(): Promise<void>;
  /** Register a callback invoked on an unexpected child `close`. */
  onUnexpectedExit(cb: (reason: string) => void): void;
  /** Tail of the child's stdout/stderr (max ~8 KB), useful for diagnostics. */
  getRecentLogs(): string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_HEALTH_PATH = "/api/health";
const DEFAULT_HEALTH_TIMEOUT_MS = 30_000;
const DEFAULT_HEALTH_INTERVAL_MS = 500;
const GRACEFUL_STOP_MS = 5_000;
const LOG_BUFFER_CAP = 8 * 1024; // 8 KB ring buffer

// ---------------------------------------------------------------------------
// Tiny .env parser — same format the sprint runner uses elsewhere. We keep
// it local instead of importing from env.ts because env.ts eagerly validates
// required keys; here we just want the raw file as a flat map to merge into
// the child's env.
// ---------------------------------------------------------------------------

function parseDotEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
    }
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

// ---------------------------------------------------------------------------
// Ring buffer for recent log output
// ---------------------------------------------------------------------------

function makeLogRing(cap: number): {
  push: (chunk: string) => void;
  read: () => string;
} {
  let buf = "";
  return {
    push(chunk: string) {
      buf += chunk;
      if (buf.length > cap) {
        buf = buf.slice(buf.length - cap);
      }
    },
    read() {
      return buf;
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTestInstance(
  options: CreateTestInstanceOptions,
): TestInstance {
  if (typeof options.sprintId !== "string" || options.sprintId.trim() === "") {
    throw new Error("createTestInstance: sprintId must be a non-empty string");
  }

  const env = loadSprintEnv();
  const port = options.port ?? env.SPRINT_TEST_PORT;
  const healthCheckPath = options.healthCheckPath ?? DEFAULT_HEALTH_PATH;
  const healthCheckTimeoutMs =
    options.healthCheckTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
  const healthCheckIntervalMs =
    options.healthCheckIntervalMs ?? DEFAULT_HEALTH_INTERVAL_MS;
  const cwd = options.cwd ?? process.cwd();
  const envFilePath = options.envFilePath ?? resolve(cwd, ".env.sprint");

  const baseUrl = `http://localhost:${port}`;
  const sprintId = options.sprintId;
  const testMongoUri = buildTestMongoUri(env.MONGODB_URI, sprintId);

  const logs = makeLogRing(LOG_BUFFER_CAP);
  const unexpectedExitCbs: Array<(reason: string) => void> = [];

  let child: ChildProcess | null = null;
  let childStarted = false;
  let stopping = false;
  let closeWatcherActive = false;

  function buildChildEnv(): NodeJS.ProcessEnv {
    // Start with the parent env, overlay .env.sprint values (without
    // clobbering existing keys), then apply the hard overrides the runner
    // must enforce: the sprint-owned Mongo URI and the bound PORT.
    const merged = { ...process.env } as Record<string, string | undefined>;
    const sprintFile = parseDotEnvFile(envFilePath);
    for (const [k, v] of Object.entries(sprintFile)) {
      if (merged[k] === undefined || merged[k] === "") {
        merged[k] = v;
      }
    }
    merged.MONGODB_URI = testMongoUri;
    merged.PORT = String(port);
    merged.NODE_ENV = merged.NODE_ENV ?? "production";
    return merged as NodeJS.ProcessEnv;
  }

  function handleClose(code: number | null, signal: NodeJS.Signals | null): void {
    if (!closeWatcherActive) return; // stop() has disarmed the watcher
    closeWatcherActive = false;
    const reason =
      signal !== null
        ? `signal_${signal}`
        : code !== 0
          ? `exit_code_${code ?? "unknown"}`
          : "unexpected_exit";
    for (const cb of [...unexpectedExitCbs]) {
      try {
        cb(reason);
      } catch {
        // Callback errors must not crash the runner.
      }
    }
  }

  async function waitForHealth(): Promise<void> {
    const url = `${baseUrl}${healthCheckPath}`;
    const deadline = Date.now() + healthCheckTimeoutMs;
    let lastErr: unknown = null;
    while (Date.now() < deadline) {
      // If the child died while we were polling, short-circuit.
      if (child && child.exitCode !== null) {
        throw new Error(
          `Test instance for sprint ${sprintId} exited before health ` +
            `check passed (exitCode=${child.exitCode}). Recent logs:\n${logs.read()}`,
        );
      }
      try {
        const res = await fetch(url, { method: "GET" });
        if (res.status >= 200 && res.status < 300) {
          return;
        }
        lastErr = new Error(`status=${res.status}`);
      } catch (err) {
        lastErr = err;
      }
      await new Promise((r) => setTimeout(r, healthCheckIntervalMs));
    }
    const hint =
      "`next start` requires a prior `next build` — verify `.next/` exists.";
    throw new Error(
      `Test instance for sprint ${sprintId} did not become healthy at ${url} ` +
        `within ${healthCheckTimeoutMs} ms. ${hint} Last error: ${
          lastErr instanceof Error ? lastErr.message : String(lastErr)
        }\nRecent logs:\n${logs.read()}`,
    );
  }

  async function start(): Promise<void> {
    if (childStarted) {
      throw new Error(`Test instance for sprint ${sprintId} already started`);
    }
    childStarted = true;

    // Spawn `npx next start -p <port>`. On Windows we need shell: true so
    // the `.cmd` shim is resolved; on POSIX we keep the shell off so we
    // don't introduce an intermediate process that signals won't reach.
    const useShell = process.platform === "win32";
    child = spawn("npx", ["next", "start", "-p", String(port)], {
      cwd,
      env: buildChildEnv(),
      shell: useShell,
      stdio: ["ignore", "pipe", "pipe"],
    });

    closeWatcherActive = true;

    child.stdout?.on("data", (chunk: Buffer) => logs.push(chunk.toString("utf8")));
    child.stderr?.on("data", (chunk: Buffer) => logs.push(chunk.toString("utf8")));
    child.on("close", (code, signal) => handleClose(code, signal));
    child.on("error", (err) => {
      logs.push(`\n[test-instance spawn error] ${err.message}\n`);
    });

    await waitForHealth();
  }

  async function stop(): Promise<void> {
    if (stopping) return;
    stopping = true;
    // Disarm the unexpected-exit watcher BEFORE sending the signal so
    // callbacks don't fire for a clean shutdown.
    closeWatcherActive = false;

    if (!child || child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    const exited = new Promise<void>((resolveExit) => {
      const onExit = () => resolveExit();
      child?.once("close", onExit);
    });

    try {
      child.kill("SIGTERM");
    } catch {
      // Ignore — the process may have died between the exitCode check and
      // the kill call.
    }

    const timeout = new Promise<"timeout">((resolveTimeout) => {
      setTimeout(() => resolveTimeout("timeout"), GRACEFUL_STOP_MS);
    });

    const outcome = await Promise.race([
      exited.then(() => "exited" as const),
      timeout,
    ]);

    if (outcome === "timeout" && child && child.exitCode === null) {
      try {
        child.kill("SIGKILL");
      } catch {
        // Ignore — best effort.
      }
      await exited;
    }
  }

  function onUnexpectedExit(cb: (reason: string) => void): void {
    unexpectedExitCbs.push(cb);
  }

  function getRecentLogs(): string {
    return logs.read();
  }

  return {
    sprintId,
    port,
    baseUrl,
    start,
    stop,
    onUnexpectedExit,
    getRecentLogs,
  };
}
