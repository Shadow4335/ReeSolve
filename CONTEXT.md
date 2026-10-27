# ReeSolve — CONTEXT.md (full spec)

Companion to `CLAUDE.md`. Read both before coding. This file defines **what** to build; `CLAUDE.md` defines **how** to work.

**Scope of this document:** the main developer's work. Three teammate modules (read-side router, SLA badge, seed script) are covered only as contracts in §9. Do not implement them.

## 1. Problem statement (verbatim from organizers)

> **8. Smart Cities — From Citizen Reports to Verified Resolution**
> Create a platform that processes citizen complaints, identifies duplicate and related incidents, assigns work across departments, and tracks service-level deadlines. When a department misses a deadline or evidence contradicts a closure report, the system must reopen or escalate the case and coordinate the next steps.

Format: overnight hackathon, \~6 hours of build, team of 4 (one main dev driving Claude Code, three teammates on side modules), live demo to judges.

## 2. Interpretation

Most civic apps stop at "ticket closed." The differentiator here is **verified resolution**: the system distrusts closure and acts on its own.

| Capability | What it means here | 
| ----- | ----- | 
| Process complaints | Free text + location (+ optional photo) → structured category, severity, summary | 
| Duplicate incidents | Same real-world problem reported many times → merged into one incident | 
| Related incidents | Different problems with a shared cause (leak → waterlogging → pothole) → linked in a cluster | 
| Assign across departments | Route by category; one incident may spawn several tasks with a lead and dependencies | 
| Track SLAs | Deadline per task from category × priority; warnings at 80%; breach detection; clock pauses while blocked | 
| Reopen / escalate | Missed SLA → escalate up a ladder. Contradicting evidence → reopen. Repeated failure → forced escalation | 
| Coordinate next steps | Cluster coordination note, task dependencies, and an audit timeline showing who must do what next | 

What judges will most likely reward: (a) the verification gate and auto-reopen, (b) explainable dedup, (c) cross-department coordination, (d) a clean live demo with a simulated clock.

## 3. Glossary

* **Report**: one citizen submission.

* **Incident**: deduplicated real-world problem; many reports → one incident.

* **Cluster**: group of *related* (not duplicate) incidents with a shared cause.

* **Task**: work item for one department on one incident. One incident can have multiple tasks (usually one in the MVP; related incidents each have their own).

* **Closure**: a department's claim that a task is done, with note/photo/location.

* **Verification**: the gate that decides whether a closure is believed.

* **Escalation level**: 0 Field Team, 1 Department Supervisor, 2 Department Head, 3 Municipal Commissioner.

* **T+h:mm**: the hackathon clock used in the build timeline. Not the same as the app's simulated clock.

## 4. Domain configuration (put ALL of this in `app/config.py`)

### 4.1 Categories → departments

| category | department (code) | 
| ----- | ----- | 
| `road_damage` | Roads & Infrastructure (`ROADS`) | 
| `water_leak` | Water & Sewerage (`WATER`) | 
| `drain_blockage` | Drainage (`DRAIN`) | 
| `garbage` | Sanitation (`SANI`) | 
| `streetlight` | Electrical (`ELEC`) | 
| `other` | Sanitation (`SANI`) — catch-all | 

Seed these five departments in `db.seed_reference_data()` (yours, not the seed script's). Escalation ladder labels are the same for every department (level names in §3).

### 4.2 Priority

```
severity: int 1..5 (from intake)
score = severity*2 + min(report_count, 10) + (3 if in a vulnerable zone else 0)
priority = CRITICAL if score >= 18; HIGH if >= 12; MEDIUM if >= 7; else LOW

```

Vulnerable zones: a small list in config of `{name, lat, lng, radius_m}` (e.g. a hospital and a school near the demo area), loaded by `db.seed_reference_data()` or read directly from config. An incident within a zone's radius gets the bonus.

Priority is **recomputed whenever a report is merged**. If it rises, the SLA deadline may only get *shorter* (`min(old, created_at + new_sla)`) and a `PRIORITY_RAISED` event is logged.

### 4.3 SLA table

```
BASE_SLA_HOURS (at MEDIUM): road_damage 144, water_leak 24, drain_blockage 48, garbage 48, streetlight 72, other 72
PRIORITY_MULTIPLIER: CRITICAL 0.25, HIGH 0.5, MEDIUM 1.0, LOW 1.5
task.base_sla_hours = BASE_SLA_HOURS[category] * PRIORITY_MULTIPLIER[priority]
SLA_WARNING_FRACTION = 0.8
ESCALATION_INTERVAL_FRACTION = 0.5   # after an escalation, next breach window = 0.5 * base_sla_hours
REOPEN_SLA_FRACTION = 0.5            # reopened task gets 0.5 * base_sla_hours
MAX_ESCALATION_LEVEL = 3

```

Example: pothole at HIGH priority → 144 × 0.5 = 72h.

### 4.4 Dedup / cluster parameters

```
DEDUP_WINDOW_DAYS = 14          # only compare with incidents created within this many days
POST_CLOSURE_WINDOW_DAYS = 14   # reports landing on a recently resolved incident count as contradiction
DUP_RADIUS_M = 100
DUP_HARD_RADIUS_M = 25          # same category within 25m => duplicate regardless of text
DUP_THRESHOLD = 0.55            # combined score
RELATED_RADIUS_M = 150
RELATED_WINDOW_DAYS = 7

```

### 4.5 Related-category rules

```
RELATED_RULES = [
  # (upstream_category, downstream_category, downstream_blocked_until_upstream_closed)
  ("water_leak",      "road_damage",    True),   # fix the leak, then repair the road
  ("drain_blockage",  "road_damage",    True),   # clear the drain, then repair the road
  ("garbage",         "drain_blockage", False),  # related but independent
  ("water_leak",      "drain_blockage", False),
]

```

Rules apply in either report order; the pair decides which task is upstream/downstream. `streetlight` and `other` have no related rules in the MVP.

### 4.6 Verification parameters

```
VERIFY_WINDOW_HOURS = 48          # time to hear from citizens after closure submission
VERIFY_QUORUM_FRACTION = 0.5      # fraction of verification requests that must say "fixed"
CLOSURE_GEO_TOLERANCE_M = 150     # closure location must be within this of the incident
MAX_VERIFICATION_REQUESTS = 5     # ask up to this many distinct reporters

```

### 4.7 Watchdog

`WATCHDOG_INTERVAL_SECONDS = 5` (APScheduler job). It must also be runnable on demand (`POST /api/admin/tick`) and runs automatically right after any clock advance.

### 4.8 Intake keyword fallback

Config dict mapping category → keyword list (e.g. pothole/road/crack/gadda → `road_damage`; leak/pipe/burst/water → `water_leak`; drain/sewer/clog/overflow → `drain_blockage`; garbage/trash/waste/dump → `garbage`; light/lamp/dark/streetlight → `streetlight`). Severity keywords: "accident", "dangerous", "hospital", "school", "flood", "overflow" → +1 each (cap 5); default 3. Summary = first 120 chars of the text, cleaned. Multilingual keywords (Hindi transliterations) are welcome but optional.

### 4.9 Demo geography

```
DEMO_CENTER = (28.6192, 77.2090)          # map default center: Central New Delhi (Sansad Marg / Patel Chowk)
DEMO_SCENARIO_ORIGIN = (28.6264, 77.2090)  # Gurudwara Bangla Sahib, Ashoka Road (~800 m from DEMO_CENTER): where demo_scenario.py places its pothole + leak
SEED_MIN_DISTANCE_FROM_SCENARIO_M = 500   # the seed script must keep baseline incidents at least this far from DEMO_SCENARIO_ORIGIN

```

Use real New Delhi localities (Connaught Place, India Gate, Mandi House, ...) at their real positions. The seed script (teammate-owned) reads these constants; do not hard-code coordinates elsewhere.

## 5. Data model (SQLAlchemy models; SQLite)

```
departments(id, name, code)

reports(id, text, summary, category, severity, lat, lng, photo_url NULL,
        reporter_name NULL, reporter_contact NULL, incident_id FK,
        dedup_explanation JSON, created_at)

incidents(id, category, summary, lat, lng, priority, severity_max, report_count,
          status[OPEN|RESOLVED], cluster_id FK NULL, in_vulnerable_zone bool,
          created_at, resolved_at NULL)

clusters(id, title, coordination_note TEXT, created_at)

tasks(id, incident_id FK, department_id FK, status[BLOCKED|OPEN|IN_PROGRESS|PENDING_VERIFICATION|CLOSED],
      priority, base_sla_hours float, sla_deadline datetime, paused_at NULL, warned bool,
      breach_count int, escalation_level int, reopen_count int,
      depends_on_task_id FK NULL, closure_confidence[VERIFIED|LOW_CONFIDENCE] NULL,
      verification_deadline NULL, is_lead bool, created_at, closed_at NULL)

closures(id, task_id FK, note, photo_url NULL, lat NULL, lng NULL, submitted_at,
         checks JSON, outcome[PENDING|VERIFIED|REJECTED|CONTRADICTED|LOW_CONFIDENCE])

verification_requests(id, task_id FK, closure_id FK, report_id FK,
                      status[PENDING|FIXED|NOT_FIXED], comment NULL, responded_at NULL)

events(id, ts, type, incident_id NULL, task_id NULL, actor, reason TEXT, payload JSON)

settings(key PK, value)     # holds clock offset in seconds

```

`events` is the most important table: it powers the timeline, the live feed, and the "system explained itself" demo moments. **Never mutate state without logging an event.**

### Event types

`REPORT_RECEIVED, INCIDENT_CREATED, DUPLICATE_MERGED, RELATED_LINKED, TASK_CREATED, TASK_BLOCKED, TASK_UNBLOCKED, PRIORITY_RAISED, TASK_STARTED, SLA_WARNING, SLA_BREACHED, ESCALATED, CLOSURE_SUBMITTED, CLOSURE_REJECTED, VERIFICATION_REQUESTED, CITIZEN_CONFIRMED, CITIZEN_REJECTED, CONTRADICTION_DETECTED, TASK_REOPENED, TASK_CLOSED, INCIDENT_RESOLVED, CLOCK_ADVANCED`.

`actor` values: `system`, `citizen`, `dept:<CODE>`, `admin`.

## 6. Rules and state machine

### 6.1 Intake (`services/intake.py`)

`structure_report(text) -> {category, severity (1-5), summary}`

1. Keyword rules (§4.8). This is the default and the only path required for the demo.

2. **P2 only:** if `ANTHROPIC_API_KEY` is set, one LLM call, JSON-only output, 5-second timeout, result cached by SHA-256 of text. Validate that the category is in the allowed list; otherwise fall back to keyword rules. Build this only if ahead of schedule.

### 6.2 Report processing (`services/reports.submit_report`, called by `POST /api/reports`)

Single transaction, one service function so the API route, tests and the seed script all share it.

**Staged build:** M2 implements steps 1 and 2b only (always a new incident, no task). M3 adds dedup and related linking. M4 adds the primary task.

1. Create `Report`; log `REPORT_RECEIVED`.

2. Run `dedup.resolve_report`.

   * **Duplicate** → attach to existing incident, `report_count += 1`, recompute priority/SLA, log `DUPLICATE_MERGED` with explanation. If that incident has tasks that are `PENDING_VERIFICATION` or `CLOSED` (or the incident is `RESOLVED` within the post-closure window) → call `verification.on_post_closure_report` (see 6.7).

   * **New** (2b) → create `Incident` (log `INCIDENT_CREATED`), then `routing.create_primary_task` (log `TASK_CREATED`).

3. Independently of step 2, check **related** incidents (§6.3) and link clusters (log `RELATED_LINKED`).

4. Return `{report, incident, decision: "new"|"duplicate", explanation, cluster?}`.

### 6.3 Dedup algorithm (`services/dedup.py`)

Candidates: incidents with `created_at` within `DEDUP_WINDOW_DAYS` and within `RELATED_RADIUS_M` of the report (compute with haversine; no DB spatial index needed).

For each candidate:

* **Same category** → `geo = max(0, 1 - d/DUP_RADIUS_M)` (0 if `d > DUP_RADIUS_M`); `sim` = TF-IDF cosine between report summary and candidate summary; `score = 0.6*geo + 0.4*sim`. **Duplicate** if `score >= DUP_THRESHOLD` or `d <= DUP_HARD_RADIUS_M`. Keep the best-scoring duplicate.

* **Different category** → if the pair is in `RELATED_RULES`, `d <= RELATED_RADIUS_M`, and the candidate is within `RELATED_WINDOW_DAYS` → **related**.

Duplicate and related are evaluated independently: a report can merge into incident A and also be related to incident B.

Explanation JSON example:

```
{"decision":"duplicate","matched_incident_id":12,"distance_m":40,"text_similarity":0.87,"score":0.81,"rule":"same_category_within_100m"}

```

For related links: `{"decision":"related","matched_incident_id":9,"distance_m":60,"rule":"water_leak->road_damage","blocks_downstream":true}`.

Linking to a cluster: if either incident has a cluster, reuse it; otherwise create one. Set `cluster.coordination_note` from a template, e.g.: *"Water & Sewerage must repair the leak first; Roads & Infrastructure resumes after the leak task is closed. Roads SLA clock is paused meanwhile."* Add every cluster member to the cluster.

**Dependency creation:** if the matching rule has `blocked=True`, the downstream incident's primary task gets `depends_on_task_id = upstream task`, `status = BLOCKED`, `paused_at = now`; log `TASK_BLOCKED`. The upstream task becomes `is_lead = True`. If the downstream task already exists and is `OPEN`, block it the same way. Never create circular dependencies (check before setting).

Tune thresholds against hand-written test fixtures (the seed data may not exist yet when you build this); do not chase ML sophistication.

### 6.4 Routing and priority (`services/routing.py`)

* `create_primary_task(incident)`: department from category map; priority from §4.2; `base_sla_hours` from §4.3; `sla_deadline = now + base_sla_hours`; status `OPEN` (or `BLOCKED` per dependency).

* `recompute_priority(incident)` on every merge (see §4.2).

* Task transitions: `OPEN → IN_PROGRESS` via `POST /api/tasks/{id}/start` (log `TASK_STARTED`). Starting does not stop the SLA clock.

### 6.5 SLA engine (`services/sla.py`)

`run_watchdog(db)`:

For each task with status `OPEN` or `IN_PROGRESS`:

1. If `now >= created_or_rearmed_start + 0.8 * window` and not `warned` → set `warned = True`, log `SLA_WARNING`. (Simplest implementation: warn when `deadline - now <= 0.2 * current_window`; store the current window length on the task or derive from `base_sla_hours`/escalation interval.)

2. If `now > sla_deadline` → log `SLA_BREACHED`, `breach_count += 1`, then `escalation.escalate(task, reason="SLA breached by X hours")`.

For `PENDING_VERIFICATION` tasks: if `now > verification_deadline` → `verification.evaluate_timeout(task)`.

`BLOCKED` tasks: clock paused. On `TASK_UNBLOCKED`: `sla_deadline += (now - paused_at)`, `paused_at = None`. Never breach a paused task.

Pause/resume: when an upstream task becomes `CLOSED`, every dependent `BLOCKED` task becomes `OPEN` (log `TASK_UNBLOCKED`).

`sla.py` also owns the **task view helper** used by `TaskOut`: `sla_remaining_seconds` and `sla_state` (`ok|warning|breached|paused`). Teammates never recompute these.

### 6.6 Escalation and reopen (`services/escalation.py`)

`escalate(task, reason)`:

* `escalation_level = min(level + 1, MAX_ESCALATION_LEVEL)`; log `ESCALATED` with payload `{from_level, to_level, to_role}`.

* Re-arm the SLA: `sla_deadline = now + ESCALATION_INTERVAL_FRACTION * base_sla_hours`; `warned = False`.

* At level 3, further breaches keep re-arming and log `ESCALATED` with "already at top level — flagged for commissioner review".

`reopen_task(task, reason, source)`:

* Only valid for tasks in `PENDING_VERIFICATION` or `CLOSED`.

* `status = OPEN`, `reopen_count += 1`, `closed_at = None`, `closure_confidence = None`, `sla_deadline = now + REOPEN_SLA_FRACTION * base_sla_hours`, `warned = False`.

* Incident `status = OPEN`, `resolved_at = None`.

* Mark latest closure `outcome = CONTRADICTED` (or `REJECTED` if rejected at submission).

* Log `TASK_REOPENED` with `reason`.

* **If `reopen_count >= 2`:** call `escalate(...)` until `escalation_level >= 2`, reason "repeated failed closure".

### 6.7 Verification (`services/verification.py`) — the differentiator

`submit_closure(task, note, photo_url, lat, lng)` (from `POST /api/tasks/{id}/close`):

1. Create `Closure` with `checks = {photo_present, geo_ok, note_present}`.

   * `photo_present = bool(photo_url)`

   * `geo_ok = (lat/lng provided and within CLOSURE_GEO_TOLERANCE_M of the incident)`

   * `note_present = len(note.strip()) >= 5`

2. Log `CLOSURE_SUBMITTED` with checks.

3. If `photo_present` is false or `geo_ok` is false → **auto-reject**: `outcome = REJECTED`, log `CLOSURE_REJECTED` with the failed checks, call `reopen_task(reason="closure evidence invalid: ...")`. Stop.

4. Else: `status = PENDING_VERIFICATION`, `verification_deadline = now + VERIFY_WINDOW_HOURS`. Create `verification_requests` for up to `MAX_VERIFICATION_REQUESTS` distinct reports of the incident; log `VERIFICATION_REQUESTED`.

Closing a `BLOCKED` task, or any task not `OPEN`/`IN_PROGRESS`, is an invalid transition → 409.

`record_response(task, report_id, fixed, comment)` (from `POST /api/tasks/{id}/verify-response`):

* `fixed = False` → log `CITIZEN_REJECTED`, call `reopen_task(reason="citizen rejected closure: <comment>", source="citizen")`.

* `fixed = True` → log `CITIZEN_CONFIRMED`. If confirmations ≥ `max(1, ceil(VERIFY_QUORUM_FRACTION * requests))` and no rejections → `finalize_close(task, "VERIFIED")`.

`evaluate_timeout(task)` (watchdog): if no rejection and no quorum by `verification_deadline` → `finalize_close(task, "LOW_CONFIDENCE")`.

`finalize_close(task, confidence)`: `status = CLOSED`, `closed_at = now`, `closure_confidence = confidence`, closure `outcome` set accordingly; log `TASK_CLOSED`; unblock dependent tasks (§6.5); if **all** tasks on the incident are `CLOSED`: incident `status = RESOLVED`, `resolved_at = now`, log `INCIDENT_RESOLVED`.

`on_post_closure_report(incident, report)` (called by the report flow when a report merges into an incident that has a `PENDING_VERIFICATION` / `CLOSED` task, or a `RESOLVED` incident within `POST_CLOSURE_WINDOW_DAYS`):

* Log `CONTRADICTION_DETECTED` ("new report #N at same location after closure").

* For each such task, call `reopen_task(reason="new report after closure", source="evidence")`.

## 7. API spec (yours)

All under `/api`. JSON bodies unless noted. Return the updated resource plus events where useful.

| Method | Path | Purpose | Milestone | 
| ----- | ----- | ----- | ----- | 
| GET | `/health` | `{status: "ok"}` | M0 | 
| POST | `/reports` | Body `{text, lat, lng, photo_url?, reporter_name?, reporter_contact?}` → decision + incident | M2 | 
| GET | `/reports/{id}` | Report detail | M2 | 
| POST | `/tasks/{id}/start` | `OPEN → IN_PROGRESS` | M4 | 
| GET | `/admin/clock` | `{now, offset_seconds}` | M5 | 
| POST | `/admin/clock/advance` | Body `{hours}` → advances simulated clock, logs `CLOCK_ADVANCED`, runs watchdog immediately | M5 | 
| POST | `/admin/clock/reset` | Reset offset to 0 | M5 | 
| POST | `/admin/tick` | Run watchdog now | M5 | 
| POST | `/tasks/{id}/close` | Body `{note, photo_url?, lat?, lng?}` → closure submission (§6.7) | M6 | 
| POST | `/tasks/{id}/verify-response` | Body `{report_id, fixed: bool, comment?}` | M6 | 
| POST | `/admin/reset` | Wipe DB and reseed reference data only (departments, vulnerable zones) | M7 | 
| POST | `/admin/seed` | Load baseline data by calling the teammate's `scripts.seed.seed(db)` (import lazily so the app boots without it) | M7 | 
| GET | `/admin/stats` | SLA compliance % by department, open/breached counts, reopen rate by department, escalations by level, avg resolution time | M7 | 
| POST | `/uploads` | (optional, first cut) multipart image → `{url}`; saved under `backend/uploads/`, served from `/static/uploads/` | M8 | 

Notes:

* `TaskOut` payloads include `sla_state`, `sla_remaining_seconds`, `escalation_level_label`, and the department name, so the frontend needs no extra logic.

* Return 404 for unknown IDs and 409 for invalid transitions with a clear `detail` message.

* Read-side `GET` endpoints for incidents, clusters, tasks and events belong to the router module (§9.2). Their payload shapes come from your `schemas.py`.

## 8. Frontend spec (yours: React + Vite + Tailwind + react-leaflet)

Shells (empty pages, router, header, `api.js`) are created in M0. Real wiring happens in M8, after the router, seed data and SLA badge are integrated. Use `components/SlaBadge.jsx` (teammate-owned) wherever an SLA state is shown; do not build your own chip.

Header with a **role switcher** (Citizen / Department ▾ / Admin) and a **clock badge** showing the simulated time (poll `/admin/clock`).

Build in this order (demo-critical first):

1. **Admin page** — (a) Leaflet map: incidents as markers colored by priority, cluster links drawn as lines, popups with summary + status; (b) **live event feed** polling `/events?since_id=` every 3s with colored badges per event type; (c) stats cards and a small bar chart (SLA compliance and reopen rate per department, can be plain HTML/CSS bars); (d) **clock controls**: buttons `+1h`, `+24h`, `+72h`, `Reset`, and a "Run watchdog" button.

2. **Track page (Citizen)** — incident status, responsible department and SLA state, a vertical **timeline built from `/events`**, and — when a task is `PENDING_VERIFICATION` — a prominent "Was this fixed?" Yes/No prompt that calls `verify-response`.

3. **Department page** — department selector; task queue sorted by SLA urgency with the SLA badge, escalation badge, reopen count; per task: Start, and Close (opens a form with note, photo/URL, "use incident location" button for lat/lng). Show a clear banner when a task is `BLOCKED` ("Waiting for Water & Sewerage").

4. **Report page (Citizen)** — text box, map with draggable pin (default center `DEMO_CENTER`), optional photo, submit. After submit, show the decision: "Merged with an existing incident (5 reports, 40m away, similarity 0.87)" or "New incident created", plus related-cluster info, with a link to the tracker.

UI quality bar: clean, readable from across a room (the judges are watching a projector). Large type for status chips, clear colors (green/amber/red), no unfinished screens.

## 9. Teammate-owned modules (contracts only — do not implement)

Three teammates build these from their own prompts on their own branches. This section is everything you need to know about them. If anything here is unclear, ask the main dev.

### 9.1 Ownership and frozen interfaces

| Module | Owner | File | You provide | You verify at integration (M7) | 
| ----- | ----- | ----- | ----- | ----- | 
| Read-side router | Teammate 1 | `backend/app/api/queries.py` | `models.py`, `schemas.py` output shapes, `sla.py` task-view helper | Endpoints in §9.2 return the shared shapes; wired in `main.py` | 
| SLA badge | Teammate 2 | `frontend/src/components/SlaBadge.jsx` | Task payload fields in §9.3 | Renders all four states with readable labels | 
| Seed data | Teammate 3 | `backend/scripts/seed.py` | Public service signatures below, `config.py` constants | Fresh-DB run produces the mix in §9.4; no collision with the demo scenario | 

**Frozen service signatures** (do not rename after the T+0:50 interface freeze; callers commit):

```
# app/clock.py
now() -> datetime
advance(hours: float) -> None
reset() -> None

# app/services/reports.py
submit_report(db, text, lat, lng, photo_url=None, reporter_name=None, reporter_contact=None) -> dict
    # returns {"report", "incident", "decision", "explanation", "cluster"}

# app/services/routing.py
start_task(db, task_id: int) -> Task

# app/services/verification.py
submit_closure(db, task_id: int, note: str, photo_url: str | None, lat: float | None, lng: float | None) -> Closure
record_response(db, task_id: int, report_id: int, fixed: bool, comment: str | None = None) -> VerificationRequest

# app/services/sla.py
run_watchdog(db) -> None
task_view(task) -> dict      # adds sla_state, sla_remaining_seconds, escalation_level_label, department name

```

`submit_closure`/`record_response` raise a `ServiceError` subclass for invalid transitions; the API layer maps it to 409/404.

### 9.2 Read-side router contract (Teammate 1)

Exposes these `GET` routes under `/api`, returning only models from your `schemas.py`:

| Path | Query | Returns | 
| ----- | ----- | ----- | 
| `/incidents` | `status, category, department, cluster_id` | list of `IncidentOut` | 
| `/incidents/{id}` |  | `IncidentDetailOut`: incident + reports + tasks + cluster + event timeline | 
| `/clusters/{id}` |  | `ClusterOut`: member incidents + coordination note | 
| `/tasks` | `department, status` | list of `TaskOut`, **sorted by SLA time remaining ascending** | 
| `/events` | `incident_id, task_id, limit, since_id` | list of `EventOut`, ordered by id; drives timeline and live feed | 

404 for unknown IDs. The router exports `router`; you add one `app.include_router(queries.router, prefix="/api")` line at integration.

### 9.3 SLA badge contract (Teammate 2)

`<SlaBadge task={task} />` reads only these fields from a `TaskOut`: `sla_state` (`ok|warning|breached|paused`), `sla_remaining_seconds`, `escalation_level`, `escalation_level_label`, `status`. Large type, green/amber/red/grey, readable on a projector. You use it in the Department queue, Track page and Admin feed/popups.

### 9.4 Seed data contract (Teammate 3)

`seed(db)` is importable (used by `POST /admin/seed`) and also runnable as `python scripts/seed.py`. Acceptance criteria you check at M7:

* Uses only the frozen service signatures in §9.1 and the simulated clock to backdate; **no raw inserts** of incidents, tasks or events, so stats and timelines stay consistent. Commits after each step.

* Does **not** create departments or vulnerable zones (you do, in `seed_reference_data`).

* \~10 baseline incidents across categories and states: a few `CLOSED/VERIFIED`, one `IN_PROGRESS`, one close to SLA breach, one with `reopen_count = 1`, one `LOW_CONFIDENCE`.

* Every baseline incident is at least `SEED_MIN_DISTANCE_FROM_SCENARIO_M` from `DEMO_SCENARIO_ORIGIN`, so the live storyline starts clean.

* Leaves the simulated clock at offset 0 when finished (or resets it).

### 9.5 Integration checklist (M7, T+3:30)

1. `git pull --rebase`; confirm which teammate work is actually on `main`.

2. Merge **router → seed → SLA badge**, one at a time, running `pytest -q` and booting the app after each.

3. Add `include_router`; hit every route in §9.2 with `curl`; compare shapes to `schemas.py`.

4. Run `/admin/reset` then `/admin/seed`; check §9.4 criteria and that `/admin/stats` returns non-empty numbers.

5. Fallback if a module is missing or broken at T+4:00: write the minimal version yourself (≤15 min), log it in `DECISIONS.md`.

## 10. Test checklist (pytest, in-memory SQLite, simulated clock, no sleeps)

Required before moving past M6. Tests must not import any teammate-owned file.

 1. Intake keyword fallback maps sample texts to the right category/severity. *(M2)*

 2. Same-category report within 25m merges as duplicate; `report_count` increments; priority recomputed; event logged with explanation. *(M3)*

 3. Same category but 300m away does **not** merge. *(M3)*

 4. `water_leak` near an existing `road_damage` → related cluster created; downstream task `BLOCKED`; coordination note set. *(M3/M4)*

 5. Blocked task's SLA clock is paused; on upstream close, task becomes `OPEN` and deadline extended by the paused duration. *(M5)*

 6. Advance clock to 80% of SLA → `SLA_WARNING` once (not repeatedly). *(M5)*

 7. Advance clock past deadline → `SLA_BREACHED` + escalation level 1; SLA re-armed; another breach → level 2; caps at level 3. *(M5)*

 8. Closure with no photo → auto-rejected and reopened. *(M6)*

 9. Closure with location far from incident → auto-rejected and reopened. *(M6)*

10. Valid closure → `PENDING_VERIFICATION` and verification requests created. *(M6)*

11. Citizen says "fixed" (quorum met) → `CLOSED` / `VERIFIED`; incident `RESOLVED` when all tasks closed. *(M6)*

12. Citizen says "not fixed" → reopen, `reopen_count = 1`, shorter SLA. *(M6)*

13. New duplicate report after closure → `CONTRADICTION_DETECTED` + reopen. *(M6)*

14. Second reopen → escalation to at least level 2. *(M6)*

15. No response until `verification_deadline` → `CLOSED` / `LOW_CONFIDENCE`. *(M6)*

16. Every transition above has a matching event row with a non-empty `reason`. *(M6)*

17. Invalid transitions (e.g., close a `BLOCKED` task) return 409. *(M6)*

## 11. Demo scenario (`scripts/demo_scenario.py` — runs against the live API, prints each step)

Written in M7 (script) and M8 (`docs/demo-script.md` talk track). The script must run from a clean seeded DB and be re-runnable after `/admin/reset`. All coordinates are offsets from `DEMO_SCENARIO_ORIGIN`.

This is the storyline judges see (\~4 minutes):

1. **Duplicates:** 5 citizens report the same pothole (slightly different wording, 10–40m apart) → one incident, `report_count = 5`, priority raised, merge explanations visible.

2. **Related:** a water-leak report 60m away → cluster created, Roads task `BLOCKED` behind the Water task, coordination note appears.

3. **Missed SLA:** advance clock until the Water task breaches → `SLA_WARNING` then `SLA_BREACHED` → auto-escalation to Supervisor, visible in the live feed.

4. **Water closes properly:** valid closure + citizen confirms → `CLOSED/VERIFIED`; Roads task unblocks automatically with its clock resumed.

5. **Contradicted closure:** Roads submits closure with a photo; a citizen answers "not fixed" → **auto-reopen**, reopen count 1.

6. **Post-closure contradiction:** Roads closes again, citizens confirm, then a *new* report arrives at the same spot → `CONTRADICTION_DETECTED` → reopen #2 → forced escalation to Department Head.

7. **Admin view:** show SLA compliance and reopen rates by department, the map with the cluster, the full audit timeline of the pothole incident.

`docs/demo-script.md` is the human version: for each step, what to click, what to say, and what the judges should see. It is written first in M8 (done by T+4:40) because teammates rehearse from it.

## 12. Stretch goals (P2 — only after the demo scenario is clean and committed)

* LLM intake structuring (§6.1 step 2) with keyword fallback.

* Vision check on closure photos (LLM asks "does this show a repaired pothole?"); must be optional with a fallback.

* Hotspot detection: wards with repeated incidents flagged for root-cause review.

* Department trust score from breach and reopen rates.

* Simulated notification log (what each citizen would have received by SMS).

* WhatsApp-style chat intake mockup.

## 13. Pitch notes (for the final presentation)

* One-liner: *"A complaint isn't resolved when a department says so. It's resolved when the evidence agrees."*

* Say the three differentiators out loud: explainable dedup, cross-department dependencies, verified closure with automatic reopen/escalation.

* Likely judge questions to prepare for:

  * *What if citizens don't respond?* → low-confidence closure after the window, flagged in stats.

  * *What stops fake or spam reports?* → duplicates collapse into one incident; priority is capped by report count; evidence checks on closures; future: reporter reputation.

  * *How does it scale?* → geo-indexing (PostGIS/H3) and embeddings for dedup, a queue-based SLA scheduler; the state machine stays the same.

  * *Why simulated clock?* → so the SLA behavior can be shown live; production uses real time.

* Be honest about the MVP limits: SQLite, simulated citizen verification, no real SMS.