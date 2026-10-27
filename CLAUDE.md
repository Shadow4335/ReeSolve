# ReeSolve — CLAUDE.md

> Read this file first, then `CONTEXT.md` (same folder) before writing any code.
> `CONTEXT.md` holds the full spec: domain config, data model, state machine, API, UI, contracts with teammates, demo script.
> If the two disagree, `CONTEXT.md` wins on domain details and this file wins on process.

## Mission

Build **ReeSolve**, a closed-loop civic complaint platform for an overnight hackathon (Problem 8: *Smart Cities — From Citizen Reports to Verified Resolution*).

The system must: ingest citizen complaints, detect duplicate and related incidents, assign work across departments, track SLA deadlines, and **automatically reopen or escalate** a case when a department misses a deadline or when evidence contradicts a closure report.

The one rule the whole product is built around: **a case only closes when evidence confirms it.**

## Your role (read this twice)

You are the coding agent for the **main developer**. The team has 4 people. The other three teammates each run their own prompt in their own Claude Code session, on their own branch, and build three small, self-contained modules. **You never write, edit, or "improve" teammate code.** You build everything else, and you integrate their modules at T+3:30.

| Owner | Scope |
|---|---|
| **Main dev (you)** | Repo scaffold, config, data model, clock, intake API, dedup, assignment/routing, SLA tracker, escalation, verification + reopen engine, admin/clock/stats endpoints, mutation endpoints, `demo_scenario.py`, `docs/demo-script.md`, all frontend pages and wiring, README, freeze |
| **Teammate 1: router** | `backend/app/api/queries.py` (read-side GET endpoints) |
| **Teammate 2: SLA badge** | `frontend/src/components/SlaBadge.jsx` |
| **Teammate 3: seed data** | `backend/scripts/seed.py` |

Their modules are specified only as **contracts** in `CONTEXT.md` §9. Build to the contract; do not guess at their internals. If a contract needs to change, tell the main dev instead of silently changing it.

## Constraints

- Total build time: **~6 hours** (hackathon clock `T+h:mm`, distinct from the app's simulated clock). Speed and a working demo beat completeness.
- Judged on a live ~4 minute demo. A polished end-to-end flow beats ten half-working features.
- Must run **offline-safe**: the demo cannot depend on a live LLM call or the internet (map tiles excepted).

## Timeline (your column)

| T+ | You | Teammates (for awareness only) | Exit check |
|---|---|---|---|
| 0:00–0:20 | **M0 Scaffold**: repo + folders, push to GitHub | | Backend `/api/health` and Vite app both boot |
| 0:20–1:30 | **M1 Data model** + **M2 Complaint intake API** | Run their prompt, push their branch | `POST /api/reports` stores report + incident + events; `pytest -q` green. **Interface freeze at ~T+0:50** (see below) |
| 1:30–3:30 | **M3 Dedup** → **M4 Assignment** → **M5 SLA tracker + escalation** → **M6 Verification + reopen** | Finish; one merges and checks the other two's PRs | CONTEXT §10 tests 1–17 green |
| 3:30–4:30 | **M7 Integration**: merge router, SLA badge, seed; stats endpoint; `demo_scenario.py` | Test and report bugs | Fresh DB → seed → demo script runs clean |
| 4:30–5:30 | **M8 Dashboard wiring + demo flow** | Rehearse with `docs/demo-script.md` | All 4 pages work; live demo path rehearsed twice |
| 5:30–6:00 | **M9 Freeze**: bug fixes only, README, final commit | Verify all 4 contributors' commits are on GitHub | `main` tagged `v1-demo`, pushed |

**Interface freeze (~T+0:50):** push `config.py`, `models.py`, `db.py`, `clock.py`, `events.py` and the response shapes in `schemas.py` to `main` before doing intake work. Teammates build against these; do not rename fields or service signatures after this point (signatures are listed in `CONTEXT.md` §9.1).

## Priorities

- **P0 (must work, tested):** intake → dedup/cluster → assignment → SLA watchdog → closure → verification gate → reopen / escalate. All state changes audited in the events table.
- **P1:** frontend pages (Report, Track, Department, Admin with map + live feed + stats + clock controls), scripted demo scenario, integration of teammate modules.
- **P2 (only if everything above is done and committed):** LLM intake, plus stretch items in `CONTEXT.md` §12.

Do not start M8 until M7 is green. Do not start P2 until the demo scenario runs cleanly end to end.

## Golden rules

1. **One clock.** Always `from app.clock import now`. Never call `datetime.now()` / `utcnow()` anywhere else. The demo depends on a simulated clock that can be advanced.
2. **Report ≠ Incident ≠ Task.** Report = what a citizen submitted. Incident = the deduplicated real-world problem. Task = a unit of work for one department on an incident. Never collapse them.
3. **Task is the unit of state.** Incident status is derived from its tasks.
4. **Every state change goes through a service function** in `app/services/` that mutates the DB **and writes an `Event` in the same transaction**. API routes stay thin (validate → call service → return).
5. **Explainability.** Dedup decisions store an explanation JSON (distance, similarity, rule). Escalations and reopens store a human-readable `reason`. The UI shows these.
6. **LLM is optional and last.** Keyword rules are the default and must be complete first. The LLM hook (only if `ANTHROPIC_API_KEY` is set; cache by text hash; fall back on any error/timeout) is P2 and is built only if ahead of schedule. The demo must work with the LLM disabled.
7. **All thresholds, SLA tables, department maps, related-category rules live in `app/config.py`.** No magic numbers in services.
8. **No scope creep.** Do NOT add: authentication, Docker, migrations (use `create_all`; reset by deleting the SQLite file), real SMS/email, ML training, mobile apps, websockets (poll instead).
9. **Ask before adding a dependency** that is not in the stack list below.
10. **Stay in your lane.** Do not create, edit, or stub the teammate-owned files listed above. Before T+3:30 the app and tests must run without them. At integration you may add minimal glue (an `include_router` line, an import) but not rewrite their code; report problems to the main dev for the owner to fix.
11. **Own the shared shapes.** `schemas.py` (`TaskOut`, `IncidentOut`, `IncidentDetailOut`, `ClusterOut`, `EventOut`) and the helper that computes `sla_state` / `sla_remaining_seconds` / `escalation_level_label` are yours. Teammates consume them; they do not re-derive them.

## Stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0 (typed style), Pydantic v2, SQLite, APScheduler, scikit-learn (TF-IDF cosine for text similarity), pytest, httpx (test client).
- **Optional AI (P2):** `anthropic` SDK for intake structuring; model name from env var `LLM_MODEL`.
- **Frontend:** React 18 + Vite + Tailwind CSS + react-leaflet (OpenStreetMap tiles). Plain JavaScript (JSX), not TypeScript.
- **No other infra.** One backend process, one frontend dev server.

## Repo layout

```
reesolve/
  CLAUDE.md
  CONTEXT.md
  DECISIONS.md           # running one-line decisions (you)
  README.md              # run steps (written in M9)
  docs/
    demo-script.md       # human talk track, teammates rehearse from it (you, by T+4:40)
  backend/
    requirements.txt
    app/
      main.py            # FastAPI app, CORS, router includes, scheduler start
      config.py          # ALL constants/tables (CONTEXT.md §4)
      db.py              # engine, SessionLocal, init_db(), seed_reference_data()
      models.py          # SQLAlchemy models (CONTEXT.md §5)
      schemas.py         # Pydantic request/response models (shared shapes, rule 11)
      clock.py           # now(), advance(hours), reset()  (simulated clock)
      geo.py             # haversine_m()
      scheduler.py       # APScheduler job -> services.sla.run_watchdog
      services/
        events.py        # log_event()
        intake.py        # structure_report(): keyword rules (+ optional LLM, P2)
        reports.py       # submit_report(): the whole report pipeline in one call
        dedup.py         # resolve_report(): duplicate / related / new
        routing.py       # tasks, priority, SLA assignment, dependencies
        sla.py           # watchdog, pause/resume, warnings, breaches, task view helpers
        verification.py  # closure submission, checks, citizen responses
        escalation.py    # escalate(), reopen_task()
      api/
        reports.py       # POST/GET reports                      (you)
        tasks.py         # start / close / verify-response       (you)
        admin.py         # clock, tick, stats, seed, reset       (you)
        queries.py       # read-side GETs                        (TEAMMATE 1, not yours)
    tests/
    scripts/
      demo_scenario.py   # scripted live-demo storyline via the API (you)
      seed.py            # baseline data                         (TEAMMATE 3, not yours)
  frontend/
    src/
      api.js  App.jsx  pages/{Report,Track,Department,Admin}.jsx   (you)
      components/SlaBadge.jsx                                      (TEAMMATE 2, not yours)
```

## Commands

```bash
# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
pytest -q
python scripts/seed.py            # baseline data (teammate-owned script)
python scripts/demo_scenario.py   # runs the scripted demo against localhost:8000

# frontend
cd frontend && npm install && npm run dev    # http://localhost:5173
```

## Git workflow

- **M0 repo setup**: Initialize the repository locally, set up the structure, and push `main` to the remote origin. (Teammate invitations will be handled manually via the GitHub web interface).
- Create all folders in the layout above (add `.gitkeep` to empty ones) so teammates' branches have somewhere to land. Do **not** create the three teammate-owned files.
- **You commit directly to `main`**, small and often, after `pytest -q` is green. Teammates work on their own branches and open PRs; one teammate merges them. Run `git pull --rebase` before every push and at the start of M7.
- Commit messages: `M4: assignment + dependencies (tests green)`.
- Your git identity must match your GitHub account (or the GitHub noreply address) so your commits are attributed to you.

## Conventions

- Timestamps: **naive UTC** everywhere, produced only by `clock.now()`. Serialize as ISO-8601 strings.
- IDs: integer autoincrement.
- API prefix `/api`. CORS allows `http://localhost:5173`. JSON only (plus one optional upload endpoint).
- Service functions take a SQLAlchemy `Session` as the first argument and never commit internally; **the caller commits** (the API layer once per request; scripts such as seed after each step). The one exception is the scheduler job, which commits after `run_watchdog`.
- Type hints on all Python functions. Short docstring on each service function stating the state transition it performs.
- Frontend: one `api.js` wrapper (`VITE_API_URL`, default `http://localhost:8000`), poll the live feed every 3 seconds, role switcher in the header (Citizen / Department: X / Admin) instead of auth.
- Keep files small. If a service file passes ~250 lines, split it.

## State machine (summary — full rules in CONTEXT.md §6)

Task status: `BLOCKED → OPEN → IN_PROGRESS → PENDING_VERIFICATION → CLOSED`.

- Closure by a department **never** goes straight to `CLOSED`; it goes to `PENDING_VERIFICATION`.
- Verified (citizen confirms, evidence checks pass) → `CLOSED` with confidence `VERIFIED`.
- Timeout with no contradiction and no confirmation → `CLOSED` with confidence `LOW_CONFIDENCE`.
- Citizen says "not fixed", closure evidence invalid, or a **new report lands on the incident after closure** → `reopen_task()`: status back to `OPEN`, `reopen_count += 1`, shorter SLA.
- SLA breach → `escalate()`: `escalation_level += 1` (0 Field Team → 1 Supervisor → 2 Dept Head → 3 Commissioner), SLA window re-armed.
- `reopen_count >= 2` → forced escalation to at least level 2.

## Build order (commit after every milestone; run `pytest -q` before each commit)

1. **M0 Scaffold (T+0:00–0:20)** — repo layout, FastAPI hello + `/api/health`, Vite app boots with empty page shells, `requirements.txt`, push.
2. **M1 Data model (T+0:20–~0:50)** — `config.py`, `models.py`, `db.py` (+ `seed_reference_data`: 5 departments, vulnerable zones), `clock.py`, `geo.py`, `events.py`, `schemas.py` shapes. Push → interface freeze.
3. **M2 Complaint intake API (→ T+1:30)** — `intake.structure_report` (keyword rules), `services/reports.submit_report`, `POST /api/reports`, `GET /api/reports/{id}`. At this stage every report creates a new report + incident (`dedup` is a stub returning "new"); no task yet. Tests: §10 #1.
4. **M3 Dedup/cluster (T+1:30–2:15)** — duplicate merge, related cluster link, explanation JSON, dependency flagging. Tests #2–#4.
5. **M4 Assignment (T+2:15–2:35)** — `routing.create_primary_task`, priority + SLA deadline, `recompute_priority`, dependency → `BLOCKED`, `POST /tasks/{id}/start`. Wire into `submit_report`.
6. **M5 SLA tracker + escalation (T+2:35–3:05)** — watchdog, warnings, breaches, pause/resume, `escalate()`, clock advance/tick endpoints. Tests #5–#7.
7. **M6 Verification + reopen (T+3:05–3:30)** — closure submission, evidence checks, citizen responses, timeout, post-closure contradiction, repeated-reopen escalation, 409s. Tests #8–#17. **This is the differentiator; make it rock solid.** If it runs over, borrow from M7 time, never from the tests.
8. **M7 Integration (T+3:30–4:30)** — see protocol below; then `/admin/stats`; then `demo_scenario.py` (runs clean from fresh DB, re-runnable after `/admin/reset`).
9. **M8 Dashboard wiring + demo flow (T+4:30–5:30)** — first write `docs/demo-script.md` (teammates need it; done by T+4:40). Then pages in this order: Admin (map, live feed, stats, clock), Track (timeline + verification prompt), Department (queue + close form), Report (map pin + decision card).
10. **M9 Freeze (T+5:30–6:00)** — no new features. Bug fixes, README with run steps, empty/loading/error states only if trivial, fresh-DB regression (`/admin/reset` → seed → `demo_scenario.py` → `pytest -q`), final commit, tag `v1-demo`, push.

## Integration protocol (M7, T+3:30)

1. `git pull --rebase`; `git fetch` teammate branches / merged PRs. Confirm what is actually on `main`.
2. For each module in this order — **router → seed → SLA badge** — merge, then run `pytest -q` and boot the app. One module at a time; fix or report before the next.
3. Router: add the `include_router` line in `main.py`; check every `GET` returns the shapes in `schemas.py` and that `/tasks` is sorted by SLA remaining ascending.
4. Seed: run on a fresh DB; confirm ~10 incidents in the mix described in `CONTEXT.md` §9.4, none near the demo coordinates, and that `POST /admin/seed` works.
5. SLA badge: confirm it renders all four `sla_state` values once the Department page exists (M8).
6. **Fallback:** if a module is missing or broken at T+4:00, write the minimal version yourself (≤15 minutes), log it in `DECISIONS.md`, and keep going. Never block the demo on a teammate.
7. Bugs reported by teammates: triage by whether they break the demo path (`CONTEXT.md` §11). Fix P0 breakage immediately; park everything else in `DECISIONS.md` under "Known issues".

## Definition of done (per milestone)

- Code runs, tests for that milestone pass, `pytest -q` is green.
- Every state change in that milestone emits an `Event` with a clear `reason`.
- Committed and pushed with a message like `M5: SLA watchdog + escalation (tests green)`.

## Testing rules

Tests target the **state machine**, because bugs there break the demo. Use an in-memory SQLite DB and the simulated clock (never `sleep`). The required test checklist is in `CONTEXT.md` §10. Tests must not import or depend on any teammate-owned file.

## Cut lines (if behind schedule)

Cut in this order and note each cut in `DECISIONS.md`:
1. Photo upload endpoint (accept a pasted URL instead).
2. Cluster lines on the admin map (keep markers).
3. Stats bar chart (keep the numeric cards).
4. Map pin dragging on the Report page (use "use demo location" button).

Never cut: the verification gate, auto-reopen, escalation, the audit timeline, the clock controls.

## How to work with me

- Before each milestone, state your plan in a few lines, then implement. Do not ask for confirmation on things already specified in `CONTEXT.md`; make a sensible choice, note it in one line, and move on.
- If a spec detail is ambiguous, choose the simplest option that keeps the demo story intact and add it to `DECISIONS.md` (one line each).
- Prefer working and simple over clever. No premature abstraction.
- If something would take more than ~30 minutes, stop and propose a cheaper alternative.
- At the start of each timeline block, tell me the T+ time you are targeting and what "done" looks like for it; at the end, say whether you are on schedule.
- Never leave the repo in a broken state at the end of a turn.