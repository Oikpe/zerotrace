# ZeroTrace — UTS Cloud Services Master Plan

**Canonical plan:** `docs/UTS_MASTER_PLAN.md`  
**Version:** 2.0 — consolidated on 9 November 2026  
**State:** Scaffold ready; implementation of ZeroTrace not started.  
**Course:** COMP6991031 Cloud Services, BINUS Bandung, LA75.

> **Source of truth:** The original five-page UTS PDF is authoritative. This plan paraphrases its requirements and tracks verified decisions, proposals, and work still to be done. If this plan or another AI assistant conflicts with the PDF, follow the PDF. Lecturer chat screenshots are informal guidance unless an official update is established.
>
> **Do not use the older `UTS_CLOUD_MASTER_PLAN.md` v1.0 or the separate Work/visual addenda as the current instruction set.** This v2.0 incorporates their relevant findings and actual IntelliJ progress. Update this file as the project changes.

## 0. Time, academic rules, and administrative gates

- **Final submission:** Tuesday, **10 November 2026 at 13:00 WIB**, through Exam Apps; late work is not assessed.
- **Topic registration:** within **3 hours of the actual LMS release**, register title, category (Web/AI), framework, and a one-sentence description. **Release time, registration channel, and actual submission status are not yet verified.** Confirm immediately; a distinctive idea does not waive registration.
- This is an **individual** take-home web/AI project. The PDF says one core feature is sufficient and emphasizes containerization. It describes roughly 3–4 hours intended work within a 24-hour window; do not treat that as a guarantee for this specific scope.
- **AI Partial:** AI assistance is limited to **50% of the entire work process in aggregate** across GPT-6, ChatGPT Work, Codex, and other AI tools; disclose tools, assisted tasks, and example prompts in README and final PDF. The student must personally understand and explain every line of Dockerfile and Compose in the narrated video. Use AI to review, diagnose and advise rather than to silently produce the entire assessed work.
- Public GitHub repository **created during the exam window**, minimum **five genuinely progressive commits**, public article, public YouTube video (official PDF: **3–5 minutes**), and one final PDF. Teacher WhatsApp discussion offered informal flexibility on video duration/privacy, but use the written requirement unless officially amended.
- No credentials, `.env` contents, tokens, personally identifying dummy-user data, or other private information in repository, screenshots or recordings. Ignore `.env`; commit `.env.example` with non-sensitive sample values.

### Proposed topic registration (confirm submission)

- **Title:** ZeroTrace — Roulette Probability & Risk Lab
- **Category:** Web
- **Framework:** Express.js + EJS (Node.js); PostgreSQL database
- **One-sentence description:** Aplikasi web edukasi untuk mensimulasikan probabilitas European roulette menggunakan kredit virtual, menampilkan hasil serta analisis risiko, dan menyimpan riwayat eksperimen tanpa melibatkan uang asli.
- **Status:** Title and scope discussed but **registration evidence has not been provided**. Do not mark registered without proof.

## 1. Verified local status as of latest user-provided output

| Area | Actual status | Evidence / remaining issue |
|---|---|---|
| Workspace | `D:\zerotrace` exists | IntelliJ screenshot / PowerShell location |
| Scaffold | Express Generator, EJS selected; `bin/`, `public/`, `routes/`, `views/`, `app.js` | `package.json`, directory output |
| Node / npm | Node `v22.18.0`; npm `10.9.3` | PowerShell |
| Git | Git `2.56.0.windows.4`; `git init` successful, branch shown as `master` | First commit **not confirmed** |
| Ignore rules | `.gitignore` exists; `node_modules`, `.idea`, `*.iml` ignored | `git check-ignore` succeeded |
| Express starter | `npm.cmd start` and browser `localhost:3000` **reported successful by student** | Welcome to Express; not yet containerized |
| Dependencies | Scaffold declares Express `~4.16.1`, EJS `~2.6.1`, other historical packages | Review security/compatibility before shipping; do not blindly run `npm audit fix --force` |
| Docker | Docker Engine 29.8.1 and Compose v5.5.1 on Linux/amd64 **working** | Client and Server shown; `docker info` = `linux`; `hello-world` passed |
| `AGENTS.md` | **Not confirmed present** | Create at project root |
| `docs/UTS_MASTER_PLAN.md` | **Not confirmed present** | Copy this file into project |
| ZeroTrace API / PostgreSQL / wheel / Compose | **Not implemented or verified** | Pending milestones |
| GitHub public repo / topic registration / article / video / final PDF | **Not confirmed** | Do not invent links, commits or screenshots |

**Important:** Passing Docker `hello-world` and the local Express starter is an environment smoke test, **not** the graded proof of app+database in Docker Compose.

## 2. Product scope, decisions, and explicit exclusions

### Current implementation baseline — approved direction, not yet tested

- **Stack:** Express.js + EJS + Vanilla JavaScript + plain CSS + PostgreSQL + Docker Compose.
- **Module format:** Existing Express Generator likely uses **CommonJS**. Inspect actual source, then keep its style consistent unless a justified change is approved; do **not** force ESM solely because an earlier Work blueprint proposed ESM.
- **Containers:** Default `app` (frontend EJS + backend API) and `db` (PostgreSQL). Optional Adminer in Compose profile `tools`. User-defined Compose network and named `db_data` volume.
- **Core experience:** One European roulette experiment per request, Red/Black choice, virtual stake, server-generated result, actual outcome plus theoretical probability/expected result, saved PostgreSQL history.
- **Visual requirement:** **Animated wheel and visible betting table are desired**, not abandoned. Table may show 0–36 as indicators but only Red/Black controls work during MVP. A wheel library is a **time-boxed integration candidate**, not already working.
- **Scope gate:** Finish actual GET/POST persistence and Docker evidence before adding optional variants or visual polish. American (`00`), French/La Partage, multi-spin strategies, advanced bets, account management, bonus systems, marketing sections are **deferred**.
- **Safety/positioning:** Virtual credits only; no deposits, withdrawal, real-money integration, gambling promotions/referrals, or strategies advertised as guaranteed wins. Prominent educational explanation of independent spins and negative expected return.

### Roulette mathematical baseline

- European wheel: **37 outcomes, 0–36**. Exactly 18 red, 18 black and one green 0.
- Even-money Red/Black: probability of winning `18/37`; loss `19/37`; net `+stake` on win and `-stake` otherwise; expected net **`-stake/37`**, roughly a **2.70% house edge**.
- Past independent spins do not alter the next spin's probabilities. Progression strategies may change exposure/variance, **not** the negative expectation of the underlying bet.
- Use backend-owned rules and secure unbiased integer selection (e.g., `crypto.randomInt(0, 37)`); show result and wheel consistently.

### Library evaluation (documentation-level, **not** runtime-verified)

- `CrazyTim/spin-wheel` — Vanilla JS, MIT; has targeted spinning. **First wheel candidate.** Need to check readable 37 pockets, number mapping, same-number consecutive spins, integration with the existing CommonJS/browser build and pointer accuracy. Test in a short, capped spike after app core works.
- `IvanAdmaers/react-casino-roulette` — React wheel/table, legacy/unmaintained; possible 00 mismatch with European. **Not the baseline** for EJS.
- `IvanAdmaers/casino-roulette` vanilla variant — potentially useful wheel+table reference; **verify license/distribution rights before reuse**.
- Visual references: https://simulatorroulette.com/en and https://react-casino-roulette.ivanadmaers.com/. **Do not copy their full site or non-licensed assets.** Document all permitted library usage and attribution.

## 3. Complete rubric-to-deliverable traceability

**Question 1 = 30 points, Question 2 = 70 points.** All rows below need original explanations based on what is actually built. Bonus is secondary.

| Rubric | Requirement from PDF | Planned answer or proof |
|---|---|---|
| **1a — 8** | Title/category, problem, users, single MVP, personal motivation + career relation, technical/cost/compliance, one NIST essential cloud characteristic | Written rationale tied to educational probability, Cloud/DevOps learning, local Rp0, only nonpersonal experiment data, and a clearly justified NIST characteristic |
| **1b — 10** | Five service models **IaaS, PaaS, SaaS, BaaS, FaaS**: abstraction, developer/provider responsibility, real provider example, one-sentence fit | Accurate five-row comparison table; verify provider examples |
| **1c — 12** | Distinguish **public, private, hybrid, multi-cloud**; choose future service+deployment combination; technical/cost/compliance; free-tier/pay-as-you-go/reserved/spot; two trade-offs; Docker migration | Brief model comparison, **hypothetical** container-compatible PaaS/public-cloud choice or alternative with rationale, vendor lock-in/free-tier/cold-start trade-offs, Docker portability limitations |
| **2a — 6** | Draw all containers, localhost ports, network, volume, browser→app→DB path; compare containers vs VMs using namespaces, cgroups, size and startup | Accurate architecture diagram after Compose exists; own explanation |
| **2b — 18** | Dockerfile **multi-stage builder→runtime**, pinned version tag (not `latest`), dependency manifests before source for cache, `WORKDIR`/`ENV`/`EXPOSE`/exec-form `CMD` or `ENTRYPOINT`, `COPY` vs `ADD` explained, `.dockerignore`, real `docker images` image size and size explanation | Actual files, real build success, screenshot **E03**, line-by-line student explanation |
| **2c — 20** | Compose min app+DB; user-defined network, DB hostname service, named volume, DB healthcheck, `depends_on: condition: service_healthy`, `.env` + `.env.example`, one profile, **`docker compose up -d --build`** opens app in browser | Actual `docker-compose.yml`, working network/volume/health, profile `tools` and config, fresh-start proof |
| **2d — 8** | `docker compose ps` shows running services/healthy DB; HTTP GET/POST with correct 200/201; record survives `down` → `up -d`; explain `down -v` | Real screenshots **E02, E04, E05, E06, E07**; same record ID before/after; explain, **do not run destructive down -v** on sole data |
| **2e — 6** | Public new GitHub repo, README (description, rationale, run, screenshots, article/video, AI declaration), ≥5 meaningful commits, clean `.env` policy; clean clone + `.env.example` + Compose launch | Real repo and commit history **E08**, reproducibility steps |
| **2f — 6** | YouTube **Public**, **3–5 min**, own voice; explain choice, Dockerfile and Compose, local run and persistence; GitHub/article links in description | Real uploaded video link and content; test without login |
| **2g — 6** | Public **500–800-word** article on Medium/dev.to/Hashnode/LinkedIn/blog; reason, architecture, key Docker snippets explained, localhost steps, screenshots, lessons, GitHub/YouTube links | Real article link, word count, public access |

**Optional bonus (+5 each, max +10, final grade capped 100):** Docker Hub push with version + `latest`; functional Supabase Auth or RLS policy; actually-used Redis with healthcheck. **Do not pursue these until all base deliverables are ready.**

### Minimum endpoints

1. `GET /health` — HTTP 200 when application can access the DB table; 503 when dependency is unavailable (proposed design).
2. `GET /api/experiments` — HTTP 200 and a bounded list of recent persisted experiments (proposed limit: 20).
3. `POST /api/experiments` — validate Red/Black and positive integer virtual stake; compute and save one experiment; HTTP 201 on new record, 400 on invalid input; include record ID and outcome.

**Proposed, not code yet:** Work suggested client-supplied UUID and idempotent POST (200 on exact retry, 409 on conflicting reuse). Valuable but **optional complexity**, not explicit rubric. Student should decide whether simpler one-request handling suffices; prevent double-clicks and distinguish unknown network failures.

### Database proposal

- PostgreSQL `experiments` table: `id` (UUID primary key), `selected_bet`, `stake_credits`, `result_number`, `created_at`; check constraints for valid bets, stake and 0–36.
- Server derives result color, payout and expected value consistently from stored fields; avoid contradictory duplicate derived columns.
- `db/init.sql` mounted read-only to official PostgreSQL initialization directory. **It runs on fresh/empty data volume only**; verify new-volume setup and existing-volume persistence.
- DB reachable as `db:5432` from app container, **not** `localhost`; do not need publish DB port to host.

## 4. Minimal code structure — adapt existing generator instead of rebuilding

```text
zerotrace/
  AGENTS.md                    # Codex working rules / evidence gates
  .gitignore
  app.js                       # Express wiring; existing generator
  bin/www                      # Existing server entry point
  routes/                      # Existing generator routes; keep if used
  views/                       # Existing EJS templates
  public/                      # Browser CSS/JS/images
  roulette.js                  # Proposed server-only European rules
  db.js                        # Proposed pg connection + small SQL operations
  db/init.sql                  # Proposed initial schema
  test/roulette.test.js        # Proposed Node built-in test runner
  Dockerfile                   # To implement
  .dockerignore                # To implement
  docker-compose.yml           # To implement
  .env.example                 # To implement
  package.json
  package-lock.json
  README.md                    # To develop as project evolves
  docs/
    UTS_MASTER_PLAN.md         # THIS canonical, living plan
    architecture.png           # To create from actual Compose
    evidence/                  # To create at first graded capture
```

- No speculative `core/`, `domain/`, `controllers/`, `services/`, `repositories/`, `helpers/`, or `utils/` layers.
- Keep existing `routes/` and `bin/` until inspected; no reason to delete purely to look minimalist.
- Use descriptive JavaScript camelCase names and parameterized SQL. Prefer existing CommonJS style until actual code review suggests otherwise; SQL identifiers snake_case.
- Dependencies should be purposeful; **old scaffold Express/EJS versions require a measured compatibility/security review**. Do not run disruptive bulk auto-fixes or replace framework without checking.
- UI style and usability can be documented later in short `DESIGN.md` / `ANTISLOP.md` before visual work, rather than creating unused placeholder files now. Anti-slop reference: https://github.com/miqdadbadjuber/anti-slop . It is a quality checklist, not a guarantee of code correctness or a tool to conceal AI use.

## 5. Evidence-first protocol: NEVER skip capturing graded outputs

**Rules for Codex, Work, and student:** before a graded test, identify its evidence ID, command, expected result, and safety implications. Execute only approved commands. When real PASS output is shown, **stop**. Student captures screenshot manually, verifies no secrets, saves file and says `E0X CAPTURED`; only then continue. Assistant reports actual outcomes; it cannot assert the screenshot was saved just because it ran a command.

| ID | Moment to capture | Evidence / example filename |
|---|---|---|
| **E01** | App working inside Docker, user-facing result + educational disclaimer | `docs/evidence/E01-app.png` |
| **E02** | After `docker compose up -d --build`, run `docker compose ps`; DB **healthy** | `E02-compose.png` |
| **E03** | After actual Docker build, output of `docker images` with app size | `E03-image.png` |
| **E04** | `curl.exe -i` GET `/health` **200** and GET `/api/experiments` **200** | `E04-get.png` (can split if unreadable) |
| **E05** | POST new experiment returns **201**, visible ID and status; GET confirms saved | `E05-post.png` |
| **E06** | **Before** Compose restart: persisted record with specific ID visible via GET / UI | `E06-before.png` |
| **E07** | **After** approved `docker compose down` then `docker compose up -d`: **same ID** still visible | `E07-after.png` |
| **E08** | Public GitHub URL, genuine chronological ≥5 commits, README and clean config | `E08-github.png` |
| **E09** | Architecture diagram matching final Compose (not decorative browser screenshot) | `docs/architecture.png` |
| **E10** | Public article/YouTube links and final verification | Publication URL records / relevant captures |

**Persistence order (do not reorder):** POST → GET saved ID → **E06 screenshot + confirmation** → `docker compose down` (**not `-v`**) → `docker compose up -d` → GET same ID → **E07 screenshot + confirmation**.

- `docker compose down -v` removes named volumes: explain the difference; **never run** on primary evidence data to satisfy this question.
- Keep a small `docs/evidence/README.md` or progress note of IDs and status only if needed; no fake screenshots. Ensure screen captures do not expose secrets or sensitive personal information.
- In Windows PowerShell use `curl.exe -i` to show HTTP status; use `Copy-Item .env.example .env` instead of assuming Bash `cp`. No Windows absolute path in Compose.
- Other important evidence: `docker compose --profile tools up -d` for optional service; `docker compose config` review without sharing resolved secrets; `git status` + clone proof; browser DevTools and responsive UI. Not every test needs a separate screenshot in PDF, but critical status and persistence must be visible.

## 6. Implementation milestones and gates

1. **M0 — current starting point:** Docker and Express starter smoke tests passed. **NEXT:** copy `AGENTS.md` to root and this master to `docs/`; verify both; then review staging and make first meaningful commit manually. Registration status remains urgent/unverified.
2. **M1 — Roulette rules:** student implements/understands 0–36 mapping, 18 red/18 black/0, payout and expected net; deterministic tests via built-in `node:test`; no web or DB dependency for math tests.
3. **M2 — API:** GET health/history and POST experiment; input validation, accurate 200/201/400; browser displays server outcome.
4. **M3 — PostgreSQL:** one table, basic parameterized queries, schema initialization, POST→GET consistent; no ORM needed.
5. **M4 — Dockerfile/Compose:** multi-stage, named volume, healthcheck, profile, correct `.env` handling, clean Docker build; collect E02/E03/E04/E05; prove fresh data setup.
6. **M5 — Persistence proof:** take E06 before restart, then E07 after; don't let Codex auto-run both without stopping.
7. **M6 — Visual enhancement:** time-box `spin-wheel`; animated wheel + table with truthful active controls; stop if library blocks rubric. European only unless all mandatory evidence is complete.
8. **M7 — Public deliverables:** ≥5 real commits, README/screenshots and attributions, architecture diagram, public article, own-voice YouTube, final PDF with all required parts; verify URLs without login.

**Stop rules:** If scope expansion threatens grading deadlines, drop American/French, strategy systems, 3D, additional betting types, bonuses and decorative website sections before dropping Docker evidence or public deliverables. Visual fallback may be a clear outcome indicator, but preserve the roulette-themed interface if possible.

**Time budget:** Previously estimated 13–19 hours for one visually polished European simulator with all deliverables; three variants may require 18–26+ hours. Another Work estimate of ~2h45–4h is highly optimistic and unverified. Treat all durations as rough planning ranges, not promises. Use actual deadline/time remaining to prioritize.

## 7. Final submission PDF outline

Name file **`UTS_COMP6991031_NIM_Nama.pdf`** (use student's actual NIM and name, do not invent). Include:

1. Identity: NIM, full name, LA75; ZeroTrace title; **three public links** (GitHub, article, YouTube).
2. **1a:** project profile, motivation, one MVP, technical/cost/data/NIST; **1b:** complete five-model service table; **1c:** four deployment models, hypothetical cloud choice, pricing, compliance, two trade-offs, Docker migration.
3. **2a:** diagram all actual containers, localhost port, network, volume, request flow; namespaces/cgroups vs VM explanation.
4. **2b:** actual Dockerfile and `.dockerignore`, build choices, `COPY` vs `ADD`, actual image-size screenshot.
5. **2c:** actual Compose, env/profile/healthcheck/network/volume and user command.
6. **2d:** actual running/healthy, GET/POST status screenshots and same-ID persistence before/after; explain `down -v`.
7. **2e–2g:** GitHub and commit/README proof; video URL with own voice, duration, and content; 500–800-word public article URL and summary.
8. AI Usage Declaration (tools, exact work helped, example prompts), originality statement, relevant appendices.

Public links must be accessible without login until grades announced. Video official target **Public 3–5 minutes**. Article **500–800 words**.

## 8. Roles, handoff, and AI logging

- **Student / project owner:** approvals, core programming, authentic tests, screenshot capture, commits, original explanations/article/voiceover and final submission.
- **GPT-6 planning chat:** requirement and evidence audit; review Codex outputs and failures, validate decisions.
- **ChatGPT Work:** initial feasibility and technical blueprint have been delivered; **no active task currently**. Request bounded review only when necessary.
- **Codex in IntelliJ:** Plan/Read-only first, then one explicitly approved small change at a time. Must read root `AGENTS.md` and this master, inspect current workspace, show diff and real results, STOP for E0X evidence. No auto commit/push or destructive Docker commands.
- **One code source of truth:** `D:\zerotrace` and its Git history. ChatGPT Project documents and Work chats do not automatically sync into IntelliJ; manually copy/share this canonical plan. Avoid two agents concurrently editing the same files.

### AI usage log — fill truthfully as work happens

| Date/time | AI tool | Task/prompt summary | Help actually used | Files/sections affected | Independent work/checks |
|---|---|---|---|---|---|
| 2026-11-09 | GPT-6 + ChatGPT Work | Scope discussion, rubric audits, blueprint, agent/evidence instructions | Planning/review | Planning documents | Student chooses scope and performs local tests |
| | | | | | |

Do not invent a mathematically precise AI-assistance percentage where measurement is unavailable; provide a truthful description of contributions and stay within the stated cap.

## 9. Immediate next local commands (after copying files)

```powershell
Test-Path .\AGENTS.md
Test-Path .\docs\UTS_MASTER_PLAN.md
Get-Content .\AGENTS.md -TotalCount 12
Get-Content .\docs\UTS_MASTER_PLAN.md -TotalCount 12
git status --short
```

Expected: two `True` values and newly untracked files. Student reviews and stages **only safe project files**, checks `git diff --cached --stat` / `--name-only`, then makes the first real commit. No claim of commit until output confirms it.

**End of canonical plan v2.0.** This file must be updated with actual test status as the work progresses. Keep old planning versions out of the repo to avoid ambiguity.
