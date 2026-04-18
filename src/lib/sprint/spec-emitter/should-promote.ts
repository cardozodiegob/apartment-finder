/**
 * Pure predicate and name derivation for the Kiro_Spec_Emitter.
 *
 * The emitter is triggered for a FixProposal when any of:
 *   - the proposal touches more than 10 files, OR
 *   - total changed lines (added + removed) exceeds 500, OR
 *   - any linked finding has category=`security` and severity=`critical`
 *
 * Requirements: 11.1, 11.2, 11.6
 */

import type { FindingCategory, FindingSeverity } from "../types";

// ---------------------------------------------------------------------------
// shouldPromoteToSpec
// ---------------------------------------------------------------------------

/** Minimal FixProposal shape needed by the predicate. */
export interface PromoteProposalInput {
  readonly fileChanges: ReadonlyArray<{
    readonly addedLines: number;
    readonly removedLines: number;
  }>;
  readonly findingIds: readonly string[];
}

/** Minimal Finding shape needed by the predicate. */
export interface PromoteFindingInput {
  readonly id: string;
  readonly category: FindingCategory;
  readonly severity: FindingSeverity;
}

/** Reason tag on a positive decision, for use in logs and the retrospective. */
export type PromoteReason =
  | "file_count"
  | "line_count"
  | "critical_security";

/** Result returned by {@link shouldPromoteToSpec}. */
export type PromoteDecision =
  | { readonly promote: true; readonly reason: PromoteReason }
  | { readonly promote: false };

/**
 * Decide whether a FixProposal should be promoted to a new `.kiro/specs/`
 * entry instead of being auto-committed.
 *
 * Precedence (first match wins, for clearer retrospective messaging):
 *   1. `critical_security` — a linked finding is a critical security issue
 *   2. `file_count` — fileChanges.length > 10
 *   3. `line_count` — total changed lines > 500
 */
export function shouldPromoteToSpec(
  fp: PromoteProposalInput,
  findings: readonly PromoteFindingInput[],
): PromoteDecision {
  const linkedIds = new Set(fp.findingIds);
  const hasCriticalSecurity = findings.some(
    (f) =>
      linkedIds.has(f.id) &&
      f.category === "security" &&
      f.severity === "critical",
  );
  if (hasCriticalSecurity) {
    return { promote: true, reason: "critical_security" };
  }

  if (fp.fileChanges.length > 10) {
    return { promote: true, reason: "file_count" };
  }

  const lineCount = fp.fileChanges.reduce(
    (n, c) => n + c.addedLines + c.removedLines,
    0,
  );
  if (lineCount > 500) {
    return { promote: true, reason: "line_count" };
  }

  return { promote: false };
}

// ---------------------------------------------------------------------------
// deriveSpecName
// ---------------------------------------------------------------------------

/**
 * Convert an arbitrary title into a kebab-case slug suitable for use as
 * a directory name under `.kiro/specs/`.
 *
 * Rules:
 *   - lower-case
 *   - non-alphanumeric runs collapse to a single hyphen
 *   - leading/trailing hyphens stripped
 *   - empty / hyphen-only result falls back to `untitled`
 */
function kebabCase(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "untitled" : slug;
}

/**
 * Derive a unique kebab-case spec path from a proposal title, appending
 * `-2`, `-3`, ... if needed to avoid colliding with any entry in
 * `existingPaths`.
 *
 * `existingPaths` entries may be either a bare slug (e.g. `"my-fix"`)
 * or a full `.kiro/specs/<slug>` path — we compare on the trailing
 * path segment only, so callers can pass whichever form is convenient.
 *
 * Pure function; does not touch the filesystem.
 */
export function deriveSpecName(
  title: string,
  existingPaths: readonly string[] = [],
): string {
  const base = kebabCase(title);
  const takenSlugs = new Set<string>(
    existingPaths
      .map((p) => {
        const trimmed = p.replace(/\/+$/, "");
        const lastSlash = trimmed.lastIndexOf("/");
        return lastSlash === -1 ? trimmed : trimmed.slice(lastSlash + 1);
      })
      .filter((s) => s.length > 0),
  );

  if (!takenSlugs.has(base)) return base;

  // Walk forward in collision order: base-2, base-3, ...
  let suffix = 2;
  while (takenSlugs.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}
