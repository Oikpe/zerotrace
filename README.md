# ZeroTrace - Roulette Probability & Risk Lab

ZeroTrace is a web-based European roulette simulator built to explore probability, expected return, and short-term variation in outcomes. It uses **virtual credits only**. There are no deposits, withdrawals, real-money bets, or claims that a betting strategy can overcome the house edge.

The project was developed for **COMP6991031 — Cloud Services**, with an emphasis on a reproducible Docker Compose setup, a persistent PostgreSQL database, and a working local HTTP API.

## What it does

- Runs a single-zero European roulette wheel (**0–36**) with animated wheel and ball.
- Supports Red/Black bets using virtual credits, with a stake between **1 and 1,000**.
- Displays each spin's number, color, win/loss result, payout, and experiment history.
- Stores experiments in PostgreSQL through an Express API.
- Shows the probability behind an even-money bet: **18/37** chance to win, **19/37** chance to lose, and an expected net return of **−1/37 of the stake** (about **−2.70%**).

## Stack

| Layer | Technology |
| --- | --- |
| Server and HTTP API | Node.js 22, Express.js |
| HTML templates | EJS |
| Browser UI | Vanilla JavaScript, CSS, vendored `spin-wheel` |
| Database | PostgreSQL 18.6 with `pg` connection pool |
| Containerization | Multi-stage Dockerfile, Docker Compose |
| Optional DB UI | Adminer, activated through the `tools` profile |

## Architecture

![ZeroTrace Docker Compose architecture](docs/evidence/E09_Architecture_Final.png)

The browser connects to the application on `http://localhost:3000`. The Express container connects to PostgreSQL using the Compose service hostname **`db:5432`**, not `localhost:5432`. Both services use the user-defined `backend` bridge network. Database files are stored in the Compose named volume `db_data` (`zerotrace_db_data`). An SQL initialization script is mounted read-only and runs when PostgreSQL initializes an empty data directory.

> **Before publishing:** ensure `docs/evidence/E09_Architecture_Final.png` exists, or update the image path to the exported diagram's actual location.

## Run locally

**Requirements:** Docker Desktop with Docker Compose. Node.js/npm is additionally needed to run tests directly from the host terminal.

In PowerShell, from the project directory:

```powershell
Copy-Item .env.example .env
```

Review `.env` and set local development credentials. Do not commit that file. Then start the stack:

```powershell
docker compose up -d --build
docker compose ps
```

Once both services are healthy, open **http://localhost:3000**.

To check the API:

```powershell
curl.exe -i http://localhost:3000/health
curl.exe -i http://localhost:3000/api/experiments
```

To start the optional Adminer interface (at **http://localhost:8080**):

```powershell
docker compose --profile tools up -d
```

To stop and remove the containers while **keeping database data**:

```powershell
docker compose down
```

Do **not** use `docker compose down -v` if you want to preserve the database: `-v` also deletes Compose-managed named volumes.

## HTTP API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | Render the simulator page |
| `GET` | `/health` | Application health endpoint |
| `GET` | `/api/experiments` | Return saved experiment history |
| `POST` | `/api/experiments` | Generate, evaluate, and store one roulette experiment |

Example POST using PowerShell:

```powershell
$body = @{ selectedBet = 'black'; stakeCredits = 100 } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3000/api/experiments' `
  -Method Post -ContentType 'application/json' -Body $body
```

A successful create request responds with **HTTP 201** and includes an experiment ID that can be checked again using the history endpoint.

## Testing

Run these commands from the host terminal after installing project dependencies with `npm ci`. Keep the Compose database running for the database integration suite.

```powershell
npm ci
npm test
npm run test:api
npm run test:db
```

The test suites cover roulette rules, API behavior, and database operations. The submission evidence contains the test output from the final run; always rely on the actual pass/fail counts shown by those commands.

## Data persistence

1. Send `POST /api/experiments` and save the returned `id`.
2. Call `GET /api/experiments` and confirm that `id` appears.
3. Run `docker compose down`, followed by `docker compose up -d --wait`.
4. Call `GET /api/experiments` again and confirm that the **same `id`** remains.

This works because the PostgreSQL data directory is backed by a named Docker volume, independent of the lifecycle of an individual database container.

## Repository layout

```text
app.js, bin/www           Express application and server entry point
routes/                   Page and experiment API routes
roulette.js               European roulette rules and calculations
db.js                     PostgreSQL connection pool
db/init.sql               Database initialization script
views/, public/           EJS templates, browser code and styles
public/vendor/spin-wheel/ Vendored wheel library and attribution
Dockerfile                Multi-stage app image build
docker-compose.yml        Application, database and optional tools
test/                     Roulette, HTTP API and database tests
docs/evidence/            Selected screenshots and architecture diagram
.env.example              Example environment configuration (no secrets)
```

## Scope and limitations

ZeroTrace is an educational demonstration, not a gambling platform. It implements European single-zero roulette and Red/Black bets, with no real-money features, user accounts, or production authentication. The host-bound database port is intended for local development and should not be exposed publicly without suitable security controls.

## Credits and AI assistance

The wheel rendering uses the third-party `spin-wheel` library; the vendored version's license and source details are retained under `public/vendor/spin-wheel/5.0.2/`.

AI tools, including ChatGPT and Codex, were used during planning, technical review and documentation preparation. The final report contains a more detailed AI-use declaration and examples of prompts used.

## Project links

- **GitHub repository:** _add public URL_
- **Article (500–800 words):** _add public URL_
- **Demo video (3–5 minutes):** _add public YouTube URL_

