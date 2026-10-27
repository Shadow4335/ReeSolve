# Notes for teammates: contract vs. what is on your branch

At the T+3:30 integration, none of the three branches could be merged as-is. Nothing here is a criticism of the
work itself, the contracts in `CONTEXT.md` section 9 are just specific about file names and signatures. To keep the demo
unblocked, the main dev wrote minimal fallback versions (logged in `DECISIONS.md`). If you push a fixed version
that meets the contract, it will be reviewed and merged with **your** authorship and will replace the fallback.

Everything below can be checked with: `cd backend && pytest -q` (must stay green) and `uvicorn app.main:app`.

---

## Teammate 1 (branch `feat/routing`): read-side router

**Contract:** `backend/app/api/queries.py` exporting `router` with these GET routes (all under `/api` once included):
`/incidents` (filters `status, category, department, cluster_id`), `/incidents/{id}` (`IncidentDetailOut`),
`/clusters/{id}` (`ClusterOut`), `/tasks` (`department, status`; **sorted by SLA remaining ascending**),
`/events` (`incident_id, task_id, limit, since_id`; ordered by id). Return models from `app/schemas.py`;
404 for unknown ids.

**On the branch:** it rewrites `backend/app/services/routing.py` and `backend/tests/test_routing.py` with a keyword
router and priority scorer. Those two files belong to the main dev: they hold `create_primary_task`, `start_task`,
`apply_dependency`, `recompute_priority`, which the rest of the app imports. Merging would break
`POST /tasks/{id}/start`, dependencies and priority/SLA updates. There is no `queries.py`.

**To fix:**
1. Restore both files to `main`: `git checkout origin/main -- backend/app/services/routing.py backend/tests/test_routing.py`.
2. Add `backend/app/api/queries.py` per the contract above (do not touch `main.py`; the main dev wires it).
3. Build the responses with `TaskOut.from_task(task)`, never recompute `sla_state` yourself.
4. A reference fallback is on `main` at `backend/app/api/queries.py` with tests in `backend/tests/test_queries.py`.
   Yours can be compared against those tests.

---

## Teammate 3 (branch `feat/seed-data`): seed script

**Contract:** `backend/scripts/seed.py` with an importable `seed(db)` (also runnable as `python scripts/seed.py`),
~10 baseline incidents in a mix of states (a few `CLOSED/VERIFIED`, one `IN_PROGRESS`, one close to SLA breach, one
with `reopen_count = 1`, one `LOW_CONFIDENCE`). It must go **only through the public services**
(`submit_report`, `start_task`, `submit_closure`, `record_response`, `clock.advance`) and no raw inserts; must not create
departments or vulnerable zones; every incident at least `SEED_MIN_DISTANCE_FROM_SCENARIO_M` from
`DEMO_SCENARIO_ORIGIN` (both in `app/config.py`); leave the clock at offset 0.

**On the branch:** `seed/complaints.json` (40 complaints), `seed/README.md`, and `docs/demo-script.md`. No script, and
the data uses its own department names. `docs/demo-script.md` collides with the main dev's file of the same name.

**To fix:**
1. Add `backend/scripts/seed.py` that loads your JSON complaints and feeds them through `submit_report`, then drives
   a few of them through start / close / verify so the state mix above exists. Back-date by moving the simulated clock
   (`clock.advance(-hours, db)`), then restore it.
2. Departments come from `app/config.py` (`ROADS, WATER, DRAIN, SANI, ELEC`); ignore `category_hint` and let intake classify.
3. Check your coordinates against `config.DEMO_SCENARIO_ORIGIN` (distance rule) and that duplicates in your set stay
   within 100 m of each other so they merge.
4. Remove `docs/demo-script.md` from your branch. The main dev owns that file.
5. A fallback is on `main` at `backend/scripts/seed.py` with tests in `backend/tests/test_seed.py`.

---

## Teammate 2 (branch `feat/sla-ui`): SLA badge

**Contract:** `frontend/src/components/SlaBadge.jsx`, default export `<SlaBadge task={task} />`, reading only these
`TaskOut` fields: `sla_state` (`ok|warning|breached|paused`), `sla_remaining_seconds`, `escalation_level`,
`escalation_level_label`, `status`. Large type, green / amber / red / grey, readable on a projector.

**On the branch:** `frontend/src/components/sla/SlaBadge.jsx` plus `SlaDemo.jsx`, `StatusTimeline.jsx` and a 773-line
`sla.css`. Different path, and the badge computes from a `deadline` timestamp instead of reading `sla_state` and
`sla_remaining_seconds` that the backend already provides (computing client-side can disagree with the server, e.g. for
paused tasks, whose clock is frozen).

**To fix:**
1. Make the badge take `task` and render from `sla_state` / `sla_remaining_seconds` (paused must show as grey and
   not count down).
2. Put it at `frontend/src/components/SlaBadge.jsx`.
3. Keep `StatusTimeline.jsx` if you like: it could replace the timeline on the Track page. Its input should be the
   `events` array from `GET /api/events?incident_id=` (`{id, ts, type, actor, reason, payload}`).
4. A fallback is on `main` at `frontend/src/components/SlaBadge.jsx`.

---

## For everyone

- Commit under your own name and open a PR against `main`; do not force-push `main`.
- `docs/demo-script.md` is the talk track you will rehearse from.
