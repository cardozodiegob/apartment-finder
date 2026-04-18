/**
 * Outbound network allow-list guard for the sprint runner.
 *
 * Every HTTP request initiated by the Journey_Runner or the
 * security_engineer agent passes through {@link assertHostAllowed} (or
 * {@link isAllowedHost}) before the request goes out. Only two kinds of
 * hosts are permitted:
 *
 *   1. `localhost`, `127.0.0.1`, `::1` (the isolated test app instance
 *      spawned at `SPRINT_TEST_PORT`, and its local MongoDB/lighthouse).
 *   2. The host component of `process.env.SPRINT_TEST_BASE_URL`.
 *
 * Requests to any other host throw {@link NetworkAllowListError}. The
 * caller is expected to log `rejected_not_allowed` to the
 * `sprintActionLog` collection — {@link logNetworkRejection} is the
 * canonical helper for that.
 *
 * Requirements: 4.11, 7.7
 */

import { createHash } from "node:crypto";
import { Types } from "mongoose";

import dbConnect from "@/lib/db/connection";
import SprintActionLog from "@/lib/db/models/SprintActionLog";
import type { AgentRole } from "@/lib/sprint/types";

// ---------------------------------------------------------------------------
// Static fallback hosts — always allowed regardless of env
// ---------------------------------------------------------------------------

const STATIC_ALLOWED_HOSTS: readonly string[] = Object.freeze([
  "localhost",
  "127.0.0.1",
  "::1",
]);

// ---------------------------------------------------------------------------
// NetworkAllowListError
// ---------------------------------------------------------------------------

export class NetworkAllowListError extends Error {
  public readonly attemptedHost: string;
  public readonly attemptedUrl: string;

  public constructor(url: string) {
    super(
      `Outbound request to "${url}" is not allowed; only localhost and ` +
        `SPRINT_TEST_BASE_URL are permitted.`,
    );
    this.name = "NetworkAllowListError";
    let host = "<invalid>";
    try {
      host = new URL(url).hostname;
    } catch {
      host = "<invalid>";
    }
    this.attemptedHost = host;
    this.attemptedUrl = url;
  }
}

// ---------------------------------------------------------------------------
// Resolve the configured base-URL host without crashing when env hasn't
// been loaded. We read directly from process.env so this helper doesn't
// trigger a full `loadSprintEnv()` call (which would throw on missing
// provider credentials even in tests that don't care about them).
// ---------------------------------------------------------------------------

function readBaseUrlHost(): string | undefined {
  const raw = process.env.SPRINT_TEST_BASE_URL;
  if (!raw || raw.trim() === "") return undefined;
  try {
    const host = new URL(raw).hostname;
    return host.trim() === "" ? undefined : host.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Return the full list of hostnames on the allow-list, lowercased.
 *
 * Pure: safe to call any time, including before `loadSprintEnv()`. The
 * returned array is a fresh copy so callers may sort / filter without
 * mutating shared state.
 */
export function allowedHostnames(): readonly string[] {
  const base = readBaseUrlHost();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of STATIC_ALLOWED_HOSTS) {
    const lower = h.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      out.push(lower);
    }
  }
  if (base && !seen.has(base)) {
    seen.add(base);
    out.push(base);
  }
  return Object.freeze(out);
}

/**
 * Return true when the URL's hostname is on the allow-list. Invalid URLs
 * are rejected (returns false).
 */
export function isAllowedHost(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === "") return false;
  return allowedHostnames().includes(host);
}

/**
 * Guard helper — throws {@link NetworkAllowListError} if the URL is not
 * on the allow-list. Intended for direct use inside the journey runner
 * and security_engineer agent tool implementations.
 */
export function assertHostAllowed(url: string): void {
  if (!isAllowedHost(url)) {
    throw new NetworkAllowListError(url);
  }
}

// ---------------------------------------------------------------------------
// Rejection logger — mirrors the `sprintActionLog` shape so admin
// downloads of the action log include every denied outbound request.
// DB errors are swallowed so a dead Mongo never turns into a runtime
// crash inside the journey runner.
// ---------------------------------------------------------------------------

export interface LogNetworkRejectionInput {
  readonly sprintId: string;
  readonly agentRole: AgentRole;
  readonly toolName: string;
  readonly url: string;
  readonly errorMessage?: string;
}

export async function logNetworkRejection(
  input: LogNetworkRejectionInput,
): Promise<void> {
  try {
    await dbConnect();
    const digest = createHash("sha256")
      .update(JSON.stringify({ url: input.url }))
      .digest("hex");
    await SprintActionLog.create({
      timestamp: new Date(),
      sprintId: new Types.ObjectId(input.sprintId),
      agentRole: input.agentRole,
      toolName: input.toolName,
      parameterDigest: digest,
      outcome: "rejected_not_allowed",
      errorMessage:
        input.errorMessage ??
        `Outbound request to "${input.url}" blocked by net-allowlist`,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[sprint-net-allowlist] failed to log network rejection",
      { url: input.url, err },
    );
  }
}
