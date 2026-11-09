# ZeroTrace — Agent Instructions

## Source of truth and scope
- Read `docs/UTS_MASTER_PLAN.md` and the original UTS PDF if available before proposing changes; the PDF takes precedence.
- Work on the existing Express Generator + EJS scaffold, with PostgreSQL and Docker Compose as the planned stack.
- MVP: European roulette, one virtual-credit experiment, Red/Black bets, server-generated result, saved database history.
- Animated wheel and visible betting table are desired after core API and Docker work; American/French and advanced bets are deferred.
- No real-money functionality, gambling referrals, or claims of guaranteed strategies.

## Engineering standards
- Inspect actual source and `package.json` before editing. Preserve the existing module style unless change is justified.
- Keep folders and functions minimal, readable and idiomatic. No speculative `core/`, `services/`, `repositories/`, `helpers/` or wrapper layers.
- Use descriptive JavaScript names, parameterized SQL, and meaningful error handling. No fake stats, placeholder claims, unnecessary dependencies, or boilerplate comments.
- Do not generate substantial unapproved scaffolding. Follow `DESIGN.md` and `ANTISLOP.md` when they exist; do not require them prematurely.

## Permissions and stepwise workflow
- Start in Plan/Read-only mode. One small milestone at a time.
- Before changes: identify exact files, purpose, tests and PASS/FAIL criteria; request explicit approval.
- After changes: report actual commands, changed files/diff, tests, failures and next smallest step.
- Never automatically commit, push, install broad dependencies, or perform unrelated refactoring.
- Never read or reveal `.env`, tokens, passwords or other secrets.

## Evidence checkpoint — mandatory stop
- Before any graded test, name its evidence ID, command, expected output and risk.
- Run only approved tests. When a valid result appears, **STOP** and tell the student exactly what screenshot to save.
- Wait for explicit confirmation `E0X CAPTURED` before proceeding. Never assume screenshots exist because commands ran.
- Evidence IDs: E01 browser app; E02 `docker compose ps` + DB healthy; E03 `docker images`; E04 GET 200; E05 POST 201; E06 saved record **before** restart; E07 **same ID after** restart; E08 public GitHub and commit history; E09 architecture diagram; E10 publication links.
- Persistence is an explicit two-part gate: POST → GET → **E06 CAPTURED** → approved `docker compose down` / `docker compose up -d` → GET same ID → **E07 CAPTURED**.
- Never run `docker compose down -v`, delete/overwrite volumes, reset Git history or delete evidence without explicit approval.

## Academic integrity
- Individual assessed project; all AI assistance together must be **at most 50% of the work process**. Track real AI help for README/PDF declarations.
- The student is responsible for primary implementation, manual verification, screenshots, understanding all Dockerfile/Compose lines, documentation and own-voice video.
