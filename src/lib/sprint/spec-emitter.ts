/**
 * Kiro_Spec_Emitter — filesystem-level emitter for promoted fixes.
 *
 * When {@link shouldPromoteToSpec} says a FixProposal should become its
 * own `.kiro/specs/` entry (file count > 10, line count > 500, or any
 * linked finding is category=`security` + severity=`critical`), this
 * module:
 *
 *   1. Derives a unique kebab-case name via {@link deriveSpecName} by
 *      listing existing directories under `.kiro/specs/`.
 *   2. Creates `.kiro/specs/<name>/` and writes four files rendered from
 *      Handlebars templates under `src/lib/sprint/templates/spec/`:
 *        - `.config.kiro`
 *        - `requirements.md`
 *        - `design.md`   (marked "DRAFT – emitted by sprint <id>")
 *        - `tasks.md`
 *   3. Appends a link under "## Promoted Initiatives" in the sprint's
 *      `retrospective.md` via the workspace writer (Task 4.1).
 *
 * What this emitter does NOT do:
 *   - It does not mutate the FixProposal MongoDB document. The caller
 *     (the `fix.commit` tool in task 6.7) is responsible for setting
 *     `fp.status = "promoted_to_spec"` and `fp.promotedSpecPath` on the
 *     persisted record.
 *   - It does not commit the emitted files. They are left untracked on
 *     the user's working branch (Requirement 11: human-review gate).
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import Handlebars from "handlebars";

import type { FindingCategory, FindingSeverity } from "@/lib/sprint/types";
import {
  deriveSpecName,
  shouldPromoteToSpec,
  type PromoteDecision,
} from "@/lib/sprint/spec-emitter/should-promote";
import {
  createWorkspaceWriter,
  type WorkspaceWriter,
} from "@/lib/sprint/workspace";

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface EmitFindingInput {
  readonly id: string;
  readonly category: FindingCategory;
  readonly severity: FindingSeverity;
  readonly title: string;
  readonly description: string;
  readonly reproductionSteps: readonly string[];
}

export interface EmitFixProposalInput {
  /** FixProposal public id, e.g. `P-abc123-7`. */
  readonly id: string;
  readonly title: string;
  readonly findingIds: readonly string[];
  readonly fileChanges: ReadonlyArray<{
    readonly path: string;
    readonly operation: string;
    readonly addedLines: number;
    readonly removedLines: number;
  }>;
}

export interface EvaluateAndEmitInput {
  /** 24-hex sprint id (passed through to the templates + workspace writer). */
  readonly sprintId: string;
  readonly fixProposal: EmitFixProposalInput;
  /**
   * All findings known to the sprint. The emitter filters to those whose
   * id is in `fixProposal.findingIds` — not every finding is linked.
   */
  readonly findings: readonly EmitFindingInput[];
  /** Workspace cwd; defaults to `process.cwd()`. */
  readonly cwd?: string;
  /**
   * Optional override for the workspace writer used to append the
   * "Promoted Initiatives" entry. Defaults to a writer for this sprint.
   */
  readonly workspace?: WorkspaceWriter;
  /** Optional override for `Date.now()` / `new Date()`, used by tests. */
  readonly now?: () => Date;
}

export interface EmitSpecResult {
  readonly promoted: boolean;
  /** Repo-relative path (e.g. `.kiro/specs/my-fix`). Set iff `promoted`. */
  readonly promotedSpecPath?: string;
  readonly decision: PromoteDecision;
  /** Files written into the new spec directory, in write order. */
  readonly writtenFiles?: readonly string[];
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Evaluate the FixProposal; if it should be promoted, emit the spec
 * artifacts and return the new spec path. Pure no-op (no filesystem
 * writes) when the predicate returns false.
 */
export async function evaluateAndEmitSpec(
  input: EvaluateAndEmitInput,
): Promise<EmitSpecResult> {
  const decision = shouldPromoteToSpec(
    {
      fileChanges: input.fixProposal.fileChanges,
      findingIds: input.fixProposal.findingIds,
    },
    input.findings,
  );
  if (!decision.promote) {
    return { promoted: false, decision };
  }

  const cwd = input.cwd ?? process.cwd();
  const now = input.now ?? (() => new Date());
  const specsRoot = path.resolve(cwd, ".kiro", "specs");
  await mkdir(specsRoot, { recursive: true });

  // List existing spec slugs so `deriveSpecName` can collision-resolve.
  const existing = await listExistingSpecSlugs(specsRoot);
  const slug = deriveSpecName(input.fixProposal.title, existing);
  const specDirAbs = path.join(specsRoot, slug);
  await mkdir(specDirAbs, { recursive: true });

  // Build the render context shared across all four templates.
  const linkedIds = new Set(input.fixProposal.findingIds);
  const linkedFindings = input.findings.filter((f) => linkedIds.has(f.id));

  const emittedAt = now().toISOString();
  const context: TemplateContext = {
    specId: randomUUID(),
    sprintId: input.sprintId,
    emittedAt,
    slug,
    fix: {
      id: input.fixProposal.id,
      title: input.fixProposal.title,
      fileChangeCount: input.fixProposal.fileChanges.length,
    },
    findings: linkedFindings.map((f) => ({
      id: f.id,
      category: f.category,
      severity: f.severity,
      title: f.title,
      description: f.description,
      reproductionSteps: [...f.reproductionSteps],
    })),
  };

  const templatesRoot = path.resolve(
    cwd,
    "src",
    "lib",
    "sprint",
    "templates",
    "spec",
  );

  // Render and write each of the four files. Order matters: .config.kiro
  // is written first so any downstream reader can discover the spec by
  // its config file as soon as the directory exists.
  const writes: Array<{ file: string; template: string }> = [
    { file: ".config.kiro", template: "config.kiro.hbs" },
    { file: "requirements.md", template: "requirements.md.hbs" },
    { file: "design.md", template: "design.md.hbs" },
    { file: "tasks.md", template: "tasks.md.hbs" },
  ];

  const writtenFiles: string[] = [];
  for (const { file, template } of writes) {
    const rendered = await renderTemplate(
      path.join(templatesRoot, template),
      context,
    );
    await writeFile(path.join(specDirAbs, file), rendered, "utf8");
    writtenFiles.push(file);
  }

  // Append the link to the sprint retrospective. Failure here is
  // non-fatal — the spec files are on disk even if the workspace write
  // fails, so the caller can still record the promotion.
  const promotedSpecPath = path
    .relative(cwd, specDirAbs)
    .split(path.sep)
    .join("/");

  await appendPromotedInitiative({
    sprintId: input.sprintId,
    workspace: input.workspace,
    fix: input.fixProposal,
    specPath: promotedSpecPath,
    emittedAt,
  });

  return {
    promoted: true,
    promotedSpecPath,
    decision,
    writtenFiles,
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface TemplateContext {
  readonly specId: string;
  readonly sprintId: string;
  readonly emittedAt: string;
  readonly slug: string;
  readonly fix: {
    readonly id: string;
    readonly title: string;
    readonly fileChangeCount: number;
  };
  readonly findings: ReadonlyArray<{
    readonly id: string;
    readonly category: FindingCategory;
    readonly severity: FindingSeverity;
    readonly title: string;
    readonly description: string;
    readonly reproductionSteps: readonly string[];
  }>;
}

/**
 * A private Handlebars instance so we don't leak helpers into shared
 * state. Exposes `inc` to convert `@index` (0-based) to 1-based numbering
 * inside `{{#each}}` blocks.
 */
const hb = Handlebars.create();
hb.registerHelper("inc", (value: unknown) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n + 1 : value;
});

async function renderTemplate(
  templatePath: string,
  context: TemplateContext,
): Promise<string> {
  const raw = await readFile(templatePath, "utf8");
  const compiled = hb.compile(raw, { noEscape: true });
  return compiled(context);
}

async function listExistingSpecSlugs(
  specsRoot: string,
): Promise<readonly string[]> {
  try {
    const entries = await readdir(specsRoot, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function appendPromotedInitiative(params: {
  readonly sprintId: string;
  readonly workspace?: WorkspaceWriter;
  readonly fix: EmitFixProposalInput;
  readonly specPath: string;
  readonly emittedAt: string;
}): Promise<void> {
  const writer = params.workspace ?? createWorkspaceWriter(params.sprintId);
  const block =
    `\n## Promoted Initiatives\n\n` +
    `- [${params.fix.id} — ${params.fix.title}](${params.specPath}) ` +
    `(emitted ${params.emittedAt})\n`;

  try {
    await writer.append("retrospective.md", block, {
      actor: "spec_emitter",
      toolName: "spec.emit",
    });
  } catch {
    // Don't let workspace-append failures poison a successful emission.
    // The spec files are already on disk; a later retrospective render
    // can reconcile. The caller's audit log will still reflect the
    // promotion via the FixProposal status update.
  }
}
