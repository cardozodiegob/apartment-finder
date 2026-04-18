# Implementation Plan: Virtual Team Sprint Runner

## Overview

Incremental implementation plan for the Virtual Team Sprint Runner. Tasks are grouped into phases that respect dependencies: shared types, rule layer, data models, and workspace first; then the LLM client, tool executor, and agents; then journey + verification + git + spec emission; then API routes; then admin UI; then integration glue. Property-based tests and unit tests live as sub-tasks beneath the implementation tasks they validate so errors surface at the point of introduction. All code is TypeScript (Next.js 15, React 19, Mongoose 8, Zod 3, fast-check 4, vitest 3).

Language: TypeScript (derived from the design document, which uses TypeScript throughout).

## Tasks

<!-- Phase 0: Shared types, seeds, and environment scaffolding -->

- [ ] 1. Shared types, seeds, and environment scaffolding
  - [x] 1.1 Define shared sprint domain types
    - Create `src/lib/sprint/types.ts` with `AgentRole`, `CustomerPersona`, `SprintStatus`, `SprintResult`, `FindingCategory`, `FindingSeverity`, `FixStatus`, `JourneyMode`, `FileChange`, `ToolCall`, `ToolResult`, `VerificationStep`, `VerificationReport`, `SprintError`, and the `AgentInstance` embedded shape
    - Export const string-union arrays for each enum so they can be reused by Zod schemas and fast-check generators
    - _Requirements: 2.1, 4.1, 5.1, 6.1, 8.1_
  - [x] 1.2 Create `.env.sprint.example` and environment loader
    - Add `.env.sprint.example` with `SPRINT_LLM_PROVIDER`, `SPRINT_LLM_MODEL`, `SPRINT_TEST_PORT`, `SPRINT_TEST_BASE_URL`, `SPRINT_TOKEN_BUDGET`, `SPRINT_VERBOSE_LOGS`, provider credentials placeholders, and `MONGODB_URI` for the sprint-test database
    - Create `src/lib/sprint/env.ts` exporting `loadSprintEnv()` that reads `.env.sprint`, validates required keys with Zod, and returns a frozen config object; throws `ENV_MISSING` with the first missing key
    - _Requirements: 8.1, 8.2, 8.3, 8.6, 12.4, 12.5_
  - [x] 1.3 Seed persona fixture JSON files
    - Create `src/lib/sprint/personas/<persona>.json` for each of the 10 personas (`student_sharer`, `relocating_professional`, `family_long_term`, `remote_worker`, `landlord_poster`, `non_english_speaker`, `mobile_slow_network`, `screen_reader_user`, `adversarial_probe`, `elderly_user`) with `goals`, `constraints`, `preferredLocale`, `deviceProfile`, and `journeyIds` keys
    - Create `src/lib/sprint/personas/index.ts` that loads all 10 JSON files at module init, validates each with a Zod schema, and exports a `getPersona(name)` function
    - _Requirements: 4.1, 4.2, 4.8, 4.9, 4.10, 4.11_
  - [ ]* 1.4 Write unit tests that each persona fixture parses against the schema
    - One test per persona fixture asserting the loaded JSON passes the Zod schema
    - _Requirements: 4.2_
  - [x] 1.5 Seed security scan rule files
    - Create `src/lib/sprint/security/sast-rules.json` with rules for hardcoded secrets, `eval` usage, unsanitized `dangerouslySetInnerHTML`, missing-auth route patterns, raw SQL/NoSQL injection patterns, missing CSRF on state-changing routes
    - Create `src/lib/sprint/security/secret-patterns.json` with regexes for AWS access keys, Stripe keys, Supabase service-role keys, private RSA keys, and tracked `.env` files
    - Create `src/lib/sprint/security/dast-probes.json` with probe definitions for IDOR on `/api/users/:id`, `/api/listings/:id`, `/api/messages/*`, session fixation, SSRF, rate-limit bypass, unauthenticated admin access
    - _Requirements: 7.1, 7.2, 7.4_
  - [x] 1.6 Author role prompt templates
    - Create `src/lib/sprint/prompts/<role>.md` for each of the 10 agent roles describing responsibilities, allowed actions, output format (strict JSON `{tool, parameters}`), and examples
    - _Requirements: 2.2, 2.3_
  - [x] 1.7 Author per-role allowed-tool manifests
    - Create `src/lib/sprint/tools/<role>.json` for each of the 10 roles listing `allowedTools` per the table in the design's "Agent Tool Interface" section; tech_lead gets fix.verify/fix.commit; security_engineer gets security.* and security.review_diff; etc.
    - _Requirements: 13.1, 13.2_

<!-- Phase 1: Data models (MongoDB / Mongoose) -->

- [ ] 2. Data models and indexes
  - [x] 2.1 Create `Sprint` Mongoose model
    - Create `src/lib/db/models/Sprint.ts` implementing `ISprint` with all fields listed in the design (status, result, goals, durationMinutes, roles, personas, agents, createdBy, testDbName, testPort, tokenBudget, tokensUsed, hasCriticalFinding, currentBranchAtStart, timestamps, abortReason)
    - Declare compound indexes `{ status: 1, createdAt: -1 }` and `{ createdBy: 1, createdAt: -1 }`, and partial unique index `{ status: 1 }` where `status = "running"` to enforce the single-runner invariant at the DB level
    - Register in `src/lib/db/models/index.ts`
    - _Requirements: 1.1, 1.9, 12.6_
  - [x] 2.2 Create `Finding` Mongoose model
    - Create `src/lib/db/models/Finding.ts` implementing `IFinding` (`id`, `sprintId`, reporter fields, `category`, `severity`, `title`, `description`, `reproductionSteps`, `evidenceUrls`, `dedupSignature`, `duplicateCount`, `createdAt`)
    - Declare indexes `{ sprintId: 1, createdAt: 1 }`, `{ sprintId: 1, severity: 1, category: 1 }`, and unique compound `{ sprintId: 1, dedupSignature: 1 }`
    - Register in `src/lib/db/models/index.ts`
    - _Requirements: 5.1, 5.2, 5.3, 5.7_
  - [x] 2.3 Create `FixProposal` Mongoose model
    - Create `src/lib/db/models/FixProposal.ts` implementing `IFixProposal` with the `FileChange` sub-schema and the full `FixStatus` union; indexes `{ sprintId: 1, status: 1, createdAt: 1 }` and unique `{ sprintId: 1, id: 1 }`
    - Register in `src/lib/db/models/index.ts`
    - _Requirements: 6.1, 6.8, 11.1_
  - [x] 2.4 Create `SprintActionLog` Mongoose model
    - Create `src/lib/db/models/SprintActionLog.ts` implementing `ISprintActionLog` (timestamp, sprintId, agentRole, toolName, parameterDigest, outcome, optional rawParameters/rawResponse)
    - Indexes `{ sprintId: 1, timestamp: 1 }` and `{ sprintId: 1, agentRole: 1, timestamp: 1 }`
    - Register in `src/lib/db/models/index.ts`
    - _Requirements: 13.3, 13.4_

<!-- Phase 2: Pure rule layer (state guard, dedup, spec-emission predicate, success bar, verification mapper) -->

- [ ] 3. Pure rule layer
  - [x] 3.1 Implement the sprint state guard
    - Create `src/lib/sprint/state-guard.ts` exporting a pure `nextState(sprint, event)` function returning `{ ok: true, next }` or `{ ok: false, code }` per the transition table in the design (pending→running/aborted, running→closing/aborted, closing→completed/aborted, terminal absorbing)
    - Include helpers `canStart(sprint, ctx)` and `isTerminal(status)`
    - _Requirements: 1.3, 1.5, 1.6, 1.7, 1.8, 6.10, 8.7, 12.3, 12.6_
  - [ ]* 3.2 Write property test for state transitions (Property 1)
    - File: `src/lib/sprint/__tests__/state-guard.property.test.ts`
    - **Property 1: Sprint state transitions are correct and terminal states are absorbing**
    - **Validates: Requirements 1.3, 1.5, 1.6, 1.7, 1.8, 6.10, 8.7, 12.3**
  - [x] 3.3 Implement the finding dedup and id generator
    - Create `src/lib/sprint/findings/dedup.ts` exporting `computeDedupSignature({category, title, reproductionSteps})` returning a SHA-256 digest, and `generateFindingId(sprintId, sequence)` returning `F-<sprint_short>-<sequence>`
    - Create `src/lib/sprint/findings/validate.ts` with a Zod schema that rejects findings missing `category`, `severity`, `title`, `description`, or `reproductionSteps`
    - _Requirements: 5.1, 5.3, 5.6, 5.7_
  - [ ]* 3.4 Write property test for finding emission contract (Property 8)
    - File: `src/lib/sprint/__tests__/findings.property.test.ts`
    - **Property 8: Finding emission produces unique ids, deduplicates, and rejects invalid records**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.6, 5.7**
  - [x] 3.5 Implement the spec-emission predicate
    - Create `src/lib/sprint/spec-emitter/should-promote.ts` exporting the pure `shouldPromoteToSpec(fp, findings)` function from the design (file count > 10 OR total changed lines > 500 OR any linked finding with category=security + severity=critical)
    - Export a pure `deriveSpecName(title, existingPaths)` helper that kebab-cases the title and appends a numeric suffix for collisions
    - _Requirements: 11.1, 11.2, 11.6_
  - [ ]* 3.6 Write property test for spec emission trigger (Property 13)
    - File: `src/lib/sprint/__tests__/spec-emitter.property.test.ts`
    - **Property 13: Spec emission triggers on size or critical security and produces a well-formed, unique spec directory**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.6**
  - [x] 3.7 Implement the success-bar classifier
    - Create `src/lib/sprint/success-bar.ts` exporting `classifyResult(metrics)` that returns `"met_success_bar"` iff all 7 thresholds in Requirement 10.5 hold, otherwise `"below_success_bar"` with a `missedThresholds` array identifying which bars failed
    - _Requirements: 10.2, 10.5, 10.6, 10.7_
  - [ ]* 3.8 Write property test for success-bar classification (Property 14)
    - File: `src/lib/sprint/__tests__/success-bar.property.test.ts`
    - **Property 14: Success-bar classification reflects the threshold conjunction**
    - **Validates: Requirements 10.2, 10.4, 10.6, 10.7**
  - [x] 3.9 Implement the verification pipeline mapper
    - Create `src/lib/sprint/verify-mapper.ts` exporting a pure `computeVerificationReport(stepOutcomes, linkedFindings, wallClockMs)` that decides whether Playwright runs (findings in accessibility/ux/i18n), whether `overall = "passed"` (every executed step pass), and applies the 600 s wall-clock cap (marking not-yet-run steps `timeout` and overall `failed`)
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.11_
  - [ ]* 3.10 Write property test for verification pipeline determinism (Property 10)
    - File: `src/lib/sprint/__tests__/verify.property.test.ts`
    - **Property 10: Verification pipeline is deterministic and timeout-correct**
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.6, 6.11**
  - [x] 3.11 Create shared fast-check generators
    - Create `src/lib/sprint/__tests__/generators.ts` with generators for `AgentRole`, `CustomerPersona`, `FindingCategory`, `FindingSeverity`, `SprintStatus`, `FixStatus`, `FileChange`, `Finding`, `FixProposal`, and a `sprintStateEvent` generator used by the state-guard property test
    - _Requirements: all property tests_

<!-- Phase 3: Workspace writer (append-only shared markdown + file mutex) -->

- [ ] 4. Shared markdown workspace
  - [x] 4.1 Implement the workspace writer with a per-file mutex
    - Create `src/lib/sprint/workspace.ts` exposing `init(sprintId)`, `read(path)`, `append(path, block)`, and `createTicket(ticketId, body)`; use `async-mutex` (add dep) keyed by absolute path to serialize appends; enforce the 2 MB cap and rotate to `<filename>.part<N>.md` when exceeded; compute and store a running SHA-256 hash per doc; write a matching `log.md` entry on every successful append; reject any non-append mutation under the workspace root
    - Initializes `.kiro/sprints/<sprint_id>/` with `plan.md`, `log.md`, `findings.md`, `retrospective.md` containing sprint metadata headers
    - _Requirements: 1.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_
  - [ ]* 4.2 Write property test for append-only monotonicity (Property 3)
    - File: `src/lib/sprint/__tests__/workspace-monotonic.property.test.ts`
    - **Property 3: Shared docs are append-only (content hash monotonicity)**
    - **Validates: Requirements 3.6, 3.7, 3.8**
  - [ ]* 4.3 Write property test for mutex serialization (Property 4)
    - File: `src/lib/sprint/__tests__/workspace-mutex.property.test.ts`
    - **Property 4: Appends are serialized under a file mutex**
    - **Validates: Requirements 3.5, 3.8**
  - [ ]* 4.4 Write unit tests for size rotation and ticket creation
    - Test that exceeding 2 MB rolls to `.part2.md`, then `.part3.md`
    - Test that `createTicket` writes to `.kiro/sprints/<id>/tickets/<ticket>.md` and appends a reference to `plan.md`
    - _Requirements: 3.6, 3.9_

<!-- Phase 4: LLM client -->

- [ ] 5. LLM client
  - [x] 5.1 Implement the provider-agnostic LLM client
    - Create `src/lib/sprint/llm/client.ts` with `LlmClient` interface and implementations for `bedrock`, `openai`, and `anthropic` selected by `SPRINT_LLM_PROVIDER`; read model id from `SPRINT_LLM_MODEL`; read credentials from provider-specific env vars and never log them
    - Enforce a 120 s per-request timeout and a per-sprint token budget read from `SPRINT_TOKEN_BUDGET` (exposed via the `LlmUsage` tracker returned alongside responses)
    - Implement retry with exponential backoff of 1/4/16 s on retryable errors (up to 3 attempts), return `LLM_ERROR` on final/non-retryable failures, append failures to `log.md`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [x] 5.2 Implement the structured-response parser
    - Create `src/lib/sprint/llm/parser.ts` with a Zod schema for `{ tool: string, parameters: unknown }` and a `parseAgentResponse(raw)` function returning `ToolCall` or `{ kind: "noop" }`; malformed JSON yields a corrective-prompt payload
    - _Requirements: 2.3, 13.2_
  - [ ]* 5.3 Write unit tests for retry/backoff and parser
    - Test that transient errors trigger 1/4/16 s backoff (use fake timers) and fourth call is the final attempt
    - Test that malformed JSON is converted to a corrective prompt, not a `ToolCall`
    - _Requirements: 8.4, 8.5_

<!-- Phase 5: Tool executor + tool implementations -->

- [ ] 6. Tool executor and tool implementations
  - [x] 6.1 Implement the tool executor (allow-list guard + audit logger)
    - Create `src/lib/sprint/tools/executor.ts` with `ToolExecutor` that (a) verifies the tool is in the agent's frozen allow-list, (b) validates parameters against the tool's Zod schema, (c) writes exactly one `sprintActionLog` entry per call (`ok` or rejection with codes `rejected_unknown_tool`, `rejected_not_allowed`, `rejected_invalid_params`, `execution_error`), then (d) invokes the tool impl
    - The allow-list is loaded once at sprint start and frozen in memory for the sprint's lifetime; a modified manifest on disk cannot expand a running agent's powers
    - Only include `rawParameters` / `rawResponse` in the log when `SPRINT_VERBOSE_LOGS=true`
    - _Requirements: 2.7, 13.1, 13.2, 13.3, 13.4, 13.6_
  - [ ]* 6.2 Write property test for tool executor allow-list + logging (Property 6)
    - File: `src/lib/sprint/tools/__tests__/executor.property.test.ts`
    - **Property 6: Tool_Executor enforces the per-role allow-list and writes exactly one audit entry per call**
    - **Validates: Requirements 13.2, 13.3**
  - [x] 6.3 Implement `workspace.*` tools
    - Create `src/lib/sprint/tools/impl/workspace-read.ts`, `workspace-append.ts`, `workspace-create-ticket.ts` each exporting `{ schema, run }` and delegating to the workspace writer from task 4
    - _Requirements: 3.5, 3.7, 3.9_
  - [x] 6.4 Implement `findings.emit` tool
    - Create `src/lib/sprint/tools/impl/findings-emit.ts` that validates the finding (schema + dedup), persists to MongoDB, appends a markdown block to `findings.md`, generates the id, bumps `duplicateCount` on dedup, and triggers the critical-flag / notification rules (Property 9)
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7_
  - [ ]* 6.5 Write property test for critical / security-high finding notifications (Property 9)
    - File: `src/lib/sprint/__tests__/finding-notifications.property.test.ts`
    - **Property 9: Critical / security-high findings trigger the correct notifications and flags**
    - **Validates: Requirements 5.4, 5.5**
  - [x] 6.6 Implement `fix.propose` and `fix.verify` tools
    - Create `src/lib/sprint/tools/impl/fix-propose.ts` that validates and persists a `FixProposal` in `draft`
    - Create `src/lib/sprint/tools/impl/fix-verify.ts` that calls the verification gate (task 7) and returns the `VerificationReport`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 6.7 Implement `fix.commit` tool (Auto_Commit entry point)
    - Create `src/lib/sprint/tools/impl/fix-commit.ts` that gate-checks `fp.status === "passed"`, invokes the git wrapper from task 8, sets status to `committed`, stores the commit SHA, and returns the branch name
    - _Requirements: 6.7, 6.8_
  - [x] 6.8 Implement security scan tools
    - Create `src/lib/sprint/tools/impl/security-scan-sast.ts`, `security-scan-secrets.ts`, `security-audit-deps.ts`, and `security-review-diff.ts`; each emits findings via `findings.emit` and writes full scan output to `.kiro/sprints/<id>/security/<scan>.json`
    - `security-audit-deps.ts` shells out to `npm audit --json`; SAST/secret tools consume the rule files from tasks 1.5
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.8_
  - [x] 6.9 Implement `journey.run`, `a11y.run_axe`, and `lighthouse.run` tools
    - Create thin wrappers in `src/lib/sprint/tools/impl/journey-run.ts`, `a11y-run-axe.ts`, `lighthouse-run.ts` that delegate to the journey runner (task 9) and emit findings per step
    - _Requirements: 4.3, 4.10, 10.3_
  - [x] 6.10 Implement `llm.think` tool
    - Create `src/lib/sprint/tools/impl/llm-think.ts` that performs a structured reasoning call with no side-effects (writes only to the in-memory agent scratchpad) and logs an action entry
    - _Requirements: 13.2, 13.3_

<!-- Phase 6: Verification gate + git safety wrapper + spec emitter -->

- [ ] 7. Verification gate
  - [x] 7.1 Implement the verification gate pipeline runner
    - Create `src/lib/sprint/verify.ts` that applies `FileChange`s to the sprint branch (delegates to the git wrapper), then runs `vitest --run --reporter=json` (300 s), `next lint` (180 s), `tsc --noEmit` (180 s), and conditionally the Playwright critical-flow suite (420 s) using the predicate from task 3.9
    - Enforce the 600 s global wall-clock cap; on timeout mark not-yet-run steps `timeout` and `overall = "failed"` with `rejectReason = "timeout"`
    - Retry orchestration lives in Sprint_Runner (max 3 retries per fix); the gate itself never retries internally
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.10, 6.11_
  - [ ]* 7.2 Write unit tests for gate orchestration and timeout handling
    - Test that Playwright runs only when linked findings include accessibility/ux/i18n categories
    - Test that exceeding 600 s produces `overall = "failed"` and every remaining step marked `timeout`
    - _Requirements: 6.4, 6.11_

- [ ] 8. Git safety wrapper (Auto_Commit)
  - [x] 8.1 Implement the `simple-git`-backed git wrapper with safety guards
    - Add `simple-git` as a dep; create `src/lib/sprint/git.ts` exposing `createFixBranch`, `applyFileChanges`, `commitFix`, `mergeToMainline`, `revert`, and the `assertOnSprintBranch` / `assertNoRemotePushAttempted` guards
    - Capture the originally-checked-out branch name into `sprint.currentBranchAtStart` at sprint start; reject any operation that would check out a non-`sprint/*` branch or leave HEAD on the original branch with uncommitted fix changes
    - Do not expose `push`, `push --force`, `remote add`, `remote set-url`; intercept attempts to call them through the raw API and raise `GIT_SAFETY_VIOLATION`
    - Fix commits land on `sprint/<sprintId>/fix-<fixProposalId>`; commit message uses the Conventional Commit format from the design with `Fix-Proposal:`, `Finding-Ids:`, `Sprint-Id:`, and `Verified:` trailers
    - On `commitFix` throwing after write, run `git checkout -- <paths>` to restore files and mark the fix `failed` with `rejectReason = "verification_failed"`
    - _Requirements: 6.2, 6.7, 6.8, 6.9, 9.6, 9.7_
  - [ ]* 8.2 Write property test for the push-never / user-branch-never-modified invariant (Property 12)
    - File: `src/lib/sprint/__tests__/git-safety.property.test.ts`
    - **Property 12: Auto_Commit never pushes to a remote and never modifies the user's current branch**
    - **Validates: Requirements 6.2, 6.9**
  - [ ]* 8.3 Write property test for the verification-gated commit invariant (Property 11)
    - File: `src/lib/sprint/__tests__/commit-gate.property.test.ts`
    - **Property 11: No Fix_Proposal is ever committed without a passing gate and clear security review**
    - **Validates: Requirements 6.2, 6.7, 6.8, 7.5, 7.6**
  - [ ]* 8.4 Write unit tests for commit message formatting and branch naming
    - Test commit message includes all four trailers and `Verified:` line reflecting step results
    - Test branch name matches `sprint/<24-hex>/fix-P-<6-alnum>-<n>`
    - _Requirements: 6.7, 6.8_

- [ ] 9. Kiro spec emitter
  - [x] 9.1 Implement the spec emitter
    - Create `src/lib/sprint/spec-emitter.ts` that, when `shouldPromoteToSpec` returns true, derives a unique kebab-case name (via `deriveSpecName`), creates `.kiro/specs/<name>/`, and writes `.config.kiro`, `requirements.md`, `design.md` (marked "DRAFT – emitted by sprint <sprintId>"), and `tasks.md` from templates under `src/lib/sprint/templates/spec/*.hbs`
    - Set `fp.status = "promoted_to_spec"`, store `fp.promotedSpecPath`, and append a link to `retrospective.md` under "Promoted Initiatives"
    - Do not commit the emitted spec files; they remain untracked on the user's working branch
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  - [x] 9.2 Author spec emitter templates
    - Create `src/lib/sprint/templates/spec/requirements.md.hbs`, `design.md.hbs`, `tasks.md.hbs`, `config.kiro.hbs`
    - Template variables include sprint id, fix title, linked findings (with repro steps), and derived kebab name
    - _Requirements: 11.3, 11.4_

<!-- Phase 7: Journey runner (API + Playwright) and network allow-list -->

- [ ] 10. Journey runner and persona execution
  - [x] 10.1 Implement the journey runner state machine
    - Create `src/lib/sprint/journey/runner.ts` exporting `JourneyRunner.run(journey, ctx)` per the design; pure state machine; emits findings via the `findings.emit` tool call on assertion failures
    - Reject inputs where both `critical` and `bulk` are true at validation time
    - Dispatch rules: `critical` → browser, `bulk` → api, otherwise use the step's declared mode
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7_
  - [ ]* 10.2 Write property test for journey dispatch mode (Property 5)
    - File: `src/lib/sprint/journey/__tests__/dispatch.property.test.ts`
    - **Property 5: Journey dispatch mode follows persona flags**
    - **Validates: Requirements 4.4, 4.5**
  - [x] 10.3 Implement persona context wrappers
    - Add Playwright CDP throttling for `mobile_slow_network` (400 kbps / 100 ms RTT)
    - Set `Accept-Language` header and locale cookie for `non_english_speaker` using a non-`en` locale from the app's supported locales
    - Force `axeCheck: true` on every browser step for `screen_reader_user` and emit one finding per WCAG 2.1 AA violation
    - Route `adversarial_probe` through the DAST probe set and allow-list state-changing probes to it only
    - _Requirements: 4.8, 4.9, 4.10, 4.11_
  - [x] 10.4 Implement the network allow-list guard
    - Create `src/lib/sprint/net-allowlist.ts` that intercepts outbound HTTP from the journey runner and the security engineer agent; allow only `localhost` (any port) and the host of `process.env.SPRINT_TEST_BASE_URL`; reject other hosts and log `rejected_not_allowed` to `sprintActionLog`
    - _Requirements: 4.11, 7.7_
  - [ ]* 10.5 Write property test for outbound host allow-list (Property 7)
    - File: `src/lib/sprint/__tests__/network-allowlist.property.test.ts`
    - **Property 7: Outbound hosts from personas and agents are allow-listed**
    - **Validates: Requirements 4.11, 7.7**

<!-- Phase 8: Isolated test-instance lifecycle -->

- [ ] 11. Isolated test app instance
  - [x] 11.1 Implement child test-instance lifecycle
    - Create `src/lib/sprint/test-instance.ts` that spawns `next start` on `SPRINT_TEST_PORT` with `MONGODB_URI` pointed at `apartment_finder_sprint_<sprintId>` and env loaded from `.env.sprint`; exposes `start()` returning a ready signal, `stop()`, and a `close` watcher that aborts the sprint with `test_instance_crashed` on unexpected exit
    - Create `src/lib/sprint/test-db.ts` that creates and drops the `apartment_finder_sprint_<sprintId>` database at start / completion / abort
    - _Requirements: 12.1, 12.3, 12.4_
  - [x] 11.2 Seed test-database fixtures
    - Create `src/lib/sprint/fixtures/*.ts` providing users per persona role, sample listings, neighborhoods, blog articles, and messages; expose `seedTestDatabase(db)` that loads all fixtures idempotently
    - _Requirements: 12.2_
  - [ ]* 11.3 Write unit tests for fixture seeding
    - Test each fixture file exports valid shapes that pass the existing mongoose schemas
    - Test `seedTestDatabase` is idempotent
    - _Requirements: 12.2_

<!-- Phase 9: Agent pool + Sprint runner coordinator -->

- [ ] 12. Agent pool and Sprint_Runner coordinator
  - [x] 12.1 Implement the Agent abstraction and Agent_Pool
    - Create `src/lib/sprint/agents/agent.ts` defining the `Agent` interface (`step(ctx)` -> `ToolCall | NoOp`)
    - Create `src/lib/sprint/agents/pool.ts` that instantiates one `Agent` per selected role, loads `prompts/<role>.md` and `tools/<role>.json`, and freezes both into `AgentInstance` for the sprint's lifetime
    - Reject sprint creation if `tech_lead` is not included; reject duplicates (at most one Agent per role)
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7_
  - [x] 12.2 Implement the Sprint_Runner coordinator
    - Create `src/lib/sprint/runner.ts` with `create`, `start`, `abort`, `getStatus`, and an internal `tick` scheduler; holds per-sprint in-memory state keyed by `sprintId`; single-running-sprint invariant enforced both in Mongo (partial unique index) and in-process
    - On `start`: transition pending→running via `state-guard`, spawn the test instance, seed the DB, freeze manifests, and begin the agent scheduler
    - Duration elapsed OR token budget exhausted → transition to `closing`; 150% duration OR admin `abort` → `aborted` with reason; process restart rehydrates from Mongo and force-aborts stale `running`/`closing` sprints with reason `process_restart`
    - Stop agent activity within 30 seconds on abort; preserve all artifacts
    - Drop the test DB and terminate the test instance on `completed` or `aborted`
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 8.7, 12.1, 12.3, 12.6_
  - [ ]* 12.3 Write property test for single-running-sprint invariant (Property 2)
    - File: `src/lib/sprint/__tests__/single-runner.property.test.ts`
    - **Property 2: At most one sprint is in status `running` at any time**
    - **Validates: Requirements 12.6, 1.3**
  - [ ]* 12.4 Write unit tests for coordinator edge cases
    - Test that process restart aborts stale `running` sprints with reason `process_restart`
    - Test that token-budget exhaustion triggers `closing`
    - Test that `.env.sprint` missing a required key rejects sprint creation
    - _Requirements: 8.7, 12.5_

- [x] 13. Checkpoint — Rule layer, workspace, git safety, verification
  - Ensure all tests pass, ask the user if questions arise.

<!-- Phase 10: Retrospective generator + Lighthouse wiring -->

- [ ] 14. Retrospective generation and metrics
  - [~] 14.1 Implement the retrospective writer
    - Create `src/lib/sprint/retrospective.ts` that the tech_lead agent calls on transition to `closing`; it reads the sprint, findings, fix proposals, and computed metrics, renders the retrospective from `src/lib/sprint/templates/retrospective.md.hbs`, and appends to `.kiro/sprints/<id>/retrospective.md`
    - Mark each metric `regressed` when below threshold and list likely-responsible fix proposals by id
    - _Requirements: 10.1, 10.2, 10.4, 10.7_
  - [~] 14.2 Implement Lighthouse integration
    - Create `src/lib/sprint/lighthouse.ts` that runs `lighthouse --output json` against the test instance for the homepage and the search page, parses scores for Performance, Accessibility, Best Practices, SEO, and feeds them into the success-bar classifier
    - _Requirements: 10.3, 10.5_
  - [ ]* 14.3 Write unit tests for retrospective template rendering
    - Test grouping by category+severity and success-metric inclusion
    - Test that missed thresholds are listed under "Below Success Bar"
    - _Requirements: 10.1, 10.7_

<!-- Phase 11: API routes under /api/admin/sprints -->

- [ ] 15. Admin API routes
  - [~] 15.1 Implement `POST/GET /api/admin/sprints`
    - Create `src/app/api/admin/sprints/route.ts` using `requireAdmin()`; `POST` validates `CreateSprintInput` with Zod and delegates to `SprintRunner.create`, returning 409 on concurrent running sprint, 400 on env/validation errors; `GET` returns a paginated list sorted by `createdAt` desc with finding/fix counts
    - _Requirements: 1.1, 9.1, 9.2, 9.8, 9.9, 12.5, 12.6_
  - [~] 15.2 Implement `GET/PATCH /api/admin/sprints/[id]`
    - Create `src/app/api/admin/sprints/[id]/route.ts`; `GET` returns `SprintStatusView` (sprint + counts + last-N log entries); `PATCH` accepts `{ action: "start" | "abort", reason? }` and routes to `SprintRunner.start` or `SprintRunner.abort`
    - _Requirements: 1.3, 1.4, 1.7, 9.3, 9.8_
  - [~] 15.3 Implement `POST /api/admin/sprints/[id]/action`
    - Create `src/app/api/admin/sprints/[id]/action/route.ts` with actions `merge_to_main` (fast-forward or squash merge of a fix's sprint branch into `mainline`) and `revert_commit` (create a revert commit on the sprint branch; set fix status to `reverted`)
    - _Requirements: 9.5, 9.6, 9.7_
  - [~] 15.4 Implement `GET /api/admin/sprints/[id]/artifacts`
    - Create `src/app/api/admin/sprints/[id]/artifacts/route.ts` returning rendered markdown of each shared doc, plus a `?download=actionLog` query that streams all `sprintActionLog` entries for the sprint as JSON (Requirement 13.5)
    - _Requirements: 9.3, 13.5_
  - [ ]* 15.5 Write unit tests for admin API routes
    - Test 403 for non-admin, 409 for concurrent running sprint, 400 for missing env, 200 for list/detail
    - Test that `merge_to_main` on a non-committed fix returns 409
    - _Requirements: 9.5, 9.8, 9.9, 12.6_

<!-- Phase 12: Admin UI (component tree matches design) -->

- [ ] 16. Admin UI
  - [~] 16.1 Create the admin sprints layout with requireAdmin guard
    - Create `src/app/admin/sprints/layout.tsx` that calls `requireAdmin()` at the layout level; non-admin requests redirect or render 403 via `ApiErrorResponse`
    - _Requirements: 9.8, 9.9_
  - [~] 16.2 Create the sprint list page
    - Create `src/app/admin/sprints/page.tsx` showing paginated sprints with status, duration, selected roles, finding counts by severity, and fix-proposal counts by status
    - _Requirements: 9.1_
  - [~] 16.3 Create the sprint creation form
    - Create `src/app/admin/sprints/new/page.tsx` (client component) with role multiselect, persona multiselect, duration input (5..240), and goals textarea; submits to `POST /api/admin/sprints`
    - _Requirements: 9.2_
  - [~] 16.4 Create the sprint detail shell with tabs
    - Create `src/app/admin/sprints/[id]/page.tsx` wrapping the six tab components; use `useSWR` with `refreshInterval: 5000` while status is `running` or `closing`, switch to static fetch on `completed`/`aborted`
    - _Requirements: 9.3, 9.4_
  - [~] 16.5 Create the six tab components
    - Create `overview-tab.tsx` (metadata, live status, elapsed time), `workspace-tab.tsx` (renders each shared doc as markdown), `findings-tab.tsx` (filterable list with severity chips), `fix-proposals-tab.tsx` (list + per-fix drawer with diff, "Merge to Main" and "Revert Commit" buttons), `retrospective-tab.tsx` (rendered retrospective.md), `action-log-tab.tsx` (`sprintActionLog` entries with JSON export link)
    - _Requirements: 9.3, 9.5, 9.6, 9.7, 13.5_
  - [ ]* 16.6 Write component tests for the admin UI
    - Use `@testing-library/react` + `msw` to test: list renders, create form validates duration range, detail page polls while running, fix-proposal drawer exposes Merge/Revert buttons only for `committed` status, action-log tab exports JSON
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

<!-- Phase 13: End-to-end integration (gated) -->

- [ ] 17. End-to-end integration tests (gated by `SPRINT_INTEGRATION=true`)
  - [~] 17.1 Add the integration test harness
    - Create `src/lib/sprint/__tests__/integration/harness.ts` that spawns the test instance, seeds a temp Mongo DB, mocks the LLM client with deterministic tool-call scripts, and tears everything down on completion
    - Gate every test file in this task behind `SPRINT_INTEGRATION === "true"` using `describe.skipIf(!process.env.SPRINT_INTEGRATION)`
    - _Requirements: 12.1, 12.2, 12.3_
  - [ ]* 17.2 Sprint lifecycle integration test
    - File: `src/lib/sprint/__tests__/integration/lifecycle.integration.test.ts`
    - Create a sprint, start it, let a mocked tech_lead agent append to `plan.md`, trigger abort, assert transitions, artifacts, and DB cleanup
    - _Requirements: 1.3, 1.5, 1.6, 1.7, 12.3_
  - [ ]* 17.3 Single-journey integration test
    - File: `src/lib/sprint/__tests__/integration/journey.integration.test.ts`
    - Run one `student_sharer` journey against the test instance; assert a Finding is emitted on a seeded failure and captured in `findings.md`
    - _Requirements: 4.3, 4.6, 5.2_
  - [ ]* 17.4 Verification-gate integration test against a known-good fix
    - File: `src/lib/sprint/__tests__/integration/verify-gate.integration.test.ts`
    - Submit a trivial fix, assert vitest/next-lint/tsc pass, commit lands on `sprint/<id>/fix-<id>`, and the user's branch is unchanged
    - _Requirements: 6.2, 6.3, 6.5, 6.7, 6.8, 6.9_
  - [ ]* 17.5 Spec emission integration test for an oversized fix
    - File: `src/lib/sprint/__tests__/integration/spec-emission.integration.test.ts`
    - Submit a fix touching >10 files; assert `.kiro/specs/<kebab>/` is created with all four files, `fp.status === "promoted_to_spec"`, and no commit was made
    - _Requirements: 11.1, 11.3, 11.4, 11.5_

- [~] 18. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major phase
- Property-based tests live under `src/lib/sprint/**/__tests__/*.property.test.ts` with one file per Correctness Property (14 total); each runs with `fc.assert(..., { numRuns: 200 })` and shares generators from `src/lib/sprint/__tests__/generators.ts`
- Integration tests are gated by `SPRINT_INTEGRATION=true` and are NOT run by `npm test` by default, to keep CI fast
- The git safety wrapper (task 8) and state guard (task 3.1) are the two safety-critical seams; both have dedicated property tests (Property 12 and Property 1 respectively) and MUST land before any API route or UI wiring is exposed
- Persona fixtures (task 1.3) and security rule files (task 1.5) are data, not code, and are seeded in Phase 0 so every downstream agent/scan can consume them deterministically
- The admin UI mirrors the component tree in the design's "Admin UI Component Tree" section exactly
