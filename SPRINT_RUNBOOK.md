# Virtual Team Sprint Runner — Launch Runbook

This is the step-by-step checklist for firing your first sprint against the
Apartment Finder app. Every step is required unless marked **optional**.

---

## 0. What a sprint does

One sprint spawns an isolated copy of the app on a dedicated port, seeds it
with fixture data, then runs a simulated development team (tech lead, devs,
QA, security, UX, accessibility, DevOps, PM) and a set of customer personas
against the copy for a fixed duration. Findings are written to a shared
markdown workspace, fixes get proposed + verified + auto-committed on a
dedicated `sprint/...` branch, and a retrospective is written at close.

None of this touches your real MongoDB, your current branch, or any remote.

---

## 1. One-time setup

### 1.1 Install Playwright browsers *(required for browser-based journeys / axe / Lighthouse)*

```bash
npx playwright install chromium
```

If you skip this, every browser-mode journey and the `a11y.run_axe` tool
cleanly degrade to `status: "skipped"`. API-mode journeys still work.

### 1.2 Create `.env.sprint`

Copy the example and fill in real values:

```bash
cp .env.sprint.example .env.sprint
```

You MUST set:

- `SPRINT_LLM_PROVIDER` — one of `bedrock` | `openai` | `anthropic`
- `SPRINT_LLM_MODEL` — model id for the provider you chose
- `SPRINT_TEST_PORT` — a free port, e.g. `3100` (do NOT use `3000`, that's dev)
- `SPRINT_TEST_BASE_URL` — `http://localhost:${SPRINT_TEST_PORT}`
- `SPRINT_TOKEN_BUDGET` — e.g. `500000` (the per-sprint LLM token cap)
- `MONGODB_URI` — **MUST NOT** be your production cluster. A local Mongo
  like `mongodb://localhost:27017/apartment_finder_sprint` is ideal. The
  env loader emits a warning if the URI contains `prod` / `production`.

Plus the credentials block for whichever provider you chose:

- Bedrock: `AWS_REGION` (credentials via the default AWS SDK chain)
- OpenAI: `OPENAI_API_KEY`
- Anthropic: `ANTHROPIC_API_KEY`

### 1.3 Start a local MongoDB *(required)*

Anything your dev machine already has, or:

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Docker
docker run -d -p 27017:27017 --name mongo-sprint mongo:7
```

### 1.4 Promote an admin user in that local Mongo *(required)*

The CLI needs an admin user's `_id` as the `createdBy` field.
Open a mongo shell against your `SPRINT_TEST_PORT` database or its parent
database (depends on your `MONGODB_URI`) and either:

**Option A — seed a fresh admin** (if the DB is empty):

```js
use apartment_finder_sprint
db.users.insertOne({
  email: "admin@sprint.local",
  fullName: "Sprint Admin",
  role: "admin",
  supabaseId: "sprint-admin-local",
  preferredLanguage: "en",
  preferredCurrency: "EUR",
  emailVerified: true,
  idVerified: true,
  profileCompleted: true,
  passwordHash: "TEST_HASH_LOCAL_ONLY",
  createdAt: new Date(),
  updatedAt: new Date(),
})
```

**Option B — promote an existing user**:

```js
db.users.updateOne({ email: "you@domain.com" }, { $set: { role: "admin" } })
```

Note the returned `_id` — you'll pass it to `--created-by` when creating the
sprint.

---

## 2. Per-sprint checklist

### 2.1 Run the preflight

```bash
npm run sprint:precheck
# or directly:
# npx tsx scripts/sprint-precheck.ts
```

This checks `.env.sprint`, Mongo connectivity, the `.next/` build, the
configured port, and Playwright browsers. Fix any `❌` before going further.
`⚠️` warnings are safe to proceed with.

### 2.2 Build the app

`next start` requires a prior production build. Rebuild any time you want
the sprint to exercise your latest code:

```bash
npm run build
```

### 2.3 Create a sprint

```bash
npm run sprint -- create \
  --roles tech_lead,senior_dev,frontend_dev,backend_dev,qa_engineer,security_engineer,ux_designer,accessibility_specialist,devops_engineer,product_manager \
  --personas student_sharer,relocating_professional,family_long_term,screen_reader_user,adversarial_probe \
  --duration 60 \
  --goals "Audit all admin routes for auth,Run a full a11y sweep,Profile the search page,Flag any critical security finding" \
  --branch mainline \
  --created-by <YOUR_ADMIN_USER_OBJECT_ID>
```

The command prints a sprint id on success. Save it.

### 2.4 Start the sprint

```bash
npm run sprint -- start <sprintId>
```

This spawns the isolated app instance on `SPRINT_TEST_PORT`, creates the
sprint-owned Mongo database (`apartment_finder_sprint_<id>`), freezes the
per-role tool allow-lists, and starts the tick scheduler (500 ms stagger
between agent steps).

### 2.5 Watch it run

```bash
# JSON snapshot
npm run sprint -- status <sprintId>

# tail of log.md
npm run sprint -- logs <sprintId>
```

Or open the admin UI at:

```
http://localhost:3000/admin/sprints/<sprintId>
```

(That's your normal dev server port, not `SPRINT_TEST_PORT`.)

### 2.6 Hard stop (if needed)

```bash
npm run sprint -- abort <sprintId> --reason "manual stop"
```

This signals the scheduler to stop, waits up to 30 s for in-flight ticks
to settle, transitions the sprint to `aborted`, drops the test DB, and
stops the child process. Artifacts on disk are preserved.

### 2.7 Natural completion

The sprint transitions to `closing` when either:

- the configured duration elapses, OR
- the per-sprint token budget is exhausted

The tech lead then writes `retrospective.md` and the sprint transitions to
`completed`. Fix proposals that landed on their sprint branches stay there
until an admin merges them (via the `/admin/sprints/<id>` UI or the action
API) — nothing is ever pushed to a remote.

---

## 3. Artifacts you'll have after a sprint

Under `.kiro/sprints/<sprintId>/`:

```
plan.md                    # tech lead's working plan
log.md                     # timestamped entry per agent action
findings.md                # one block per persisted finding
retrospective.md           # written at closing
tickets/<id>.md            # one per ticket the tech lead opened
security/sast.json         # raw SAST scan output
security/secrets.json      # raw secret scan output
security/npm-audit.json    # raw npm audit output
security/review-<fix>.json # per fix-proposal diff review
a11y/<url>.json            # axe-core results per scanned URL
lighthouse/<url>.json      # full LHR per audited page
```

Plus in MongoDB:

- `sprints` — the Sprint record
- `findings` — structured findings with dedup signatures
- `fixProposals` — proposals + their verification reports
- `sprintActionLog` — every tool call (you can download this via the
  artifacts endpoint: `GET /api/admin/sprints/<id>/artifacts?download=actionLog`)

Plus in git:

- `sprint/<sprintId>/fix-<proposalId>` — one branch per auto-committed fix.
  Nothing is ever pushed.

---

## 4. When a fix doesn't auto-commit

The fix is promoted to a new spec under `.kiro/specs/<kebab-name>/`
whenever any of:

- it touches more than 10 files
- it changes more than 500 lines
- it's linked to a critical-severity security finding

The proposal's status flips to `promoted_to_spec` and a link is appended to
`retrospective.md` under "Promoted Initiatives". Review the generated
spec and run it through the normal Kiro spec workflow.

---

## 5. Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `ENV_MISSING` on create | a required key in `.env.sprint` is blank | Re-run `sprint:precheck` |
| `CONCURRENT_SPRINT` on create | another sprint is `running` or `closing` | `sprint list` to find it, then `sprint abort <id>` |
| Health check timeout on start | `.next/` missing or stale | `npm run build` |
| `port in use` on start | `SPRINT_TEST_PORT` is taken | Free the port or change it in `.env.sprint` |
| LLM retries in log.md | provider transient failures | Retries are 1/4/16 s; sprint will proceed |
| Fix verification timeout | test suite runs > 10 min | That's the cap — split the fix |
| `GitSafetyError` in log.md | wrapper blocked a push/force/remote op | Investigate the log; never disable the guard |

---

## 6. What the runner will NOT do

- Push to any remote
- Force-push
- Modify your currently-checked-out branch
- Use production MongoDB credentials
- Auto-commit fixes that fail verification or are flagged by the security
  engineer agent
- Auto-commit oversized or critical-security fixes (those route to specs)
- Log LLM API keys, AWS access keys, or other secrets

Every one of these is enforced by a specific guard with a dedicated
property test in the design. If you ever see evidence to the contrary,
treat it as a bug, not a feature.


---

## Performance budget (enforced by the DevOps sprint agent)

Each sprint's DevOps agent runs Lighthouse against these routes and fails the
sprint if any route falls below the thresholds below. Targets are drawn from
Requirement 57 of the webapp-excellence-audit spec.

### Route thresholds (Lighthouse category scores)

| Route             | Performance | Accessibility | Best practices | SEO |
|-------------------|:-----------:|:-------------:|:--------------:|:---:|
| `/`               |    ≥ 90     |     ≥ 95      |     ≥ 90       | ≥ 90 |
| `/search`         |    ≥ 90     |     ≥ 95      |     ≥ 90       | ≥ 90 |
| `/listings/[id]`  |    ≥ 90     |     ≥ 95      |     ≥ 90       | ≥ 90 |
| `/users/[id]`     |    ≥ 90     |     ≥ 95      |     ≥ 90       | ≥ 90 |

### Web Vitals targets

| Metric | Target |
|--------|:------:|
| LCP    | < 2.5 s |
| INP    | < 200 ms |
| CLS    | < 0.1 |
| FID    | < 100 ms (legacy)  |

A sprint will be marked **failed** if:
- Any route's Performance score < 90
- LCP > 2.5 s on `/`, `/search`, or `/listings/[id]`
- INP > 200 ms on `/search` (critical interaction path)

### Regression detection

Every sprint stores the raw Lighthouse report in the workspace. The DevOps
agent compares the current report to the most recent successfully completed
sprint and treats a Performance-score drop > 5 points as a regression, which
surfaces as a _high_ finding in the retrospective.
