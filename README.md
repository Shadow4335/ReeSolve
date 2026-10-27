# ReeSolve

**A complaint isn't resolved when a department says so. It's resolved when the evidence agrees.**

ReeSolve is a closed-loop civic complaint platform, built as a hackathon prototype for *Smart Cities: From Citizen
Reports to Verified Resolution*. It takes citizen reports, merges duplicates, links related problems across departments,
tracks service-level deadlines, and **reopens or escalates a case automatically** when a department misses a deadline or
when the evidence contradicts a closure.

> **Prototype.** Built for a hackathon. It is not an official Government of India website and uses no state emblem.
> SQLite, simulated citizen verification, no real SMS or email, and a demo-only sign-in (no real authentication).

## What it does

- **Intake:** free text plus a map pin becomes a category, severity and summary (keyword rules, fully offline).
- **Explainable duplicate detection:** the same problem reported five times becomes one incident. Every merge stores its
  distance, text similarity, score and rule.
- **Cross-department dependencies:** a water leak next to a pothole creates a cluster. The Roads task is *blocked*
  behind the Water task, its SLA clock is paused, and a coordination note says who does what first.
- **SLA tracking:** a deadline per task (category x priority), a warning at 80%, breach detection, and automatic
  escalation up a ladder (Field Team, Supervisor, Department Head, Commissioner).
- **Verified closure (the point of the product):** a department's "done" never closes a task. It goes to *pending
  verification* and the original reporters are asked. Confirmed means `CLOSED / VERIFIED`; "not fixed" reopens it;
  no answer in 48 h closes it as `LOW_CONFIDENCE`; a **new report after closure** contradicts it and reopens it; two
  reopens force an escalation to Department Head. Closures without a photo or at the wrong place are rejected
  automatically.
- **Audit trail:** every state change writes an event with a human-readable reason; the UI shows them.
- **Simulated clock:** fast-forward time live to show SLA behaviour in seconds.

## Run it

Requirements: Python 3.11+ (tested on 3.14), Node 18+ (tested on 20).

```bash
# 1. backend  ->  http://localhost:8000  (API docs at /docs)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

```bash
# 2. frontend  ->  http://localhost:5173   (in a second terminal)
cd frontend
npm install
npm run dev
```

Start the backend **from the `backend/` folder**: the SQLite file `reesolve.db` is created there and is gitignored.

**Load the demo data** (12 incidents at real New Delhi localities): sign in as admin and click *Load seed data*, or

```bash
curl -X POST localhost:8000/api/admin/seed
```

**Start over:** Admin page, *Reset demo* then *Load seed data*, or `POST /api/admin/reset`, or delete `backend/reesolve.db`.

### Signing in (demo only)

The login page is a frontend-only demo: it picks a role and nothing is sent anywhere. Use a one-click chip
(*Try as resident / Roads dept / admin*), or type a name. The admin demo code is **`civic-demo`**.

- The three demo chips also get a **Demo time** control (fast-forward the simulated clock). Typed sign-ins do not.
- `VITE_REQUIRE_LOGIN=false` skips the login page entirely. `VITE_API_URL` points the UI at another backend.
  See `frontend/.env.example`.

### The scripted demo

```bash
cd backend && source .venv/bin/activate
python scripts/demo_scenario.py                 # resets, seeds, then runs the 7-step storyline against the API
python scripts/demo_scenario.py --pause 4       # waits 4 s between steps, for live narration
python scripts/demo_scenario.py --no-reset      # replay on the current data
```

It asserts every outcome and exits non-zero on a failed check. The human talk track, with what to click, say and expect
at each step, is in [`docs/demo-script.md`](docs/demo-script.md).

### Tests

```bash
cd backend && pytest -q        # 105 tests: state machine, dedup, SLA, verification, API, seed
cd frontend && npm run build   # production build
```

## How it is built

**Report is not Incident is not Task.** A *report* is what a citizen submitted; an *incident* is the deduplicated
real-world problem; a *task* is a unit of work for one department. The task is the unit of state; the incident's
status is derived from its tasks.

```
Task:  BLOCKED -> OPEN -> IN_PROGRESS -> PENDING_VERIFICATION -> CLOSED (VERIFIED | LOW_CONFIDENCE)
       reopen: PENDING_VERIFICATION / CLOSED -> OPEN (shorter SLA; 2nd reopen forces escalation)
       breach: escalate one level (0 Field Team .. 3 Commissioner) and re-arm the SLA
```

Rules the code holds to: one simulated clock (`app.clock.now()` is the only source of time); every state change goes
through a service function that writes its event in the same transaction; all thresholds, SLA tables and department
maps live in `backend/app/config.py`.

```
backend/app/      FastAPI app, config, models, clock, services/ (intake, dedup, routing, sla, verification, escalation)
backend/app/api/  reports, tasks, admin (clock, stats, reset, seed), queries (read-side GETs)
backend/scripts/  demo_scenario.py, seed_demo.py (default demo seed), seed.py (alternate seed + dataset)
backend/tests/    in-memory SQLite + simulated clock, no sleeps
frontend/src/     React + Vite + Tailwind + react-leaflet; pages, components, i18n (English / हिन्दी)
docs/             demo-script.md
CLAUDE.md, CONTEXT.md, DECISIONS.md   process rules, full spec, and the running decision log
```

Main endpoints (all under `/api`): `POST /reports`, `GET /reports/{id}`, `GET /incidents`, `GET /incidents/{id}`,
`GET /clusters/{id}`, `GET /tasks`, `GET /events`, `POST /tasks/{id}/start`, `POST /tasks/{id}/close`,
`POST /tasks/{id}/verify-response`, `GET /admin/stats`, `GET|POST /admin/clock...`, `POST /admin/tick|reset|seed`.

## Credits

- **Main developer (Shadow4335):** repository scaffold, data model, intake, dedup and clustering, assignment, SLA and
  escalation engine, verification and reopen engine, admin endpoints, the scripted demo, and the frontend.
- **Aden:** the read-side query router (`backend/app/api/queries.py`).
- **Sejal Kundnani:** the seed dataset and seed script (`backend/scripts/seed.py`, `seed/`).
- **Harshita Khandelwal:** the SLA badge component (`frontend/src/components/SlaBadge.jsx`).
- **UI design reference:** **Harshita Khandelwal and Sejal Kundnani** shared the demo interface design
  ([neighborly-city-pulse.lovable.app](https://neighborly-city-pulse.lovable.app)) that the resident screens (Overview,
  Report a problem, City projects, My requests) were modelled on. The interface was later re-themed.

## Known limits

- Demo-only sign-in; the backend has no authentication, so the clock and reset endpoints are open.
- Coordinates for the New Delhi demo data are approximate landmark positions (good to a few tens of metres).
- The Hindi translation covers the chrome and main labels and should get a native-speaker review (see the comment at
  the top of `frontend/src/i18n.js`). The SLA badge text is English only.
- No photo upload endpoint (photos are pasted links), no real notifications, no map-tile fallback offline (the
  rest of the app works without internet; the Noto Sans font falls back to system fonts).
- The teammate-owned SLA badge keeps its own palette (`components/sla/sla.css`), which differs slightly from the theme.
