#!/usr/bin/env node
/**
 * Sprint runner CLI.
 *
 * Thin wrapper over `getSharedSprintRunner()` so admins can drive the
 * Virtual Team Sprint Runner from the terminal without needing the
 * `/admin/sprints` UI logged in. Every command reads `.env.sprint` via
 * `loadSprintEnv()`; every command is idempotent where the underlying
 * runner is idempotent.
 *
 * Commands:
 *   create   — create a new sprint in `pending` state and print the id
 *   start    — transition pending → running
 *   abort    — transition running|closing → aborted with a reason
 *   status   — print a SprintStatusView as JSON
 *   list     — list recent sprints (default 10)
 *   logs     — tail the workspace log.md
 *
 * Note on lazy imports: every module that touches MongoDB (`dbConnect`,
 * the Sprint model, the runner, the workspace writer) is imported lazily
 * inside the command handler that needs it. This keeps `sprint help` and
 * arg validation fast and crash-free even when `.env.local` / `.env.sprint`
 * aren't configured yet.
 *
 * Usage examples:
 *   npm run sprint -- create \
 *     --roles tech_lead,senior_dev,qa_engineer,security_engineer \
 *     --personas student_sharer,adversarial_probe \
 *     --duration 60 \
 *     --goals "Audit admin routes,Run a11y sweep" \
 *     --branch mainline \
 *     --created-by <admin_user_object_id>
 *
 *   npm run sprint -- start <sprintId>
 *   npm run sprint -- status <sprintId>
 *   npm run sprint -- abort  <sprintId> --reason "cancelled"
 *   npm run sprint -- list
 *   npm run sprint -- logs <sprintId>
 */

import {
  AGENT_ROLES,
  CUSTOMER_PERSONAS,
  type AgentRole,
  type CustomerPersona,
} from "@/lib/sprint/types";

// ---------------------------------------------------------------------------
// Argv parsing — deliberately simple, no external deps
// ---------------------------------------------------------------------------

interface ParsedArgs {
  readonly command: string;
  readonly positional: readonly string[];
  readonly flags: Readonly<Record<string, string>>;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = "true";
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(token);
    }
  }
  return { command: command ?? "", positional, flags };
}

function splitCsv<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  label: string,
): T[] {
  if (!value) return [];
  const parts = value
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  for (const p of parts) {
    if (!allowed.includes(p as T)) {
      throw new CliError(
        `${label}: "${p}" is not a valid option. Valid: ${allowed.join(", ")}`,
      );
    }
  }
  return parts as T[];
}

function splitGoals(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

// ---------------------------------------------------------------------------
// Error type — collapses to a clean exit with a usage hint
// ---------------------------------------------------------------------------

class CliError extends Error {
  public readonly exitCode: number;
  public readonly hint?: string;
  public constructor(message: string, exitCode = 1, hint?: string) {
    super(message);
    this.exitCode = exitCode;
    if (hint !== undefined) this.hint = hint;
  }
}

// ---------------------------------------------------------------------------
// Pretty-print helpers
// ---------------------------------------------------------------------------

function fail(msg: string, hint?: string): never {
  // eslint-disable-next-line no-console
  console.error(`error: ${msg}`);
  if (hint) {
    // eslint-disable-next-line no-console
    console.error(`hint : ${hint}`);
  }
  process.exit(1);
}

function printJson(value: unknown): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(value, null, 2));
}

interface SprintListItem {
  _id: { toString(): string };
  status: string;
  durationMinutes: number;
  createdAt: Date;
  goals?: string[];
}

function formatStatusLine(s: SprintListItem): string {
  const id = s._id.toString();
  const goal = s.goals?.[0] ?? "(no goals)";
  const created = s.createdAt.toISOString();
  return `${id}  ${s.status.padEnd(10)}  ${String(s.durationMinutes).padStart(3)}m  ${created}  ${goal}`;
}

// ---------------------------------------------------------------------------
// Lazy imports — every Mongo-touching module loads on first use so `help`
// and arg validation never trigger the dbConnect error.
// ---------------------------------------------------------------------------

async function loadObjectId(): Promise<typeof import("mongoose").Types.ObjectId> {
  const { Types } = await import("mongoose");
  return Types.ObjectId;
}

async function loadEnv(): Promise<void> {
  const { loadSprintEnv } = await import("@/lib/sprint/env");
  loadSprintEnv();
}

async function loadRunner(): Promise<
  ReturnType<typeof import("@/lib/sprint/runner").getSharedSprintRunner>
> {
  const { getSharedSprintRunner } = await import("@/lib/sprint/runner");
  return getSharedSprintRunner();
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdCreate(parsed: ParsedArgs): Promise<void> {
  const roles = splitCsv<AgentRole>(parsed.flags.roles, AGENT_ROLES, "roles");
  if (roles.length === 0) {
    throw new CliError(
      "--roles is required (comma-separated). tech_lead is mandatory.",
    );
  }
  if (!roles.includes("tech_lead")) {
    throw new CliError(
      "--roles must include tech_lead. The tech_lead agent is the sprint coordinator.",
    );
  }
  const personas = splitCsv<CustomerPersona>(
    parsed.flags.personas,
    CUSTOMER_PERSONAS,
    "personas",
  );
  const durationRaw = parsed.flags.duration ?? "60";
  const durationMinutes = Number.parseInt(durationRaw, 10);
  if (!Number.isFinite(durationMinutes)) {
    throw new CliError(`--duration "${durationRaw}" is not a number`);
  }
  const goals = splitGoals(parsed.flags.goals);
  if (goals.length === 0) {
    throw new CliError("--goals is required (comma-separated, one per goal).");
  }
  const branch = parsed.flags.branch;
  if (!branch || branch.trim() === "") {
    throw new CliError(
      "--branch is required (the branch you're currently on).",
    );
  }
  const createdBy = parsed.flags["created-by"];
  const ObjectId = await loadObjectId();
  if (!createdBy || !ObjectId.isValid(createdBy)) {
    throw new CliError(
      "--created-by must be a 24-hex Mongo ObjectId of an admin user.",
      1,
      "Look up the admin user's _id in Mongo: `db.users.findOne({role:\"admin\"}, {_id:1})`",
    );
  }

  const runner = await loadRunner();
  const sprintId = await runner.create({
    roles,
    personas,
    durationMinutes,
    goals,
    createdBy,
    currentBranchAtStart: branch,
  });

  // eslint-disable-next-line no-console
  console.log(sprintId);
}

async function cmdStart(parsed: ParsedArgs): Promise<void> {
  const [sprintId] = parsed.positional;
  const ObjectId = await loadObjectId();
  if (!sprintId || !ObjectId.isValid(sprintId)) {
    throw new CliError("usage: sprint start <sprintId>");
  }
  const runner = await loadRunner();
  await runner.start(sprintId);
  // eslint-disable-next-line no-console
  console.log(`started ${sprintId}`);
}

async function cmdAbort(parsed: ParsedArgs): Promise<void> {
  const [sprintId] = parsed.positional;
  const ObjectId = await loadObjectId();
  if (!sprintId || !ObjectId.isValid(sprintId)) {
    throw new CliError("usage: sprint abort <sprintId> [--reason <text>]");
  }
  const reason = parsed.flags.reason ?? "cli_abort";
  const runner = await loadRunner();
  await runner.abort(sprintId, reason);
  // eslint-disable-next-line no-console
  console.log(`aborted ${sprintId} (${reason})`);
}

async function cmdStatus(parsed: ParsedArgs): Promise<void> {
  const [sprintId] = parsed.positional;
  const ObjectId = await loadObjectId();
  if (!sprintId || !ObjectId.isValid(sprintId)) {
    throw new CliError("usage: sprint status <sprintId>");
  }
  const runner = await loadRunner();
  const view = await runner.getStatus(sprintId);
  printJson(view);
}

async function cmdList(parsed: ParsedArgs): Promise<void> {
  const limit = Math.max(
    1,
    Math.min(100, Number.parseInt(parsed.flags.limit ?? "10", 10) || 10),
  );
  const { default: dbConnect } = await import("@/lib/db/connection");
  const { default: Sprint } = await import("@/lib/db/models/Sprint");
  await dbConnect();
  const items = (await Sprint.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .select({
      _id: 1,
      status: 1,
      durationMinutes: 1,
      createdAt: 1,
      goals: 1,
    })
    .lean()) as unknown as SprintListItem[];
  if (items.length === 0) {
    // eslint-disable-next-line no-console
    console.log("(no sprints yet)");
    return;
  }
  for (const item of items) {
    // eslint-disable-next-line no-console
    console.log(formatStatusLine(item));
  }
}

async function cmdLogs(parsed: ParsedArgs): Promise<void> {
  const [sprintId] = parsed.positional;
  const ObjectId = await loadObjectId();
  if (!sprintId || !ObjectId.isValid(sprintId)) {
    throw new CliError("usage: sprint logs <sprintId> [--tail N]");
  }
  const tail = Math.max(
    1,
    Number.parseInt(parsed.flags.tail ?? "50", 10) || 50,
  );
  const { createWorkspaceWriter } = await import("@/lib/sprint/workspace");
  const writer = createWorkspaceWriter(sprintId);
  try {
    const content = await writer.read("log.md");
    const lines = content.split("\n").filter((l) => l.length > 0);
    for (const line of lines.slice(-tail)) {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  } catch (err) {
    throw new CliError(
      `failed to read log.md: ${err instanceof Error ? err.message : String(err)}`,
      1,
      "The workspace may not be initialized yet; the sprint must have been created first.",
    );
  }
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(
    [
      "sprint — Virtual Team Sprint Runner CLI",
      "",
      "Usage:",
      "  npm run sprint -- <command> [args...]",
      "  npx tsx scripts/sprint.ts <command> [args...]",
      "",
      "Commands:",
      "  create   Create a new sprint in `pending` state and print its id.",
      "           Required: --roles, --goals, --branch, --created-by",
      "           Optional: --personas, --duration (default 60)",
      "",
      "  start <sprintId>",
      "           Transition a pending sprint to running.",
      "",
      "  status <sprintId>",
      "           Print the sprint's SprintStatusView as JSON.",
      "",
      "  abort <sprintId> [--reason <text>]",
      "           Abort a running or closing sprint.",
      "",
      "  list [--limit 10]",
      "           List the most recent sprints.",
      "",
      "  logs <sprintId> [--tail 50]",
      "           Print the tail of the sprint's log.md.",
      "",
      "Examples:",
      "  npm run sprint -- create \\",
      "    --roles tech_lead,senior_dev,qa_engineer,security_engineer \\",
      "    --personas student_sharer,adversarial_probe \\",
      "    --duration 60 \\",
      '    --goals "Audit admin routes,Run a11y sweep" \\',
      "    --branch mainline \\",
      "    --created-by 507f1f77bcf86cd799439011",
      "",
      "  npm run sprint -- list",
      "  npm run sprint -- start 6555aae7...",
      "  npm run sprint -- status 6555aae7...",
      "",
      "Preflight check:",
      "  npm run sprint:precheck",
      "",
      "See SPRINT_RUNBOOK.md for the full launch checklist.",
    ].join("\n"),
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (
    parsed.command === "" ||
    parsed.command === "help" ||
    parsed.command === "--help" ||
    parsed.command === "-h"
  ) {
    printHelp();
    return;
  }

  // Fail fast when env isn't loadable — every command below needs it.
  try {
    await loadEnv();
  } catch (err) {
    fail(
      `env load failed: ${err instanceof Error ? err.message : String(err)}`,
      "Run `npm run sprint:precheck` for a detailed diagnosis.",
    );
  }

  try {
    switch (parsed.command) {
      case "create":
        await cmdCreate(parsed);
        break;
      case "start":
        await cmdStart(parsed);
        break;
      case "abort":
        await cmdAbort(parsed);
        break;
      case "status":
        await cmdStatus(parsed);
        break;
      case "list":
        await cmdList(parsed);
        break;
      case "logs":
        await cmdLogs(parsed);
        break;
      default:
        fail(
          `unknown command "${parsed.command}"`,
          "Run `npm run sprint -- help` for usage.",
        );
    }
  } catch (err) {
    if (err instanceof CliError) {
      fail(err.message, err.hint);
    } else if (err instanceof Error) {
      // SprintRunnerError has a `code` field; surface it when present.
      const code = (err as { code?: string }).code;
      fail(code ? `${code}: ${err.message}` : err.message);
    } else {
      fail(String(err));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("CLI crashed:", err);
    process.exit(99);
  });
