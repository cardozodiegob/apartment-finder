/**
 * Shared helpers for the security_engineer Agent's scan tools.
 *
 * Keeps glob-matching, the recursive file walker, skipped-directory
 * conventions, line-number-from-index, and raw-output persistence in a
 * single place so `security.scan_sast`, `security.scan_secrets`, and
 * `security.review_diff` don't each reinvent them.
 *
 * Requirements: 7.1, 7.3, 7.4, 7.5, 7.8
 */

import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Directory-skip list
// ---------------------------------------------------------------------------

/**
 * Directories skipped by every tree walk. Keep this list narrow and
 * deterministic — agents read the output and need it to be stable.
 */
export const SKIPPED_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  ".next",
  ".kiro",
  "build",
  "dist",
  "coverage",
  ".turbo",
  ".vercel",
  ".cache",
]);

/** Files larger than this are skipped to avoid loading assets. */
export const MAX_SCANNABLE_BYTES = 1024 * 1024;

// ---------------------------------------------------------------------------
// Glob → RegExp
// ---------------------------------------------------------------------------

/**
 * Compile a minimal glob pattern to a RegExp.
 *
 * Supported syntax:
 *   - `{a,b,c}`  → alternation
 *   - `**`       → any number of path segments (incl. `/`)
 *   - `*`        → any characters except `/`
 *   - `?`        → any single character except `/`
 *
 * Any other regex metacharacter in `pattern` is escaped.
 */
export function globToRegex(pattern: string): RegExp {
  // 1. Expand `{a,b,c}` to `(a|b|c)` before escaping — braces aren't
  //    regex meta-characters themselves, but `,` and the inner content
  //    need grouping.
  const braced = pattern.replace(/\{([^}]+)\}/g, (_, inner: string) => {
    const parts = inner.split(",").map((s) => s.trim());
    return `__GROUP_OPEN__${parts.join("__GROUP_PIPE__")}__GROUP_CLOSE__`;
  });

  // 2. Escape regex meta-characters. `*` and `?` are handled below so we
  //    deliberately leave them in place here.
  const escaped = braced.replace(/[.+^$()|[\]\\]/g, "\\$&");

  // 3. Expand glob wildcards. `**` must be handled before single `*`.
  const expanded = escaped
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]");

  // 4. Restore the placeholder group markers.
  const restored = expanded
    .replace(/__GROUP_OPEN__/g, "(")
    .replace(/__GROUP_PIPE__/g, "|")
    .replace(/__GROUP_CLOSE__/g, ")");

  return new RegExp(`^${restored}$`);
}

// ---------------------------------------------------------------------------
// File walker
// ---------------------------------------------------------------------------

export interface WalkResult {
  /** Absolute path on disk. */
  absolutePath: string;
  /** Path relative to the walk root, using forward slashes. */
  relativePath: string;
  /** Size in bytes (zero when the entry failed to stat). */
  sizeBytes: number;
}

/**
 * Recursively walk a directory, skipping entries in {@link SKIPPED_DIRS}
 * and symlinks. Results are emitted in a stable, lexicographic order so
 * downstream scans are reproducible.
 */
export async function walkFiles(rootAbsolutePath: string): Promise<WalkResult[]> {
  const results: WalkResult[] = [];

  async function visit(currentAbs: string): Promise<void> {
    // Using readdir with withFileTypes: true — types vary between @types/node
    // releases so we annotate locally instead of relying on the typedef.
    let entries: import("fs").Dirent[] = [];
    try {
      entries = (await readdir(currentAbs, { withFileTypes: true })) as unknown as import("fs").Dirent[];
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (SKIPPED_DIRS.has(entry.name)) continue;
        await visit(path.join(currentAbs, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const abs = path.join(currentAbs, entry.name);
      let sizeBytes = 0;
      try {
        const st = await stat(abs);
        sizeBytes = st.size;
      } catch {
        continue;
      }
      const rel = path
        .relative(rootAbsolutePath, abs)
        .split(path.sep)
        .join("/");
      results.push({
        absolutePath: abs,
        relativePath: rel,
        sizeBytes,
      });
    }
  }

  await visit(rootAbsolutePath);
  return results;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Compute the 1-based line number of a byte offset within the given
 * content by counting preceding newlines.
 */
export function lineNumberFromIndex(content: string, index: number): number {
  if (index <= 0) return 1;
  const prefix = content.slice(0, index);
  let count = 1;
  for (let i = 0; i < prefix.length; i++) {
    if (prefix.charCodeAt(i) === 10) count++;
  }
  return count;
}

/** Truncate a string for safe inclusion in finding descriptions. */
export function truncate(value: string, max = 160): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

/**
 * Persist the raw output of a security scan to
 * `.kiro/sprints/<sprintId>/security/<fileName>` and return the
 * repo-relative path.
 */
export async function writeSecurityScanOutput(
  sprintId: string,
  fileName: string,
  data: unknown,
): Promise<string> {
  const dir = path.join(
    process.cwd(),
    ".kiro",
    "sprints",
    sprintId,
    "security",
  );
  await mkdir(dir, { recursive: true });
  const abs = path.join(dir, fileName);
  const serialized = JSON.stringify(data, null, 2);
  await writeFile(abs, serialized, "utf8");
  return path
    .relative(process.cwd(), abs)
    .split(path.sep)
    .join("/");
}

/**
 * Apply a compiled regex repeatedly to `content`, returning every match
 * together with its 1-based line number. `regex` MUST include the `g`
 * flag; callers assemble it from the rule's `regex`/`regexFlags`.
 */
export interface RegexHit {
  matchText: string;
  index: number;
  line: number;
}

export function collectRegexHits(content: string, regex: RegExp): RegexHit[] {
  const hits: RegexHit[] = [];
  if (!regex.global) {
    // Ensure global so we can iterate.
    regex = new RegExp(regex.source, `${regex.flags}g`);
  }
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = regex.exec(content)) !== null) {
    const index = m.index;
    hits.push({
      matchText: m[0],
      index,
      line: lineNumberFromIndex(content, index),
    });
    // Guard against zero-width matches that would spin forever.
    if (m.index === regex.lastIndex) {
      regex.lastIndex = m.index + 1;
    }
  }
  return hits;
}
