# Plan 4: Deployment, documentation and event operations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Rahti deployment runs the 18-condition, consent-gated app with GPT-6 Astra on 23 October 2026; the repo documents the new design; the placeholders in the participant texts are resolved; the event has a checklist for opening and closing the study.

**Architecture:** Configuration only (k8s env, admin panel model choice), documentation edits, and a dated checklist. No application code.

**Tech Stack:** OpenShift (CSC Rahti), `oc` CLI, Markdown.

**Spec:** `docs/superpowers/specs/2026-09-18-metso-demo-design.md` (E1, E3, sections 6 and 8)

**Depends on:** Plans 1, 2, 3 merged to `main`.

## Global Constraints

- No em dashes or en dashes anywhere. Never use "baked", "baked in", "thin".
- `RAHTI-RUNBOOK.md` is gitignored (local only); event steps that must survive in the repo go into `societal-discussion/README.md` or `METHODS.md`, not the runbook.
- Do not push images or scale deployments without the researcher present; this plan's deploy steps are run by a human on the day before the event.

---

### Task 1: Deployment manifest: all 18 conditions

**Files:**
- Modify: `societal-discussion/k8s/api-deployment.yaml:44-51`

- [ ] **Step 1: Set FORCED_PARTY to empty**

Replace the comment and value:

```yaml
            # Metso demo (23.10.2026): empty value = normal no-repeat weighted
            # random assignment across all registered conditions (9 parties
            # plus their populist twins). Set a comma-separated list to
            # restrict the pool, e.g. "sdp,sdp_populist".
            - name: FORCED_PARTY
              value: ""
```

- [ ] **Step 2: Confirm which Dockerfile Rahti builds**

Run: `grep -rn "Dockerfile" societal-discussion/Makefile societal-discussion/RAHTI-RUNBOOK.md RAHTI-RUNBOOK.md 2>/dev/null`
Expected: the API image build references `docker/Dockerfile.api` (whose CMD runs `alembic upgrade head`). If it references `apps/api/Dockerfile` instead, migration 005 would not run; change that build to `docker/Dockerfile.api` or add `alembic upgrade head &&` to the CMD in `apps/api/Dockerfile:47`.

- [ ] **Step 3: Commit**

```bash
git add societal-discussion/k8s/api-deployment.yaml
git commit -m "Deploy: assign across all 18 conditions for the Metso demo"
```

---

### Task 2: Resolve participant-text placeholders

**Files:**
- Modify: `societal-discussion/apps/web/src/content/notices.ts`
- Modify: `societal-discussion/apps/web/src/lib/studyConfig.ts`
- Modify: `docs/consent/2026-10-23-metso-consent-package.md` (section 2 decisions table only)

- [ ] **Step 1: List what is still bracketed**

Run: `grep -n -o "\[[A-ZÄÖ][A-ZÄÖ :,/0-9-]*\]" societal-discussion/apps/web/src/content/notices.ts | sort | uniq -c`
Expected: a short list such as `[CONTROLLER ...]`, `[DPO email]`, `[ETHICS ...]`, `[RETENTION END]` if any slipped through.

- [ ] **Step 2: Fill each one from the decisions**

For each bracket, take the value decided by the researcher and DPO (package section 2, D1 to D13). Where a decision is still open on the day, use the recommended value and record it in the package's section 2 table with "used as default on 23.10.2026". Keep `STUDY` in `studyConfig.ts` as the single place for retention date, controllers and emails, and reference it from `notices.ts` via template literals rather than repeating literals.

- [ ] **Step 3: Verify no brackets remain and no dashes crept in**

Run: `grep -c -E "\[[A-ZÄÖ]{3,}" societal-discussion/apps/web/src/content/notices.ts; grep -c -E "—|–" societal-discussion/apps/web/src/content/notices.ts societal-discussion/apps/web/src/lib/translations.ts`
Expected: `0` for the bracket count; for the dash count the only hits allowed are the pre-existing "3–5 minuuttia" and "2–3" strings in the landing/survey copy (change those to "3 to 5" / "2 to 3" while here).

- [ ] **Step 4: Commit**

```bash
git add societal-discussion/apps/web/src/content/notices.ts societal-discussion/apps/web/src/lib/studyConfig.ts societal-discussion/apps/web/src/lib/translations.ts docs/consent/2026-10-23-metso-consent-package.md
git commit -m "Resolve participant-text placeholders for the Metso demo"
```

---

### Task 3: Methods and README updates

**Files:**
- Modify: `societal-discussion/METHODS.md`
- Modify: `README.md` (root)
- Modify: `docs/consent/2026-10-23-metso-consent-package.md` (prepend a correction note)

- [ ] **Step 1: METHODS.md**

Edit these sections:

Section 1 (goal): replace "There are 9 conditions (one per party)" with "There are 18 conditions: 9 parties, each in a vanilla and a populism-augmented variant (`<party>_populist`). The populist variant reads the identical corpus and adds one fixed markers section (us-vs-them, people-centrism, anti-elitism; Cranmer 2011) to the behavioral instruction, so the treatment is constant across parties."

Section 6 (assignment): change "picks one of the 9 parties" to "picks one of the 18 conditions" and "When all 9 have been used" to "When all 18 have been used".

Section 8 (model): replace the GPT-5.4 paragraph with: "Model: OpenAI GPT-6 Astra (registry id as verified in `services/llm_models.py`). Requests are sent with `store=false` and without `temperature` (GPT-6 Astra rejects it; `openai_provider.py` skips it for `gpt-5.5*` and `gpt-6*`). HEPP2026 data was collected with GPT-5.4 at temperature 0.1."

Section 9 (access gate): append: "From the Metso demo (23.10.2026) the participant flow starts with a consent page: three checkboxes (18+, read and voluntary and aware the viewpoint is undisclosed, US-transfer acknowledgement), recorded on the session as `consent_accepted_at`, `consent_version`, `age_confirmed`. Conversations cannot be created for a non-test session without consent."

Section 10 (data): add rows `consent_accepted_at`, `consent_version`, `age_confirmed`, `data_deleted_at` under `sessions`.

New section 14 "Debriefing and data rights": "After the survey the thank-you page reveals, per conversation, the party and whether the populist framing was on (TENK 2019 requires disclosing the true nature of the study). It shows a session code (first 8 hex characters of the session UUID, `XXXX-XXXX`) and a delete button. Deletion removes message and survey rows and keeps conversation rows as a tombstone with the condition and timestamps. Researchers can find a session by code in the admin API (`GET /api/admin/sessions/by-code/{code}`). Consent texts, privacy notice and research notification: `docs/consent/2026-10-23-metso-consent-package.md`."

Quick-reference table: add rows for `services/session_code.py`, `app/consent/page.tsx`, `app/thank-you/page.tsx`, `content/notices.ts`, `lib/providerNotice.ts`, `lib/studyConfig.ts`.

- [ ] **Step 2: Root README**

In "What it does" step 1, after "clicks Start conversation" add "accepts the research notification on a consent page,". Step 2: replace "(currently a coin flip between Perussuomalaiset and the populism-marker variant Perussuomalaiset Populist)" with "(18 conditions: 9 parties, each vanilla or populism-augmented)". Step 4: append "and then sees a debrief naming the party, with a session code and a delete button". Tech stack LLM line: "OpenAI GPT-6 Astra (HEPP2026 used GPT-5.4)". Releases table: add a row `METSO2026 | October 2026 | Public demo at Metso, Tampere: 18 conditions, consent gate, debrief, GPT-6 Astra` (tag to be created after the event).

- [ ] **Step 3: Correction note in the package**

Prepend to `docs/consent/2026-10-23-metso-consent-package.md`, after the title:

```markdown
> Correction (18.9.2026): the context pack stated that message content is encrypted at rest. It is not; only API keys are encrypted (`services/encryption.py`). All participant-facing texts therefore say "stored on CSC servers in Finland; only the research team has access" instead of "stored encrypted". Privacy notice section 15 must not tick an encryption box unless message encryption is implemented.
```

Then search the package for "encrypt" / "salattu" and edit each participant-facing occurrence to the corrected wording.

- [ ] **Step 4: Dash check and commit**

Run: `grep -n -E "—|–" societal-discussion/METHODS.md README.md | head`
Expected: only pre-existing occurrences outside the edited paragraphs (leave them; rewriting the whole file is out of scope).

```bash
git add societal-discussion/METHODS.md README.md docs/consent/2026-10-23-metso-consent-package.md
git commit -m "Document 18 conditions, consent gate, debrief and GPT-6 Astra"
```

---

### Task 4: Event checklist (before, during, after)

**Files:**
- Create: `docs/consent/2026-10-23-event-checklist.md`

- [ ] **Step 1: Write the checklist**

```markdown
# Metso demo checklist, 23.10.2026

## Blocking before deploy (owner: José)
- [ ] Ethics: amendment or new statement filed; committee answer received or documented as pending with PI sign-off.
- [ ] DPO(s) confirmed controller (D1), legal basis (D2), retention end (D3), age threshold (D4); values match `studyConfig.ts`.
- [ ] DPIA signed and stored in the project Teams folder.
- [ ] OpenAI: university account, DPA executed, DPF listing checked, `gpt-6-astra` visible to the project, `store=false` confirmed in code.
- [ ] OpenAI budget: set a monthly spend limit on the project. Estimate: 60 participants x 3 conversations x 6 turns x about 120K tokens = about 130M input tokens; roughly $1,300 uncached or $130 if prompt caching hits ($10 vs $1 per 1M). Confirm caching works in the day-before try-bot test (Plan 1 Task 5 Step 7).
- [ ] CSC: encryption secret lives in an OpenShift Secret, MFA on the Rahti project, PV size sufficient.
- [ ] `grep -c "\[" apps/web/src/content/notices.ts` shows no unresolved placeholders.

## Day before (22.10)
- [ ] Merge main, build and push api and web images, `oc rollout status` both deployments.
- [ ] `oc logs deploy/api | grep alembic` shows `005_consent`.
- [ ] Admin: select GPT-6 Astra, save; try-bot one message per condition family (any base, any populist).
- [ ] Phone test of the full flow over mobile data: consent, chat, survey, debrief, delete.
- [ ] Print the QR slide (package section 4e) and the spoken announcement.
- [ ] Reset test data: `DELETE /api/admin/data/reset` (test-mode rows only after confirming no real data is present).

## During (16:00 to 18:00)
- [ ] Read the spoken announcement (say "tutkimus" and "18+").
- [ ] Watch `/admin` for error spikes; keep a laptop on the API logs.
- [ ] Never say the bot is neutral, balanced or factual.

## After
- [ ] 24.10: `oc scale deploy/web --replicas=0` (QR link goes dark); keep the api up until export.
- [ ] Export csv, json, messages-csv, surveys; verify row counts; copy to the project Teams folder.
- [ ] Handle any emailed deletion requests by code (`GET /api/admin/sessions/by-code/{code}` then `DELETE /api/sessions/{id}/data`).
- [ ] Tag the release: `git tag -a METSO2026 -m "Metso public demo 23.10.2026"` and `git push origin METSO2026`.
- [ ] On the retention end date: delete the Rahti PV and the Teams copies; record the deletion.
```

- [ ] **Step 2: Commit**

```bash
git add docs/consent/2026-10-23-event-checklist.md
git commit -m "Add Metso demo event checklist"
```

---

## Self-review

- Spec coverage: E1 (Task 1), E3 model selection (Task 4 day-before), section 6 operations (Task 4), section 8 human decisions (Task 4 blocking list), package correction on encryption (Task 3), docs (Task 3), placeholders (Task 2).
- Nothing in this plan changes application behavior; all code paths were built and tested in Plans 1 to 3.
