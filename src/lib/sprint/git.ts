/**
 * Auto_Commit — safety-critical git wrapper for the Virtual Team Sprint Runner.
 *
 * This module is the *only* place in the sprint runner that is permitted to
 * mutate the git working tree. Its public surface is deliberately narrow and
 * enforces the invariants described in design.md ("Auto_Commit" section) plus
 * Property 12 ("Auto_Commit never pushes to a remote and never modifies the
 * user's current branch"):
 *
 *   1. No `git push`, ever. `push`, `push --force`, `remote add`, and
 *      `remote set-url` are not exposed on the public API, and every raw
 *      command is pre-screened for these tokens before being handed to
 *      simple-git. Violations throw `GitSafetyError` and are recorded on
 *      the wrapper so tests can assert the invariant.
 *
 *   2. The user's originally-checked-out branch is captured at construction
 *      time (via `git rev-parse --abbrev-ref HEAD`) and is never rewritten.
 *      Operations that would check out anything other than the original
 *      branch or a `sprint/<sprintId>/fix-<id>` branch (or `mainline`, for
 *      `mergeToMainline`) are rejected.
 *
 *   3. Fix commits land exclusively on branches matching
 *      `^sprint/[0-9a-f]{24}/fix-.+$`. The branch is created off the
 *      original HEAD on first use.
 *
 *   4. If `commitFix` throws after files have already been written, the
 *      wrapper restores the touched paths via `git checkout -- <path>` so
 *      the working tree is not left dirty on the user's branch.
 *
 * _Requirements: 6.2, 6.7, 6.8, 6.9, 9.6, 9.7_
 */

import { constants as fsConstants } from "node:fs";
import {
  access,
  mkdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { simpleGit, type SimpleGit } from "simple-git";

import type { FileChange, SprintError } from "@/lib/sprint/types";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/**
 * Raised whenever the wrapper detects a Property-12 violation: a push,
 * a remote-add/set-url, an attempt to check out an unauthorised branch,
 * or a failed `git apply` during `applyFileChanges`.
 *
 * The `sprintError` field is the structured form consumed by the
 * coordinator's error-logging layer.
 */
export class GitSafetyError extends Error {
  readonly sprintError: Extract<SprintError, { code: "GIT_SAFETY_VIOLATION" }>;

  constructor(attempted: string, message?: string) {
    super(message ?? `Git safety violation: ${attempted}`);
    this.name = "GitSafetyError";
    this.sprintError = { code: "GIT_SAFETY_VIOLATION", attempted };
  }
}

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface CommitFixInput {
  /** Branch to commit on; must match the fix-branch regex. */
  readonly branch: string;
  /** Human-facing fix proposal id, e.g. "P-abc123-7". */
  readonly fixProposalId: string;
  /** 24-char hex Mongo ObjectId of the sprint. */
  readonly sprintId: string;
  /** Finding ids linked to this fix (e.g. ["F-abc123-1", ...]). */
  readonly findingIds: readonly string[];
  /**
   * Human-readable finding titles, used to build the commit subject.
   * Only the first title is rendered (truncated to 72 chars); remaining
   * titles are ignored intentionally to keep subject lines tight.
   */
  readonly findingTitles: readonly string[];
  /** Result of each Verification_Gate step for the `Verified:` trailer. */
  readonly verification: VerificationSummary;
  /**
   * Optional list of changes that were applied before the commit.
   * When provided, a failure in `git commit` will roll them back via
   * `git checkout -- <path>` so the working tree is left clean.
   */
  readonly changes?: readonly FileChange[];
}

export interface VerificationSummary {
  readonly vitest: VerificationStatus;
  readonly "next-lint": VerificationStatus;
  readonly tsc: VerificationStatus;
  readonly playwright: VerificationStatus;
}

export type VerificationStatus = "pass" | "fail" | "skipped" | "timeout";

export interface SprintGit {
  /** The originally-checked-out branch, captured at construction. */
  readonly originalBranch: string;

  /** Create `sprint/<sprintId>/fix-<fixProposalId>` off the original HEAD and check it out. */
  createFixBranch(sprintId: string, fixProposalId: string): Promise<string>;

  /** Apply the given `FileChange` entries onto the currently-checked-out sprint branch. */
  applyFileChanges(
    branch: string,
    changes: readonly FileChange[],
  ): Promise<void>;

  /** Stage and commit with a conventional-commit message + trailers. Returns the SHA. */
  commitFix(input: CommitFixInput): Promise<string>;

  /** Merge the fix branch into `mainline` locally. Returns the resulting HEAD SHA. */
  mergeToMainline(branch: string, strategy: "ff" | "squash"): Promise<string>;

  /** Create a revert commit on the sprint branch. Returns the new SHA. */
  revert(branch: string, sha: string): Promise<string>;

  /** Throws `GitSafetyError` if the current HEAD does not point at `branch`. */
  assertOnSprintBranch(branch: string): Promise<void>;

  /** Throws `GitSafetyError` if any push/remote-mutation attempt has been intercepted. */
  assertNoRemotePushAttempted(): Promise<void>;

  /** Roll back a failed write by running `git checkout -- <path>` for every change. */
  restoreFileChanges(changes: readonly FileChange[]): Promise<void>;

  /** Read-only snapshot of intercepted push/remote attempts, for Property-12 tests. */
  getInterceptedAttempts(): readonly string[];
}

export interface CreateSprintGitOptions {
  /** Override for the repo path; defaults to `process.cwd()`. */
  readonly cwd?: string;
  /** Inject a pre-built simple-git instance for tests (bypasses shelling out). */
  readonly git?: SimpleGit;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Regex: `sprint/<24-hex>/fix-<anything non-empty>`. */
const SPRINT_BRANCH_RE = /^sprint\/[0-9a-f]{24}\/fix-.+$/;

/** Regex: 24-char lowercase hex Mongo ObjectId. */
const OBJECT_ID_RE = /^[0-9a-f]{24}$/;

/** Branch that `mergeToMainline` merges into. */
const MAINLINE_BRANCH = "mainline";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function createSprintGit(
  options: CreateSprintGitOptions = {},
): Promise<SprintGit> {
  const cwd = options.cwd ?? process.cwd();
  const git = options.git ?? simpleGit({ baseDir: cwd });

  // Capture the user's current branch at construction time. This is the
  // branch that must remain untouched for Property 12.
  const originalBranch = (
    await git.revparse(["--abbrev-ref", "HEAD"])
  ).trim();

  if (!originalBranch || originalBranch === "HEAD") {
    throw new GitSafetyError(
      "detached_head",
      "Cannot start Auto_Commit with a detached HEAD; check out a branch first.",
    );
  }

  return new SprintGitImpl(git, cwd, originalBranch);
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

class SprintGitImpl implements SprintGit {
  readonly originalBranch: string;

  private readonly git: SimpleGit;
  private readonly cwd: string;
  private readonly interceptedAttempts: string[] = [];

  constructor(git: SimpleGit, cwd: string, originalBranch: string) {
    this.git = git;
    this.cwd = cwd;
    this.originalBranch = originalBranch;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async createFixBranch(
    sprintId: string,
    fixProposalId: string,
  ): Promise<string> {
    if (!OBJECT_ID_RE.test(sprintId)) {
      throw new GitSafetyError(
        "invalid_sprint_id",
        `sprintId must be a 24-char hex ObjectId, got "${sprintId}".`,
      );
    }
    if (!fixProposalId || /\s/.test(fixProposalId)) {
      throw new GitSafetyError(
        "invalid_fix_proposal_id",
        `fixProposalId must be a non-empty whitespace-free string.`,
      );
    }

    const branch = `sprint/${sprintId}/fix-${fixProposalId}`;
    this.assertFixBranchName(branch);

    // Branch off the original HEAD. `checkoutLocalBranch` runs
    // `git checkout -b <branch>` which only creates a local branch —
    // no remote interaction.
    await this.git.checkoutLocalBranch(branch);
    return branch;
  }

  async applyFileChanges(
    branch: string,
    changes: readonly FileChange[],
  ): Promise<void> {
    this.assertFixBranchName(branch);
    await this.assertOnSprintBranch(branch);

    for (const change of changes) {
      this.assertRepoRelative(change.path);

      switch (change.operation) {
        case "create":
          await this.writeCreate(change);
          break;
        case "modify":
          await this.applyModifyDiff(change);
          break;
        case "delete":
          await this.applyDelete(change);
          break;
        default:
          throw new GitSafetyError(
            "unknown_operation",
            `Unknown FileChange.operation: ${
              (change as { operation?: string }).operation ?? "undefined"
            }`,
          );
      }
    }
  }

  async commitFix(input: CommitFixInput): Promise<string> {
    this.assertFixBranchName(input.branch);
    if (!OBJECT_ID_RE.test(input.sprintId)) {
      throw new GitSafetyError(
        "invalid_sprint_id",
        `sprintId must be a 24-char hex ObjectId, got "${input.sprintId}".`,
      );
    }
    await this.assertOnSprintBranch(input.branch);

    const subject = buildCommitSubject(input.findingTitles);
    const body = buildCommitBody(input);

    const paths = input.changes?.map((c) => c.path) ?? [];

    try {
      // Stage only the changed paths explicitly. Fall back to staging the
      // whole tree if no paths were supplied so a caller that pre-staged
      // can still get a commit.
      if (paths.length > 0) {
        await this.git.add(paths);
      } else {
        await this.git.add(["."]);
      }

      // Passing a string[] as the message sends one `-m` per entry,
      // keeping the subject and body as separate paragraphs. `commit`
      // is not intercepted by `safeRaw` because it is an allow-listed
      // non-remote operation.
      await this.git.commit([subject, body], paths);

      const sha = (await this.git.revparse(["HEAD"])).trim();
      return sha;
    } catch (err) {
      // Property-12: if the commit fails after files were written, make
      // sure the working tree is restored so HEAD is not left dirty —
      // this is especially important when HEAD happens to be back on
      // the user's original branch.
      if (input.changes && input.changes.length > 0) {
        try {
          await this.restoreFileChanges(input.changes);
        } catch {
          // Swallow restore errors; the original failure is more useful
          // and will be rethrown below.
        }
      }
      throw err;
    }
  }

  async mergeToMainline(
    branch: string,
    strategy: "ff" | "squash",
  ): Promise<string> {
    this.assertFixBranchName(branch);

    // `mergeToMainline` is the single code-path that checks out a branch
    // other than a fix branch. It is only safe when the user's original
    // branch *is* `mainline`, otherwise the operation would mutate a
    // branch that is not the configured merge target.
    if (this.originalBranch !== MAINLINE_BRANCH) {
      throw new GitSafetyError(
        "merge_requires_mainline_origin",
        `mergeToMainline requires originalBranch to be "${MAINLINE_BRANCH}", ` +
          `got "${this.originalBranch}".`,
      );
    }

    // Checkout mainline. Allowed because the target equals originalBranch.
    await this.git.checkout(MAINLINE_BRANCH);

    if (strategy === "ff") {
      await this.safeRaw(["merge", "--ff-only", branch]);
    } else {
      await this.safeRaw(["merge", "--squash", branch]);
      await this.git.commit([
        `fix(sprint): squash merge ${branch}`,
        `Fix-Branch: ${branch}`,
      ]);
    }

    return (await this.git.revparse(["HEAD"])).trim();
  }

  async revert(branch: string, sha: string): Promise<string> {
    this.assertFixBranchName(branch);
    await this.assertOnSprintBranch(branch);

    if (!/^[0-9a-f]{7,40}$/.test(sha)) {
      throw new GitSafetyError(
        "invalid_sha",
        `revert target must be a hex SHA, got "${sha}".`,
      );
    }

    await this.safeRaw(["revert", "--no-edit", sha]);
    return (await this.git.revparse(["HEAD"])).trim();
  }

  async assertOnSprintBranch(branch: string): Promise<void> {
    this.assertFixBranchName(branch);
    const head = (await this.git.revparse(["--abbrev-ref", "HEAD"])).trim();
    if (head !== branch) {
      throw new GitSafetyError(
        "wrong_branch",
        `Expected HEAD to be on "${branch}" but got "${head}".`,
      );
    }
  }

  async assertNoRemotePushAttempted(): Promise<void> {
    if (this.interceptedAttempts.length > 0) {
      throw new GitSafetyError(
        "push_attempted",
        `Intercepted ${this.interceptedAttempts.length} remote-mutation attempt(s): ` +
          this.interceptedAttempts.join("; "),
      );
    }
  }

  async restoreFileChanges(changes: readonly FileChange[]): Promise<void> {
    for (const change of changes) {
      this.assertRepoRelative(change.path);
      try {
        // `git checkout -- <path>` restores the path's worktree entry to
        // the index (i.e. throws away uncommitted edits). For `create`
        // operations there is no index entry yet, so we fall back to
        // removing the file from disk.
        await this.safeRaw(["checkout", "--", change.path]);
      } catch {
        if (change.operation === "create") {
          const abs = path.resolve(this.cwd, change.path);
          await rm(abs, { force: true });
        }
      }
    }
  }

  getInterceptedAttempts(): readonly string[] {
    return [...this.interceptedAttempts];
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * The single choke-point for every raw command. Anything matching a
   * banned pattern is recorded on `interceptedAttempts` and rejected
   * before simple-git sees it.
   */
  private async safeRaw(args: readonly string[]): Promise<string> {
    const violation = detectSafetyViolation(args);
    if (violation) {
      this.interceptedAttempts.push(`${violation}: ${args.join(" ")}`);
      throw new GitSafetyError(violation);
    }
    return this.git.raw([...args]);
  }

  private assertFixBranchName(branch: string): void {
    if (!SPRINT_BRANCH_RE.test(branch)) {
      throw new GitSafetyError(
        "invalid_branch",
        `Branch "${branch}" does not match ${SPRINT_BRANCH_RE}.`,
      );
    }
  }

  /**
   * Reject absolute paths and any attempt to escape the repo root via
   * `..` segments. All `FileChange.path` values are contract-obliged to
   * be repo-relative; we enforce that here rather than trusting callers.
   */
  private assertRepoRelative(p: string): void {
    if (!p || path.isAbsolute(p) || p.startsWith("/") || p.startsWith("\\")) {
      throw new GitSafetyError(
        "invalid_path",
        `FileChange.path must be repo-relative, got "${p}".`,
      );
    }
    const resolved = path.resolve(this.cwd, p);
    const rel = path.relative(this.cwd, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new GitSafetyError(
        "path_escapes_repo",
        `FileChange.path "${p}" resolves outside the repo root.`,
      );
    }
  }

  private async writeCreate(change: FileChange): Promise<void> {
    const abs = path.resolve(this.cwd, change.path);
    await mkdir(path.dirname(abs), { recursive: true });
    // `create` treats `diff` as the full intended file content per the
    // design note in task 8.1.
    await writeFile(abs, change.diff, "utf8");
  }

  private async applyDelete(change: FileChange): Promise<void> {
    const abs = path.resolve(this.cwd, change.path);
    try {
      await access(abs, fsConstants.F_OK);
    } catch {
      // Already missing — nothing to remove on disk, but we still let
      // simple-git's `rm` reconcile the index.
    }
    await this.git.rm([change.path]);
  }

  private async applyModifyDiff(change: FileChange): Promise<void> {
    const patchPath = path.join(
      tmpdir(),
      `sprint-fix-${randomUUID()}.patch`,
    );
    try {
      await writeFile(patchPath, change.diff, "utf8");
      try {
        await this.safeRaw(["apply", "--whitespace=nowarn", patchPath]);
      } catch (err) {
        throw new GitSafetyError(
          "failed_apply",
          `git apply failed for "${change.path}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    } finally {
      await unlink(patchPath).catch(() => {
        /* ignore temp-file cleanup failures */
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Inspect a raw-command argv vector and return a short violation tag
 * if it would cross the Property-12 safety boundary, otherwise `null`.
 *
 * Banned shapes:
 *   - `push ...`              (any push, including `push --force*`)
 *   - `... --force ...`       when combined with push-like verbs
 *   - `... --force-with-lease ...`
 *   - `remote add ...`
 *   - `remote set-url ...`
 */
export function detectSafetyViolation(
  args: readonly string[],
): string | null {
  if (args.length === 0) return null;

  const [first, second] = args;

  if (first === "push") return "push";

  if (first === "remote" && (second === "add" || second === "set-url")) {
    return `remote_${second}`;
  }

  // `--force` / `-f` are only dangerous combined with a push. We still
  // reject them outright on raw commands because no legitimate sprint
  // operation needs them.
  if (
    args.includes("--force") ||
    args.includes("--force-with-lease") ||
    (args.includes("-f") && args.includes("push"))
  ) {
    return "force_flag";
  }

  return null;
}

/**
 * Build the conventional-commit subject from the first linked finding
 * title, truncated to 72 characters including the `fix(sprint): ` prefix.
 */
export function buildCommitSubject(
  findingTitles: readonly string[],
): string {
  const prefix = "fix(sprint): ";
  const rawTitle =
    findingTitles.length > 0 && findingTitles[0].trim().length > 0
      ? findingTitles[0].trim()
      : "apply verified sprint fix";

  // Keep the rendered subject <= 72 chars; leave room for the prefix.
  const available = 72 - prefix.length;
  const truncated =
    rawTitle.length > available ? rawTitle.slice(0, available) : rawTitle;
  return `${prefix}${truncated}`;
}

/**
 * Build the commit body with the four trailers required by the design:
 *
 *   Fix-Proposal: <fixProposalId>
 *   Finding-Ids:  <comma-separated>
 *   Sprint-Id:    <24-char hex>
 *   Verified:     vitest=pass next-lint=pass tsc=pass playwright=<status>
 */
export function buildCommitBody(input: {
  readonly fixProposalId: string;
  readonly sprintId: string;
  readonly findingIds: readonly string[];
  readonly verification: VerificationSummary;
}): string {
  const { vitest, tsc, playwright } = input.verification;
  const nextLint = input.verification["next-lint"];
  const verified =
    `vitest=${vitest} next-lint=${nextLint} ` +
    `tsc=${tsc} playwright=${playwright}`;

  return [
    `Fix-Proposal: ${input.fixProposalId}`,
    `Finding-Ids: ${input.findingIds.join(",")}`,
    `Sprint-Id: ${input.sprintId}`,
    `Verified: ${verified}`,
  ].join("\n");
}
