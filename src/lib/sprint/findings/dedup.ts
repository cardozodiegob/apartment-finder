/**
 * Finding deduplication signature and id generator.
 *
 * - {@link computeDedupSignature} canonicalises a `(category, title,
 *   reproductionSteps)` triple and hashes it with SHA-256. Two findings in
 *   the same sprint with identical triples collapse to one persisted
 *   record whose `duplicateCount` is bumped (Requirement 5.7).
 * - {@link generateFindingId} produces the human-facing `F-<short>-<seq>`
 *   id used throughout the admin UI and in `findings.md` (Requirement 5.3).
 *
 * Pure functions, no I/O.
 *
 * Requirements: 5.1, 5.3, 5.6, 5.7
 */

import { createHash } from "node:crypto";

import type { FindingCategory } from "../types";

/** Input shape consumed by {@link computeDedupSignature}. */
export interface DedupSignatureInput {
  readonly category: FindingCategory;
  readonly title: string;
  readonly reproductionSteps: readonly string[];
}

/**
 * Compute a stable SHA-256 digest (hex) over the canonical form
 *
 *   category \n trimmed-title \n trimmed-step-1 \n trimmed-step-2 ...
 *
 * Trimming each step and joining with `\n` normalises incidental
 * whitespace differences so two agents submitting the "same" finding
 * collapse to one record even when copy-paste adds stray spaces.
 */
export function computeDedupSignature(input: DedupSignatureInput): string {
  const canonical = [
    input.category,
    input.title.trim(),
    ...input.reproductionSteps.map((s) => s.trim()),
  ].join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Produce a sprint-scoped finding id of the form `F-<sprint_short>-<n>`.
 *
 * `sprint_short` is the first 6 hex characters of the sprint's Mongo
 * ObjectId (lower-cased). `sequence` is the monotonic 1-based counter
 * the runner keeps per sprint. The caller is responsible for assigning
 * a non-colliding sequence value — this function does not enforce
 * uniqueness on its own.
 *
 * @throws {Error} when `sprintId` is shorter than 6 chars or `sequence`
 *   is not a positive integer.
 */
export function generateFindingId(
  sprintId: string,
  sequence: number,
): string {
  if (typeof sprintId !== "string" || sprintId.length < 6) {
    throw new Error(
      "generateFindingId: sprintId must be a string of length >= 6",
    );
  }
  if (
    !Number.isFinite(sequence) ||
    !Number.isInteger(sequence) ||
    sequence < 1
  ) {
    throw new Error(
      "generateFindingId: sequence must be a positive integer (>= 1)",
    );
  }
  const short = sprintId.slice(0, 6).toLowerCase();
  return `F-${short}-${sequence}`;
}
