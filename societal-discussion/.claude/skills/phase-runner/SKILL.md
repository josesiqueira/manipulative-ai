---
name: phase-runner
description: >
  Orchestrator for multi-phase project implementation using parallel subagents.
  Use when building a project from a spec or implementing changes. Runs a loop per phase:
  code (3 agents) → audit (3 agents) → unit tests (3 agents) → e2e if UI (1 agent) → commit & push.
  Works with any stack (JS/TS, Python, Go, Rust, etc). Invoke with /phase-runner.
---

# Phase Runner — Multi-Agent Orchestrator

You are the orchestrator. You run in the main thread and dispatch subagents.
Subagents cannot spawn other subagents — all delegation flows through you.

## Dynamic project context (auto-injected)

The following data is pre-loaded automatically so you don't waste tokens exploring.

### Project file tree
```
!`find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/__pycache__/*' -not -path '*/target/*' | head -80`
```

### Stack info (if STACK.md exists)
```
!`cat STACK.md 2>/dev/null || echo "STACK.md not found — planner will create it at Step 0"`
```

### Current status (if STATUS.md exists)
```
!`cat STATUS.md 2>/dev/null || echo "STATUS.md not found — will be created after first phase completes"`
```

### Git remote
```
!`git remote -v 2>/dev/null | head -2 || echo "No git remote configured"`
```

### Package info (if applicable)
```
!`cat package.json 2>/dev/null | head -20 || cat requirements.txt 2>/dev/null | head -20 || cat Cargo.toml 2>/dev/null | head -20 || cat go.mod 2>/dev/null | head -10 || echo "No package file found"`
```

## Core principles

These guide every decision in the orchestration loop:

1. **Academic rigor.** Follow a systematic, methodical approach to software
   development. Correctness and reproducibility are non-negotiable. Every phase
   must pass with concrete, verifiable acceptance criteria — not vague "it works".
   Decisions should be documented and reasoning should be traceable.

2. **Less code, more quality.** Prefer efficient, explainable implementations over
   verbose ones. If a framework has a built-in feature, use it. Every function
   should be self-documenting or well-commented with the reasoning behind the approach.

3. **Testing as a first-class citizen.** Testing is not an afterthought — it validates
   that the code does what it's supposed to. Test plans must include concrete
   reference values. Tests must verify reproducibility, not just absence of crashes.

4. **Always check current documentation.** Before any implementation or testing phase,
   agents must consult the documentation URLs in STACK.md. APIs change between versions;
   outdated patterns waste cycles in fix loops.

## Prerequisites

Before starting, verify:
1. A spec file exists (user provides the path — SPEC.md or CHANGES.md)
2. `.claude/agents/` contains: `planner.md`, `coder.md`, `tester.md`, `test-planner.md`, `unit-tester.md`, `e2e-tester.md`, `frontend-designer.md`, `readme-updater.md`
3. `.claude/skills/` contains: `test-suite/SKILL.md`, `frontend-design/SKILL.md`, `readme-updater/SKILL.md`
4. The repo is initialized with a remote (`git remote -v`)

If anything is missing, tell the user and stop.

## The loop

```
STEP 0: PLAN
  └─ planner agent → STACK.md + PLAN.md → user approves
  └─ frontend-designer agent → design-system/ folder (if project has UI)

FOR each phase in PLAN.md:

  STEP 1: IMPLEMENT
    └─ up to 3 coder agents (parallel) → write code

  STEP 2: AUDIT
    └─ 3 tester agents (parallel, read-only) → check acceptance criteria
    └─ frontend-designer agent (if has_ui) → audit UI against design system
    └─ FAIL? → fix cycle (max 3) → re-audit
    └─ PASS? → continue

  STEP 3: UNIT TESTS
    └─ test-planner agent → update TEST-PLAN.md
    └─ up to 3 unit-tester agents (parallel) → write + run tests
    └─ FAIL (app bug)? → fix cycle → re-test
    └─ PASS? → continue

  STEP 4: E2E TESTS (only if has_ui = true)
    └─ 1 e2e-tester agent → browser tests on desktop + mobile
    └─ FAIL? → fix cycle → re-test
    └─ PASS? → continue

  STEP 5: COMMIT & PUSH
    └─ readme-updater agent → update README.md
    └─ git add → commit → push

AFTER ALL PHASES:
  STEP 6: FULL REGRESSION + FINAL REPORT
    └─ readme-updater agent → final README pass
```

---

## Step 0 — Plan

```
Use the planner agent: Read [spec file path] and create STACK.md (stack detection
with documentation URLs) and PLAN.md (implementation phases). If this is an existing
project (CHANGES.md), scan the codebase first. Check current documentation for the
detected stack before planning. Include parallel split suggestions and has_ui flags.
```

After the planner finishes:
1. Show the user: phase count, names, complexity, dependencies.
2. Ask: **"Does this plan look good? Should I adjust anything before starting?"**
3. Wait for approval. If changes needed, re-invoke planner with feedback.

Also verify STACK.md was created. If not, create it yourself by scanning the project.

**If any phase has `has_ui: true`**, create the design system before coding starts:

```
Use the frontend-designer agent: Read [spec file path] and STACK.md.
Create the design-system/ folder with tokens.css, AESTHETIC.md, COMPONENTS.md,
and ACCESSIBILITY.md. Choose a distinctive aesthetic direction that fits the
project's purpose and audience. Read the frontend-design skill first.
```

Show the user the chosen aesthetic direction and ask for approval.
If the project has NO UI phases, skip this step.

---

## Step 1 — Implement

Read PLAN.md for the current phase. Read the parallel split suggestion.
Dispatch coder agents — use as many as needed (1-3) based on task count.

**For 1-3 tasks:**
```
Use the coder agent: Implement Phase [N], all tasks from PLAN.md.
Stack info and documentation URLs in STACK.md. Check the current docs before coding.
Prefer using framework built-ins over custom code.
If this phase has UI: read design-system/tokens.css and COMPONENTS.md before writing
any UI code. Use ONLY the defined tokens — no hardcoded colors, spacing, or fonts.
[list existing files relevant to this phase]
```

**For 4-6 tasks:**
```
Use the coder agent: Implement Phase [N], tasks [1-3] from PLAN.md.
Stack info and documentation URLs in STACK.md. Check docs before coding.
If UI tasks: read design-system/ files first, use only defined tokens. [context]
```
```
Use the coder agent: Implement Phase [N], tasks [4-6] from PLAN.md.
Stack info and documentation URLs in STACK.md. Check docs before coding.
If UI tasks: read design-system/ files first, use only defined tokens. [context]
```

**For 7+ tasks:**
Split across 3 agents following the parallel split in PLAN.md.
Ensure shared files (utilities, types) are assigned to Agent A.
Tell agents B and C to assume Agent A's shared files exist.

**After all agents finish:**
Check for file conflicts — if two agents modified the same file:
1. `git diff` to see the conflict
2. Keep the version from the agent whose tasks "own" that file per PLAN.md
3. Re-apply the other agent's changes if needed

---

## Step 2 — Audit

Invoke 3 tester agents in parallel, each with a different focus:

```
Use the tester agent: Audit Phase [N] from PLAN.md.
Focus: correctness — check every acceptance criterion, verify logic and results.
Stack info and doc URLs in STACK.md. Do NOT modify any files.
```

```
Use the tester agent: Audit Phase [N] from PLAN.md.
Focus: edge-cases — check error handling, boundary values, null inputs.
Stack info and doc URLs in STACK.md. Do NOT modify any files.
```

```
Use the tester agent: Audit Phase [N] from PLAN.md.
Focus: integration — build verification, test regression, code quality, efficiency,
explainability, and check for deprecated APIs against current docs.
Stack info and doc URLs in STACK.md. Do NOT modify any files.
```

**If this phase has `has_ui: true`**, also invoke the frontend-designer as a 4th auditor:

```
Use the frontend-designer agent: Audit the UI in Phase [N].
Review all UI files against design-system/tokens.css, COMPONENTS.md, AESTHETIC.md,
and ACCESSIBILITY.md. Flag AI slop patterns, hardcoded values, missing states,
and accessibility violations. Read the frontend-design skill first.
```

**Evaluate**: Read all `AUDIT-phase-N-*.md` files (including `AUDIT-phase-N-ui.md` if UI).
- ALL say PROCEED → continue to Step 3.
- ANY says FIX REQUIRED → go to Fix Cycle.

---

## Step 3 — Unit tests

**3a — Plan test cases:**
```
Use the test-planner agent: Analyze the files created/modified in Phase [N]
(see PLAN.md for the file list). Create or update TEST-PLAN.md with test cases
for the new code only. Include concrete reference values for all test cases.
Stack info and doc URLs in STACK.md.
```

**3b — Run tests (up to 3 agents parallel):**

Read TEST-PLAN.md. Collect new UT-xxx and CT-xxx IDs. Split into groups.

```
Use the unit-tester agent: Implement and run test cases [UT-001 to UT-010]
from TEST-PLAN.md. Stack info and doc URLs in STACK.md. Use exact reference values
from the test plan. Also run ALL existing tests for regression.
```

(Repeat for other groups.)

**Evaluate**: Read all `TEST-RESULTS-unit-*.md` files.
- ALL PASS → continue to Step 4.
- FAILURES that are app bugs → Fix Cycle, then re-run Step 3b (just failing tests).
- Test issues → agents should have fixed these already.

---

## Step 4 — E2E tests (conditional)

**Skip** if `has_ui: false` for this phase in PLAN.md.

```
Use the e2e-tester agent: Implement and run the E2E test cases for Phase [N]
from TEST-PLAN.md. Stack info and doc URLs in STACK.md (use preview_command to start
the server, check e2e_docs for current API). Test desktop (1280x720) and mobile
(375x667). Also run ALL existing E2E tests.
```

Only 1 agent — parallelizing browser tests against one server is fragile.

**Evaluate**: Read `TEST-RESULTS-e2e.md`.
- ALL PASS → continue to Step 5.
- FAIL → Fix Cycle.
- FLAKY (passed on retry) → note it, continue.

---

## Step 5 — Commit & push

**5a — Update README (runs in background):**

The readme-updater agent has `background: true`, so it runs without blocking
the main thread. Dispatch it before committing — it will update README.md
while you prepare the commit.

```
Use the readme-updater agent: Update README.md to reflect the current state
after Phase [N]. Read PLAN.md, STATUS.md, STACK.md, and TEST-RESULTS files.
Read the readme-updater skill first. Only update relevant sections — don't rewrite everything.
```

**5b — Meanwhile, update STATUS.md and commit:**

```markdown
| N | ✅ DONE | [fix cycles] | [unit tests] pass | [e2e tests] pass | [commit hash] |
```

Wait for the readme-updater to finish (check background agents), then:

```bash
git add -A
git commit -m "feat(phase-N): [phase name from PLAN.md]

- [1-line summary of what was built]
- Tests: [X] unit, [Y] component, [Z] e2e — all passing
- Audited by 3+ agents, fix cycles: [N]"

git push origin main
```

Report to the user:
- Phase name and what was built
- Test summary
- Fix cycles needed
- Any concerns from audits
- Confirm push succeeded

Proceed to next phase (back to Step 1).

---

## Step 6 — Full regression (after all phases)

**6a — Run ALL tests:**
Read STACK.md for the test commands and run them:
- Unit/component tests: the full test runner command
- E2E tests: the full e2e runner command
- Build verification: the build command

**6b — Final report:**

Create `FINAL-REPORT.md`:

```markdown
# Final Report
Date: [date]
Spec: [spec file]
Repository: [remote URL]
Stack: [from STACK.md]

## Summary
| Metric | Value |
|--------|-------|
| Total phases | N |
| Total fix cycles | N |
| Total commits | N |

## Test coverage
| Layer | Tests | Passed | Failed |
|-------|-------|--------|--------|
| Unit  | N     | N      | 0      |
| Component | N | N      | 0      |
| E2E   | N     | N      | 0      |

## Phases
| Phase | Name | Fix cycles | Tests added | Commit |
|-------|------|------------|-------------|--------|
| 1     | ...  | 0          | 12 unit     | abc123 |
| 2     | ...  | 1          | 8 unit, 5 e2e | def456 |

## Build: PASS
## Ready for deploy: YES / NO
```

```bash
git add -A
git commit -m "docs: final report and test summary"
git push origin main
```

**6c — Final README pass:**

```
Use the readme-updater agent: Final pass on README.md. All phases are complete.
Read FINAL-REPORT.md for complete test coverage numbers and phase summary.
Update the Features section to reflect everything that's implemented.
Update Testing section with final counts. Add deployment instructions if applicable.
Read the readme-updater skill first.
```

```bash
git add -A
git commit -m "docs: final README update"
git push origin main
```

Ask: **"All phases complete. [N] unit tests, [M] e2e tests, all passing. Ready to deploy?"**

---

## Fix cycle

When any step reports FIX REQUIRED:

1. **Collect ALL bugs** from all reports into a single list.
2. **Dispatch coder agents** with the bug list:
   ```
   Use the coder agent: Fix the following bugs in Phase [N]:
   [paste bug descriptions with file paths, expected vs actual]
   Stack info and doc URLs in STACK.md. Check current docs if the bug involves
   framework API usage. Fix the root cause, not the symptom. Run tests after fixing.
   ```
   Use 1-3 coders depending on bug count and file spread.

3. **Re-run ONLY the step that failed:**
   - Audit failed → re-run Step 2
   - Unit tests failed → re-run Step 3b (just failing tests + regression)
   - E2E failed → re-run Step 4

4. **Maximum 3 fix cycles per step per phase.**
   After 3 cycles still failing → STOP and ask the user:
   **"Phase [N] has failed [step] 3 times. Here's what's still broken: [list].
   Should I try a different approach, skip this phase, or do you want to fix it manually?"**

5. **Each fix cycle gets a commit** (but push only happens in Step 5):
   ```bash
   git add -A
   git commit -m "fix(phase-N): [brief description]"
   ```

---

## Task splitting strategy

When dividing tasks among coder agents:
1. **By file**: different files → different agents. One file = one agent, always.
2. **By layer**: frontend / backend / config → split by layer.
3. **Dependencies within phase**: if task B needs task A's output, same agent.
4. **Shared utilities**: assign to Agent A. Tell B and C the API shape.

## Status tracking

Maintain `STATUS.md` in the project root:

```markdown
# Project Status
Last updated: [timestamp]
Repository: [remote URL]
Stack: [from STACK.md]

| Phase | Status | Fix cycles | Tests | Commit |
|-------|--------|------------|-------|--------|
| 1     | ✅ DONE | 0         | 12 unit | abc123 |
| 2     | ✅ DONE | 1         | 8 unit, 5 e2e | def456 |
| 3     | 🔄 IN PROGRESS | 0 | | |
| 4     | ⏳ PENDING | | | |
```

## Git conventions

- **Branch**: `main` unless user says otherwise
- **Commits**: `feat(phase-N):` for phases, `fix(phase-N):` for fix cycles, `docs:` for reports
- **Push**: after every completed phase and after final report
- **Never force push** — if push fails, tell the user
- **Tag**: after Step 6, suggest `git tag v1.0.0 && git push --tags`

## Token cost awareness

Subagents multiply token usage (4-7x a normal session). To keep costs sane:
- Use the minimum number of agents needed. 2 tasks? 1 agent, not 3.
- Tester agents are on `sonnet` and read-only — cheapest possible.
- Don't re-run ALL tests in every fix cycle — just the failing ones + regression.
- If a phase is trivially simple (1-2 tasks, no UI), consider skipping the audit step.
