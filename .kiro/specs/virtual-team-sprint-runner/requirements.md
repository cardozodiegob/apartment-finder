# Requirements Document

## Introduction

The Virtual Team Sprint Runner is an orchestration system embedded inside the existing Apartment Finder Next.js webapp that simulates a full software development team — developers, a tech lead, QA, security, UX, PM, DevOps, and an accessibility specialist — running time-boxed sprints against the webapp itself. Each sprint drives simulated customer personas through the app (via API calls at scale and Playwright for critical flows), collects UI/UX and security findings, synthesizes fixes in a shared markdown workspace, proposes code changes, runs the full test suite, and auto-commits passing changes to the repository while routing larger initiatives into new `.kiro/specs/` documents for human review.

The system is operated from a new admin section at `/admin/sprints/*` where an authenticated admin kicks off sprints, watches agent activity in the shared workspace, inspects findings and retrospectives, and approves or rolls back auto-committed changes. Agents are backed by a configurable LLM provider (Bedrock, OpenAI, or Anthropic) and perform reasoning, while a deterministic execution layer handles file I/O, test running, git operations, and browser automation so that LLM non-determinism cannot corrupt the repository.

## Glossary

- **Sprint_Runner**: The orchestration service that creates sprints, assigns work to agents, gathers artifacts, and enforces lifecycle rules
- **Agent**: A single simulated team member (dev, QA, security, etc.) backed by an LLM prompt and a restricted toolset
- **Agent_Role**: One of: `tech_lead`, `senior_dev`, `frontend_dev`, `backend_dev`, `qa_engineer`, `security_engineer`, `ux_designer`, `product_manager`, `devops_engineer`, `accessibility_specialist`
- **Customer_Persona**: A simulated end-user with defined goals, constraints, and behavior; one of: `student_sharer`, `relocating_professional`, `family_long_term`, `remote_worker`, `landlord_poster`, `non_english_speaker`, `mobile_slow_network`, `screen_reader_user`, `adversarial_probe`, `elderly_user`
- **Sprint**: A time-boxed iteration with a start time, duration, goals, list of Agents, list of Customer_Personas, and a set of produced Findings and Fixes
- **Sprint_Workspace**: A per-sprint directory containing the shared markdown files that Agents read and write to communicate (`plan.md`, `log.md`, `findings.md`, `retrospective.md`, and per-ticket files)
- **Shared_Doc**: Any markdown file inside the Sprint_Workspace; all Agents read and append to these files as their communication channel
- **Finding**: A structured record emitted by an Agent describing an issue (UX, security, performance, a11y, bug) with severity, source, and a reproduction pointer
- **Fix_Proposal**: A structured record linking one or more Findings to a proposed code change, optional test plan, and verification status
- **Customer_Journey**: A scripted sequence of steps a Customer_Persona performs against the App (search listing, view detail, request viewing, etc.)
- **Journey_Runner**: The deterministic execution layer that drives Customer_Personas through API calls and Playwright browser sessions
- **LLM_Client**: The provider-agnostic wrapper around Bedrock, OpenAI, or Anthropic used by Agents for reasoning
- **Verification_Gate**: The automated check that must pass before a Fix_Proposal is committed — runs `vitest --run`, `next lint`, `tsc --noEmit`, and optional Playwright critical-flow checks
- **Auto_Commit**: The deterministic git operation that commits a passing Fix_Proposal to a sprint branch after Verification_Gate succeeds
- **Retrospective**: The markdown document produced at sprint end summarizing findings, fixes, regressions, and success metrics
- **Kiro_Spec_Emitter**: The component that converts large Fix_Proposals into new `.kiro/specs/<feature>/` directories (requirements.md + design.md + tasks.md)
- **App**: The Apartment Finder Next.js webapp being audited and improved
- **Admin**: An authenticated user with role `admin` as defined by the existing Auth_System

---

## Requirements

### Requirement 1: Sprint Lifecycle Management

**User Story:** As an admin, I want to start, monitor, and close sprints from the admin UI, so that I can orchestrate simulated team work against the App on demand.

#### Acceptance Criteria

1. WHEN an admin submits a sprint creation form at `/admin/sprints/new`, THE Sprint_Runner SHALL create a Sprint record with status `pending`, the selected Agent_Roles, the selected Customer_Personas, a duration in minutes between 5 and 240, and a list of sprint goals
2. WHEN a Sprint is created, THE Sprint_Runner SHALL create a Sprint_Workspace directory at `.kiro/sprints/<sprint_id>/` containing `plan.md`, `log.md`, `findings.md`, and `retrospective.md` initialized with the sprint metadata
3. WHEN an admin clicks "Start Sprint" on a `pending` Sprint, THE Sprint_Runner SHALL transition the Sprint to status `running` and begin Agent execution
4. WHILE a Sprint is in status `running`, THE Sprint_Runner SHALL display real-time status at `/admin/sprints/<sprint_id>` including active Agents, current activity, Finding count, and elapsed time
5. WHEN the configured sprint duration elapses, THE Sprint_Runner SHALL transition the Sprint to status `closing` and instruct all Agents to stop emitting new Findings
6. WHEN all Agents have completed their closing activities, THE Sprint_Runner SHALL transition the Sprint to status `completed` and produce the Retrospective
7. WHEN an admin clicks "Abort Sprint" on a `running` Sprint, THE Sprint_Runner SHALL transition the Sprint to status `aborted`, stop all Agent activity within 30 seconds, and preserve all artifacts produced so far
8. IF a Sprint remains in status `running` for more than 150% of its configured duration, THEN THE Sprint_Runner SHALL force-transition the Sprint to status `aborted` and record the timeout reason in `log.md`
9. THE Sprint_Runner SHALL persist all Sprint records in a MongoDB `sprints` collection with indexes on `{ status: 1, createdAt: -1 }` and `{ createdBy: 1, createdAt: -1 }`

---

### Requirement 2: Agent Team Composition and Role Prompts

**User Story:** As an admin, I want to select which roles participate in a sprint and have each role behave according to a defined prompt, so that the simulated team produces specialized output.

#### Acceptance Criteria

1. THE Sprint_Runner SHALL support the following Agent_Roles: `tech_lead`, `senior_dev`, `frontend_dev`, `backend_dev`, `qa_engineer`, `security_engineer`, `ux_designer`, `product_manager`, `devops_engineer`, `accessibility_specialist`
2. THE Sprint_Runner SHALL store one role prompt template per Agent_Role in `src/lib/sprint/prompts/<role>.md` defining the role's responsibilities, allowed actions, and output format
3. WHEN a Sprint starts, THE Sprint_Runner SHALL instantiate one Agent per selected Agent_Role and load the corresponding role prompt
4. THE Sprint_Runner SHALL designate the `tech_lead` Agent as the sprint coordinator responsible for assigning Findings to implementing Agents and approving Fix_Proposals
5. WHERE a Sprint does not include a `tech_lead` Agent_Role, THE Sprint_Runner SHALL reject Sprint creation with a validation error
6. THE Sprint_Runner SHALL allow at most one Agent per Agent_Role per Sprint
7. WHEN an Agent is instantiated, THE Sprint_Runner SHALL record the Agent's role, model identifier, and LLM provider in the Sprint record

---

### Requirement 3: Shared Markdown Workspace Communication

**User Story:** As an admin, I want agents to communicate through a shared markdown workspace I can read, so that agent collaboration is transparent and auditable.

#### Acceptance Criteria

1. THE Sprint_Workspace SHALL contain `plan.md` that the `tech_lead` Agent owns and initializes with the sprint goals and work breakdown
2. THE Sprint_Workspace SHALL contain `log.md` that every Agent appends to with timestamped entries describing each action taken
3. THE Sprint_Workspace SHALL contain `findings.md` that every Agent appends Finding records to
4. THE Sprint_Workspace SHALL contain `retrospective.md` that the `tech_lead` Agent writes at sprint close
5. WHEN an Agent appends content to a Shared_Doc, THE Sprint_Runner SHALL acquire a file-level mutex, append the content, release the mutex, and record the write in `log.md`
6. THE Sprint_Runner SHALL limit each Shared_Doc to a maximum size of 2 megabytes and SHALL rotate to `<filename>.part<N>.md` when the limit is reached
7. WHEN an Agent requests to read a Shared_Doc, THE Sprint_Runner SHALL return the current contents of the document and the list of part files
8. THE Sprint_Runner SHALL prevent Agents from deleting or overwriting existing content in any Shared_Doc; append and per-ticket file creation are the only permitted mutations
9. WHEN an Agent creates a per-ticket markdown file, THE Sprint_Runner SHALL place the file at `.kiro/sprints/<sprint_id>/tickets/<ticket_id>.md` and add a reference to `plan.md`

---

### Requirement 4: Customer Persona Journey Execution

**User Story:** As a product manager, I want simulated customers with distinct goals to exercise the App, so that UI/UX friction and edge cases are surfaced during a sprint.

#### Acceptance Criteria

1. THE Sprint_Runner SHALL support the following Customer_Personas: `student_sharer`, `relocating_professional`, `family_long_term`, `remote_worker`, `landlord_poster`, `non_english_speaker`, `mobile_slow_network`, `screen_reader_user`, `adversarial_probe`, `elderly_user`
2. THE Sprint_Runner SHALL store one persona definition per Customer_Persona in `src/lib/sprint/personas/<persona>.json` containing goals, constraints, preferred locale, device profile, and a list of Customer_Journey identifiers
3. WHEN a Sprint starts, THE Journey_Runner SHALL execute each selected Customer_Persona's journeys against a dedicated test isolate of the App with a seeded test database
4. WHERE a Customer_Persona's definition marks a journey as `critical`, THE Journey_Runner SHALL execute the journey using Playwright against a real browser instance
5. WHERE a Customer_Persona's definition marks a journey as `bulk`, THE Journey_Runner SHALL execute the journey as sequential API calls without a browser
6. WHEN a Customer_Journey step fails assertion, THE Journey_Runner SHALL emit a Finding with severity derived from the step definition, a reproduction pointer, and the captured request/response or screenshot
7. THE Journey_Runner SHALL complete all selected Customer_Persona journeys within the sprint duration or record an `incomplete` status per unfinished journey in `findings.md`
8. WHEN the `mobile_slow_network` Customer_Persona runs, THE Journey_Runner SHALL throttle network to 400 kilobits per second downstream and 100 milliseconds round-trip latency in the Playwright context
9. WHEN the `non_english_speaker` Customer_Persona runs, THE Journey_Runner SHALL set the `Accept-Language` header and locale cookie to a locale other than `en` selected from the App's supported locales
10. WHEN the `screen_reader_user` Customer_Persona runs, THE Journey_Runner SHALL execute accessibility assertions using axe-core and emit a Finding for each WCAG 2.1 AA violation
11. WHEN the `adversarial_probe` Customer_Persona runs, THE Journey_Runner SHALL execute the security probe suite defined in Requirement 7 and SHALL NOT attempt probes against external hosts

---

### Requirement 5: Findings Collection and Structure

**User Story:** As a tech lead, I want all discovered issues captured in a consistent structure, so that they can be triaged, assigned, and tracked to resolution.

#### Acceptance Criteria

1. THE Sprint_Runner SHALL define a Finding as a structured record containing: `id`, `sprintId`, `reporterAgentRole` or `reporterPersona`, `category` (one of `ux`, `security`, `performance`, `accessibility`, `bug`, `i18n`, `seo`), `severity` (one of `low`, `medium`, `high`, `critical`), `title`, `description`, `reproductionSteps`, `evidenceUrls`, `createdAt`
2. WHEN any Agent or Customer_Persona emits a Finding, THE Sprint_Runner SHALL persist the Finding to the `findings` MongoDB collection and append a structured markdown block to `findings.md`
3. THE Sprint_Runner SHALL assign a unique `id` to each Finding using the format `F-<sprint_id_short>-<sequence>`
4. WHEN a Finding's `category` is `security` and `severity` is `high` or `critical`, THE Sprint_Runner SHALL notify the `tech_lead` Agent and the `security_engineer` Agent via an entry in `log.md` tagged `@tech_lead` and `@security_engineer`
5. IF a Finding's `severity` is `critical`, THEN THE Sprint_Runner SHALL set the Sprint-level flag `hasCriticalFinding` to `true`
6. THE Sprint_Runner SHALL reject Findings where any required field is missing with a validation error written to `log.md` and SHALL NOT count the rejected Finding toward sprint totals
7. THE Sprint_Runner SHALL deduplicate Findings emitted within the same Sprint when `category`, `title`, and `reproductionSteps` are identical and SHALL record the duplicate count on the retained Finding

---

### Requirement 6: Fix Proposal and Verification Gate

**User Story:** As a tech lead, I want each proposed fix to be verified by the full test suite before it can be committed, so that the App is never left in a broken state.

#### Acceptance Criteria

1. WHEN an implementing Agent authors a Fix_Proposal, THE Sprint_Runner SHALL persist it with fields: `id`, `sprintId`, `findingIds`, `authorAgentRole`, `fileChanges` (list of file paths and diffs), `testPlan`, `status` (one of `draft`, `verifying`, `passed`, `failed`, `committed`, `rejected`), `createdAt`
2. WHEN a Fix_Proposal is submitted, THE Sprint_Runner SHALL apply the `fileChanges` to a sprint branch named `sprint/<sprint_id>/fix-<fix_id>` and SHALL NOT modify the user's currently checked-out branch
3. WHEN the `fileChanges` are applied, THE Verification_Gate SHALL run `npm run test` (vitest --run), `npm run lint` (next lint), and `npx tsc --noEmit`
4. WHERE a Fix_Proposal's `findingIds` include a Finding in category `accessibility`, `ux`, or `i18n`, THE Verification_Gate SHALL additionally run the Playwright critical-flow suite
5. WHEN all Verification_Gate checks pass, THE Sprint_Runner SHALL set the Fix_Proposal status to `passed`
6. WHEN any Verification_Gate check fails, THE Sprint_Runner SHALL set the Fix_Proposal status to `failed`, capture the failure output, and append a rejection summary to the corresponding ticket file
7. WHEN a Fix_Proposal reaches status `passed`, THE Auto_Commit SHALL create a git commit on the sprint branch with a conventional commit message referencing the Finding IDs and Fix_Proposal ID
8. WHEN the Auto_Commit succeeds, THE Sprint_Runner SHALL set the Fix_Proposal status to `committed`
9. THE Sprint_Runner SHALL NOT push any commits to a remote repository automatically; commits remain on the local sprint branch until an admin merges them
10. IF the Verification_Gate fails more than 3 times for the same Fix_Proposal, THEN THE Sprint_Runner SHALL set the Fix_Proposal status to `rejected` and reassign the underlying Findings back to the `tech_lead` Agent
11. THE Verification_Gate SHALL enforce a wall-clock timeout of 10 minutes per run and SHALL mark the Fix_Proposal `failed` with reason `timeout` when exceeded

---

### Requirement 7: Security Engineer Agent Capabilities

**User Story:** As a security engineer, I want the Security Engineer agent to perform SAST, DAST, dependency auditing, secret scanning, and diff review, so that security risks are caught every sprint.

#### Acceptance Criteria

1. WHEN a Sprint starts, THE `security_engineer` Agent SHALL run a SAST pass over `src/` that detects the pattern set defined in `src/lib/sprint/security/sast-rules.json` covering at minimum: hardcoded secrets, `eval` usage, unsanitized `dangerouslySetInnerHTML`, missing authentication on API routes, raw SQL or NoSQL injection patterns, and missing CSRF checks on state-changing routes
2. WHEN the `security_engineer` Agent performs DAST, THE Journey_Runner SHALL drive the App through the probe suite in `src/lib/sprint/security/dast-probes.json` covering at minimum: IDOR on `/api/users/:id`, `/api/listings/:id`, and `/api/messages/*`; session fixation after login; SSRF via user-supplied URLs; rate-limit bypass via header manipulation; and unauthenticated access to admin routes
3. WHEN the `security_engineer` Agent performs a dependency audit, THE Sprint_Runner SHALL execute `npm audit --json` and create one Finding per advisory with severity mapped from the advisory's severity field
4. WHEN the `security_engineer` Agent performs a secret scan, THE Sprint_Runner SHALL scan the repository working tree using the regex set in `src/lib/sprint/security/secret-patterns.json` covering at minimum: AWS access keys, Stripe keys, Supabase service-role keys, private RSA keys, and `.env` files tracked by git
5. WHEN a Fix_Proposal reaches status `passed`, THE `security_engineer` Agent SHALL review the `fileChanges` and emit a Finding for any identified risk before Auto_Commit proceeds
6. IF the `security_engineer` Agent emits a Finding with severity `high` or `critical` against a `passed` Fix_Proposal, THEN THE Sprint_Runner SHALL block Auto_Commit and set the Fix_Proposal status to `rejected` with reason `security_review_blocked`
7. THE `security_engineer` Agent SHALL NOT initiate network requests to any host outside `localhost` or the configured test instance URL
8. THE Sprint_Runner SHALL record the full output of each security scan in `.kiro/sprints/<sprint_id>/security/<scan_type>.json`

---

### Requirement 8: LLM Client Configuration

**User Story:** As an admin, I want to configure which LLM provider and model back the agents, so that I can balance cost, latency, and quality.

#### Acceptance Criteria

1. THE LLM_Client SHALL support the providers `bedrock`, `openai`, and `anthropic` selected via the environment variable `SPRINT_LLM_PROVIDER`
2. THE LLM_Client SHALL read the model identifier from the environment variable `SPRINT_LLM_MODEL`
3. THE LLM_Client SHALL read credentials from provider-specific environment variables and SHALL NOT log credential values
4. WHEN an LLM request fails with a retryable error, THE LLM_Client SHALL retry up to 3 times with exponential backoff of 1, 4, and 16 seconds
5. WHEN an LLM request fails with a non-retryable error or after the final retry, THE LLM_Client SHALL return an error to the calling Agent and SHALL append the failure to `log.md`
6. THE LLM_Client SHALL enforce a per-request timeout of 120 seconds and a per-sprint token budget configured via `SPRINT_TOKEN_BUDGET`
7. IF the per-sprint token budget is exhausted, THEN THE Sprint_Runner SHALL transition the Sprint to status `closing` and record the budget exhaustion in `log.md`

---

### Requirement 9: Admin UI for Sprint Management

**User Story:** As an admin, I want a dedicated UI to create sprints, watch them run, inspect findings, and review auto-committed changes, so that I can operate the system without touching the terminal.

#### Acceptance Criteria

1. WHEN an admin navigates to `/admin/sprints`, THE Sprint_Runner SHALL display a paginated list of Sprints sorted by `createdAt` descending showing status, duration, selected roles, Finding counts by severity, and Fix_Proposal counts by status
2. WHEN an admin navigates to `/admin/sprints/new`, THE Sprint_Runner SHALL display a form to select Agent_Roles, Customer_Personas, duration, and sprint goals
3. WHEN an admin navigates to `/admin/sprints/<sprint_id>`, THE Sprint_Runner SHALL display the sprint metadata, live status, a tab for each Shared_Doc rendered as markdown, a Findings tab, a Fix_Proposals tab, and a Retrospective tab
4. WHILE a Sprint is in status `running` on the detail page, THE Sprint_Runner SHALL poll for updates every 5 seconds and refresh the displayed data
5. WHEN an admin clicks a Fix_Proposal with status `committed`, THE Sprint_Runner SHALL display the commit SHA, the diff, and buttons to "Merge to Main" and "Revert Commit"
6. WHEN an admin clicks "Merge to Main" on a committed Fix_Proposal, THE Sprint_Runner SHALL fast-forward or squash-merge the sprint branch commit into the `mainline` branch locally and record the merge in the Sprint record
7. WHEN an admin clicks "Revert Commit" on a committed Fix_Proposal, THE Sprint_Runner SHALL create a revert commit on the sprint branch and set the Fix_Proposal status to `reverted`
8. THE Sprint_Runner SHALL restrict all `/admin/sprints/*` routes to users with role `admin` via the existing `requireAdmin()` session guard
9. IF a non-admin user attempts to access `/admin/sprints/*`, THEN THE Sprint_Runner SHALL return a 403 response

---

### Requirement 10: Retrospective Generation

**User Story:** As an admin, I want every sprint to produce a written retrospective summarizing what was found, fixed, and what regressed, so that sprint-over-sprint improvement is measurable.

#### Acceptance Criteria

1. WHEN a Sprint transitions to status `closing`, THE `tech_lead` Agent SHALL write `retrospective.md` containing: sprint goals, list of Findings grouped by category and severity, list of Fix_Proposals with their final status, verification pass rate, and success-metric results
2. THE Retrospective SHALL report each of the following success metrics computed by the Sprint_Runner: test suite pass/fail counts, high-severity security finding count, number of Customer_Personas that completed all critical journeys, Lighthouse scores for Performance, Accessibility, Best Practices, and SEO on the homepage and the search page, regression count compared to the previous completed Sprint, and WCAG 2.1 AA violation count
3. THE Sprint_Runner SHALL compute the Lighthouse scores by running `lighthouse --output json` against the test instance of the App during sprint closing
4. WHEN a success metric falls below its threshold, THE Retrospective SHALL mark the metric as `regressed` and list the likely-responsible Fix_Proposals by ID
5. THE Sprint_Runner SHALL define the following thresholds as sprint-closing success criteria: test pass rate equal to 100 percent, zero Findings with severity `high` or `critical` and category `security`, every selected Customer_Persona completes every journey marked `critical`, Lighthouse scores for Performance, Accessibility, Best Practices, and SEO each at 90 or above, zero regressions relative to the previous completed Sprint, zero WCAG 2.1 AA violations reported by axe-core
6. WHEN all thresholds in the preceding criterion are met, THE Sprint_Runner SHALL mark the Sprint result as `met_success_bar` and record the result in the Sprint record
7. WHEN any threshold is not met, THE Sprint_Runner SHALL mark the Sprint result as `below_success_bar` and list the missed thresholds in the Retrospective

---

### Requirement 11: Kiro Spec Emission for Large Initiatives

**User Story:** As a tech lead, I want substantial fixes that span multiple files or require design to be emitted as new Kiro specs, so that humans can execute them through the existing spec workflow rather than auto-committing risky changes.

#### Acceptance Criteria

1. WHEN a Fix_Proposal's `fileChanges` touches more than 10 files or exceeds 500 changed lines, THE Kiro_Spec_Emitter SHALL emit a new spec at `.kiro/specs/<kebab_case_name>/` and set the Fix_Proposal status to `promoted_to_spec` instead of applying the changes
2. WHEN a Fix_Proposal's `findingIds` include any Finding where `category` is `security` and `severity` is `critical`, THE Kiro_Spec_Emitter SHALL emit a new spec and SHALL NOT Auto_Commit the change regardless of file-count heuristics
3. THE Kiro_Spec_Emitter SHALL produce `requirements.md`, `design.md`, and `tasks.md` in the new spec directory following the format used by existing specs in the repository
4. THE Kiro_Spec_Emitter SHALL produce a `.config.kiro` file in the new spec directory with `workflowType` set to `requirements-first` and `specType` set to `feature`
5. WHEN a new spec is emitted, THE Sprint_Runner SHALL add a link to the new spec path in `retrospective.md` under a section titled "Promoted Initiatives"
6. THE Kiro_Spec_Emitter SHALL derive the kebab-case spec name from the Fix_Proposal title and SHALL append a numeric suffix if the derived path already exists

---

### Requirement 12: Isolated Test Instance and Seeded Data

**User Story:** As a developer, I want sprints to run against an isolated App instance with seeded test data, so that sprints cannot affect production data or a developer's running dev server.

#### Acceptance Criteria

1. WHEN a Sprint enters status `running`, THE Sprint_Runner SHALL start a dedicated App instance on a port configured via `SPRINT_TEST_PORT` using a test MongoDB database named `apartment_finder_sprint_<sprint_id>`
2. THE Sprint_Runner SHALL seed the test database with a fixture set defined in `src/lib/sprint/fixtures/` containing users for each Customer_Persona role, sample listings, sample neighborhoods, sample blog articles, and sample messages
3. WHEN a Sprint transitions to status `completed` or `aborted`, THE Sprint_Runner SHALL drop the test MongoDB database and terminate the App instance
4. THE Sprint_Runner SHALL NOT use the production MongoDB connection string, Stripe live keys, or Resend production API key for any Sprint; test credentials SHALL be read from `.env.sprint`
5. IF the `.env.sprint` file is missing any required test credential, THEN THE Sprint_Runner SHALL reject Sprint creation with a descriptive error
6. THE Sprint_Runner SHALL allow at most one Sprint in status `running` at any time across the entire installation; a second start request SHALL be rejected with a 409 response

---

### Requirement 13: Auditability and Agent Action Logging

**User Story:** As an admin, I want a complete audit trail of every agent action, so that I can diagnose agent misbehavior and verify nothing happened outside the defined toolset.

#### Acceptance Criteria

1. THE Sprint_Runner SHALL define an allowed action set per Agent_Role in `src/lib/sprint/tools/<role>.json` listing the tool names each Agent may call
2. WHEN an Agent attempts to call a tool, THE Sprint_Runner SHALL verify the tool is in the Agent's allowed action set and SHALL reject the call with a logged error if it is not
3. WHEN an Agent calls an allowed tool, THE Sprint_Runner SHALL record a structured log entry containing: timestamp, sprintId, agentRole, toolName, parameterDigest (SHA-256 of parameters), and outcome status
4. THE Sprint_Runner SHALL persist action log entries to a MongoDB `sprintActionLog` collection with index `{ sprintId: 1, timestamp: 1 }`
5. WHEN an admin views a Sprint detail page, THE Sprint_Runner SHALL provide a downloadable export of all action log entries for that Sprint in JSON format
6. THE Sprint_Runner SHALL NOT include raw LLM response bodies or raw tool parameters in log entries unless the admin enables the `SPRINT_VERBOSE_LOGS` environment variable
