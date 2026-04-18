/**
 * Sprint shared-markdown workspace writer.
 *
 * Backs `.kiro/sprints/<sprintId>/`: the append-only message bus that
 * agents use to communicate (Requirement 3). Invariants enforced here:
 *
 *   - Appends to the same absolute path are serialized by `async-mutex`.
 *   - A 2 MB per-file ceiling is enforced by rotating to
 *     `<filename>.part<N>.md` when the next block would overflow.
 *   - A running SHA-256 hash over every byte ever appended to a logical
 *     doc (spanning rotated parts) is maintained in a sidecar so it
 *     survives process restart.
 *   - Every successful `append` auto-writes a matching `log.md` entry,
 *     except when the target *is* `log.md` (no recursive self-log).
 *   - Non-append mutations under the workspace root are rejected.
 *
 * Block-level schema validation is the caller's job; this module is the
 * raw byte-layer.
 */

import { Mutex } from "async-mutex";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  access,
  appendFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AppendOptions {
  /** Reporter shown in the log.md entry — agent role or persona. */
  readonly actor: string;
  /** Tool name recorded in the log.md entry (e.g. "workspace.append"). */
  readonly toolName: string;
}

export interface AppendResult {
  /** Repo-relative path actually written to. */
  readonly writtenToFile: string;
  readonly bytesWritten: number;
  /** Hex SHA-256 over the full logical doc after the append. */
  readonly cumulativeHash: string;
}

export type LogicalDocName =
  | "plan.md"
  | "log.md"
  | "findings.md"
  | "retrospective.md"
  | string;

export interface WorkspaceWriter {
  init(sprintId: string, meta?: { createdAt?: Date }): Promise<void>;
  read(logicalDocName: LogicalDocName): Promise<string>;
  append(
    logicalDocName: LogicalDocName,
    block: string,
    opts: AppendOptions,
  ): Promise<AppendResult>;
  createTicket(
    ticketId: string,
    body: string,
    opts: AppendOptions,
  ): Promise<AppendResult>;
}

export type WorkspaceErrorCode =
  | "APPEND_ONLY_VIOLATION"
  | "PATH_ESCAPES_WORKSPACE"
  | "NOT_INITIALIZED"
  | "DUPLICATE_TICKET"
  | "INVALID_NAME";

export class WorkspaceError extends Error {
  public readonly code: WorkspaceErrorCode;
  public constructor(code: WorkspaceErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Constants + sidecar shape
// ---------------------------------------------------------------------------

const MAX_PART_BYTES = 2 * 1024 * 1024; // 2 MB — Requirement 3.6
const HASH_SIDECAR = ".workspace-hash.json";
const TICKET_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const LOGICAL_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.md$/;
const SPRINT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

interface PartRecord {
  /** Basename, e.g. "plan.md" or "plan.part3.md". */
  file: string;
  /** Byte length currently written to this part. */
  bytes: number;
}

interface LogicalDocRecord {
  parts: PartRecord[];
  /** Hex SHA-256 over the concatenation of every byte ever appended. */
  cumulativeHash: string;
}

interface SidecarFile {
  sprintId: string;
  docs: Record<string, LogicalDocRecord>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * One writer instance per sprint. Mutexes live on the closure, keyed by
 * absolute path, so independent sprints never share a lock.
 */
export function createWorkspaceWriter(sprintId: string): WorkspaceWriter {
  if (!SPRINT_ID_RE.test(sprintId)) {
    throw new WorkspaceError(
      "INVALID_NAME",
      `Invalid sprintId: ${JSON.stringify(sprintId)}`,
    );
  }

  const workspaceRoot = path.resolve(
    process.cwd(),
    ".kiro",
    "sprints",
    sprintId,
  );
  const sidecarPath = path.join(workspaceRoot, HASH_SIDECAR);
  const mutexes = new Map<string, Mutex>();

  const mutexFor = (absPath: string): Mutex => {
    let m = mutexes.get(absPath);
    if (!m) {
      m = new Mutex();
      mutexes.set(absPath, m);
    }
    return m;
  };

  // --- path safety -------------------------------------------------------

  const resolveWithin = (relative: string): string => {
    const abs = path.resolve(workspaceRoot, relative);
    const rel = path.relative(workspaceRoot, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new WorkspaceError(
        "PATH_ESCAPES_WORKSPACE",
        `Path escapes workspace root: ${relative}`,
      );
    }
    return abs;
  };

  const validateLogicalName = (name: string): void => {
    if (!LOGICAL_NAME_RE.test(name)) {
      throw new WorkspaceError(
        "INVALID_NAME",
        `Invalid logical doc name: ${JSON.stringify(name)}`,
      );
    }
  };

  // --- sidecar -----------------------------------------------------------

  const readSidecar = async (): Promise<SidecarFile> => {
    try {
      const raw = await readFile(sidecarPath, "utf8");
      return JSON.parse(raw) as SidecarFile;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new WorkspaceError(
          "NOT_INITIALIZED",
          `Workspace not initialized at ${workspaceRoot}`,
        );
      }
      throw err;
    }
  };

  const writeSidecar = (data: SidecarFile): Promise<void> =>
    writeFile(sidecarPath, JSON.stringify(data, null, 2), "utf8");

  // --- part-file helpers -------------------------------------------------

  const partFileName = (logicalDocName: string, partIndex: number): string => {
    if (partIndex === 0) return logicalDocName;
    const base = logicalDocName.replace(/\.md$/, "");
    return `${base}.part${partIndex + 1}.md`;
  };

  /**
   * Low-level append that does NOT write a log entry. Used by both
   * `append` (which adds its own log entry afterwards) and `writeLogEntry`
   * (which must not recursively log itself).
   */
  const rawAppend = async (
    sidecar: SidecarFile,
    logicalDocName: string,
    block: string,
  ): Promise<{ result: AppendResult; sidecar: SidecarFile }> => {
    validateLogicalName(logicalDocName);
    const bytes = Buffer.byteLength(block, "utf8");

    const existing = sidecar.docs[logicalDocName];
    if (!existing) {
      throw new WorkspaceError(
        "NOT_INITIALIZED",
        `Logical doc ${logicalDocName} has no initialized part; call init() first`,
      );
    }

    // Pick the last part if it fits, otherwise rotate to a fresh part.
    const lastPart = existing.parts[existing.parts.length - 1];
    let targetPart: PartRecord;
    if (lastPart.bytes + bytes <= MAX_PART_BYTES) {
      targetPart = lastPart;
    } else {
      const nextName = partFileName(logicalDocName, existing.parts.length);
      await writeFile(resolveWithin(nextName), "", "utf8");
      targetPart = { file: nextName, bytes: 0 };
      existing.parts.push(targetPart);
    }

    const targetAbs = resolveWithin(targetPart.file);
    await appendFile(targetAbs, block, "utf8");
    targetPart.bytes += bytes;

    // Cumulative hash = sha256 of the concatenation of every part. Recomputed
    // from disk so the stored value is always the canonical content hash.
    // Parts are capped at 2 MB so this is bounded.
    const hasher = createHash("sha256");
    for (const part of existing.parts) {
      hasher.update(await readFile(resolveWithin(part.file)));
    }
    existing.cumulativeHash = hasher.digest("hex");

    return {
      result: {
        writtenToFile: path.relative(process.cwd(), targetAbs),
        bytesWritten: bytes,
        cumulativeHash: existing.cumulativeHash,
      },
      sidecar,
    };
  };

  // --- init --------------------------------------------------------------

  const init = async (
    sprintIdArg: string,
    meta: { createdAt?: Date } = {},
  ): Promise<void> => {
    if (sprintIdArg !== sprintId) {
      throw new WorkspaceError(
        "INVALID_NAME",
        `init() sprintId mismatch: "${sprintIdArg}" vs "${sprintId}"`,
      );
    }
    await mkdir(workspaceRoot, { recursive: true });
    const createdAt = (meta.createdAt ?? new Date()).toISOString();

    const initial: Record<string, string> = {
      "plan.md":
        `# Sprint ${sprintId} — Plan\n\nCreated: ${createdAt}\n\n` +
        `## Sprint Goals\n\n(populated by tech_lead)\n\n## Tickets\n\n`,
      "log.md": `# Sprint ${sprintId} — Log\n\nCreated: ${createdAt}\n\n`,
      "findings.md": `# Sprint ${sprintId} — Findings\n\nCreated: ${createdAt}\n\n`,
      "retrospective.md":
        `# Sprint ${sprintId} — Retrospective\n\n(written at sprint close)\n\n`,
    };

    const sidecar: SidecarFile = { sprintId, docs: {} };
    for (const [name, header] of Object.entries(initial)) {
      await writeFile(resolveWithin(name), header, "utf8");
      sidecar.docs[name] = {
        parts: [{ file: name, bytes: Buffer.byteLength(header, "utf8") }],
        cumulativeHash: createHash("sha256").update(header, "utf8").digest("hex"),
      };
    }
    await writeSidecar(sidecar);
  };

  // --- read (concatenates all parts) ------------------------------------

  const read = async (logicalDocName: LogicalDocName): Promise<string> => {
    validateLogicalName(logicalDocName);
    const sidecar = await readSidecar();
    const record = sidecar.docs[logicalDocName];
    if (!record) {
      throw new WorkspaceError(
        "NOT_INITIALIZED",
        `Logical doc ${logicalDocName} does not exist`,
      );
    }
    const parts: string[] = [];
    for (const part of record.parts) {
      parts.push(await readFile(resolveWithin(part.file), "utf8"));
    }
    return parts.join("");
  };

  // --- log-only append (bypasses the append-triggers-log rule) ----------

  const writeLogEntry = async (
    sidecar: SidecarFile,
    opts: AppendOptions,
    logicalDocName: string,
    bytesWritten: number,
  ): Promise<SidecarFile> => {
    const entry = `[${new Date().toISOString()}] ${opts.actor}: ${opts.toolName} -> ${logicalDocName} (+${bytesWritten}B)\n`;
    const { sidecar: updated } = await rawAppend(sidecar, "log.md", entry);
    return updated;
  };

  // --- append (serialized; always emits one log entry except for log) ---

  const append = async (
    logicalDocName: LogicalDocName,
    block: string,
    opts: AppendOptions,
  ): Promise<AppendResult> => {
    validateLogicalName(logicalDocName);
    if (block.length === 0) {
      throw new WorkspaceError(
        "APPEND_ONLY_VIOLATION",
        "Cannot append an empty block",
      );
    }

    const primaryMutex = mutexFor(resolveWithin(logicalDocName));
    const logMutex = mutexFor(resolveWithin("log.md"));
    const isLogDoc = logicalDocName === "log.md";

    return primaryMutex.runExclusive(async () => {
      const sidecar = await readSidecar();
      const { result } = await rawAppend(sidecar, logicalDocName, block);

      if (isLogDoc) {
        // Appending to log.md itself: no recursive log entry.
        await writeSidecar(sidecar);
        return result;
      }

      // Lock order is always (primary, log) so this cannot deadlock.
      const updated = await logMutex.runExclusive(() =>
        writeLogEntry(sidecar, opts, logicalDocName, result.bytesWritten),
      );
      await writeSidecar(updated);
      return result;
    });
  };

  // --- createTicket ------------------------------------------------------

  const createTicket = async (
    ticketId: string,
    body: string,
    opts: AppendOptions,
  ): Promise<AppendResult> => {
    if (!TICKET_ID_RE.test(ticketId)) {
      throw new WorkspaceError(
        "INVALID_NAME",
        `Invalid ticketId: ${JSON.stringify(ticketId)}`,
      );
    }

    await mkdir(resolveWithin("tickets"), { recursive: true });
    const ticketAbs = resolveWithin(path.join("tickets", `${ticketId}.md`));

    // Per Requirement 3.8, overwriting an existing ticket is forbidden.
    try {
      await access(ticketAbs, fsConstants.F_OK);
      throw new WorkspaceError(
        "DUPLICATE_TICKET",
        `Ticket already exists: ${ticketId}`,
      );
    } catch (err) {
      if (err instanceof WorkspaceError) throw err;
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }

    await writeFile(ticketAbs, body, "utf8");
    // Append the reference line to plan.md via the normal append path so
    // the log entry + hash update happen automatically.
    return append(
      "plan.md",
      `- [tickets/${ticketId}.md](tickets/${ticketId}.md)\n`,
      opts,
    );
  };

  return { init, read, append, createTicket };
}
