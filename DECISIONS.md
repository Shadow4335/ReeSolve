# DECISIONS

- Repo root is `ReeSolve/` (not `reesolve/`); scaffolded in place.
- `DEMO_SCENARIO_ORIGIN` = (28.6211, 77.2090), ~800 m north of `DEMO_CENTER`.
- Vulnerable zones: two fictional zones (hospital, school) in a `vulnerable_zones` table, seeded from config by `seed_reference_data`; both >500 m from the scenario origin.
- Clock offset lives in memory (`clock.now()` needs no session) and is persisted to `settings` when a session is passed to `advance`/`reset`; `clock.load(db)` restores it at startup.
- `Task.sla_window_hours` added (not in CONTEXT §5): length of the current SLA window so the 80% warning works after escalation/reopen re-arms the deadline.
- `sla.task_view` implemented in M1 (state/remaining/label/department); watchdog comes in M5. BLOCKED tasks report `paused` with remaining frozen at `paused_at`; PENDING_VERIFICATION/CLOSED report `ok` with 0 remaining.
- `TaskOut` also carries `department_code`, `incident_summary`, `incident_category` for queue display.
- `ServiceError` / `NotFound` / `InvalidTransition` live in `services/errors.py`.
- No react-router (not in stack list): `App.jsx` switches pages by role/tab state.
- `python-multipart` left out of requirements (only needed for the optional upload endpoint, a cut line).
- Push deferred: no remote configured yet; waiting for the origin URL.

## Known issues
- M3: dedup candidates include all statuses within DEDUP_WINDOW_DAYS (needed for post-closure contradiction in M6). `dedup.resolve_report` is read-only; `reports.submit_report` applies merges, `clusters.link_related` applies cluster links.
- M3: `blocks_downstream` is recorded in the RELATED_LINKED event/explanation; the actual BLOCKED task + dependency is applied in M4 (needs tasks). Test #4's blocking assertions land in M4.
- M3: repeated cluster links append to the coordination note (new sentence per linked pair).
- M4: one dependency per task (`depends_on_task_id`); a second blocking link on an already-dependent task is skipped. Blocking only applies to OPEN downstream tasks and non-CLOSED upstream tasks, with a cycle check.
- M4: on priority rise, deadline = min(old, created_at + new SLA) only for tasks with no breaches/reopens; escalated or reopened tasks keep their re-armed deadline (only priority/base hours update).
- M5: `run_watchdog` handles one breach per task per run and always logs SLA_WARNING before SLA_BREACHED if the warning point was skipped by a big clock jump. Verification-timeout hook is added with M6.
- M5: `unblock_dependents(db, task)` lives in `sla.py`; M6 `finalize_close` calls it. `POST /admin/clock/reset` also logs a CLOCK_ADVANCED event (hours 0) for the audit trail.
- M5: scheduler (BackgroundScheduler, 5s) starts in the app lifespan only, so tests never run it.
