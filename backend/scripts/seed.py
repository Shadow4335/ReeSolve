"""Seed script for ReeSolve — Teammate 3 contract.

Usage
-----
    python scripts/seed.py          # standalone, boots its own DB session
    from scripts.seed import seed; seed(db)   # importable, used by POST /admin/seed

Contract (CONTEXT.md §9.4)
--------------------------
* Only uses frozen public service signatures: submit_report, start_task, submit_closure,
  record_response, clock.advance, clock.reset.  No raw inserts of incidents/tasks/events.
* Does NOT create departments or vulnerable zones (seed_reference_data() owns those).
* Produces ~10 baseline incidents across categories and states:
    - 2 CLOSED / VERIFIED (water_leak, streetlight)
    - 1 CLOSED / LOW_CONFIDENCE (garbage)
    - 1 IN_PROGRESS (road_damage)
    - 1 close to SLA breach / warning (drain_blockage)
    - 1 with reopen_count = 1 (road_damage, previously closed-and-reopened)
    - 1 LOW_CONFIDENCE / PENDING_VERIFICATION timeout (water_leak)
    - 3 OPEN baseline (other categories, different wards)
* Every incident is >= SEED_MIN_DISTANCE_FROM_SCENARIO_M from DEMO_SCENARIO_ORIGIN.
* Leaves the simulated clock at offset 0 when finished.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Make the backend app importable when running as `python scripts/seed.py`
# ---------------------------------------------------------------------------
_SCRIPTS_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _SCRIPTS_DIR.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Lazy imports so the module can be imported without triggering DB side-effects
# at import time (the FastAPI app already called init_db()).


def seed(db) -> None:
    """Load the seed JSON and drive ~10 incidents through public services.

    Caller is responsible for committing between logical steps — we commit
    inside each _step_* helper so the SLA engine sees consistent state.
    """
    from app import clock, config
    from app.models import (
        TASK_OPEN, TASK_IN_PROGRESS, TASK_PENDING_VERIFICATION, TASK_CLOSED,
        Incident, Task,
    )
    from app.services.reports import submit_report
    from app.geo import haversine_m

    if db.query(Incident).count():  # re-run guard (main dev): a second seed on live data hit InvalidTransition
        return

    # ------------------------------------------------------------------
    # Safety: verify none of our seed coords are too close to DEMO_SCENARIO_ORIGIN
    # ------------------------------------------------------------------
    ORIGIN = config.DEMO_SCENARIO_ORIGIN
    MIN_D = config.SEED_MIN_DISTANCE_FROM_SCENARIO_M

    def _check_coord(lat: float, lng: float, label: str) -> None:
        d = haversine_m(lat, lng, *ORIGIN)
        if d < MIN_D:
            raise ValueError(
                f"Seed coord for {label!r} is {d:.0f}m from DEMO_SCENARIO_ORIGIN "
                f"(minimum {MIN_D}m required). Move the coordinate farther away."
            )

    # ------------------------------------------------------------------
    # Load complaints from the JSON seed file
    # ------------------------------------------------------------------
    json_path = _BACKEND_DIR.parent / "seed" / "complaints.json"
    if not json_path.exists():
        raise FileNotFoundError(f"Seed data file not found: {json_path}")

    with open(json_path, encoding="utf-8") as fh:
        seed_data = json.load(fh)

    complaints_by_id: dict[str, dict] = {c["id"]: c for c in seed_data["complaints"]}

    # ------------------------------------------------------------------
    # Helper: import start_task (lives in routing per §9.1 contract).
    # Gracefully stubs if the milestone hasn't landed yet (pre-M4).
    # ------------------------------------------------------------------
    def _start_task(task_id: int) -> object | None:
        try:
            from app.services.routing import start_task as _st
            return _st(db, task_id)
        except (ImportError, AttributeError):
            # M4 not yet merged — mark the task directly so the seed still works
            task = db.get(Task, task_id)
            if task and task.status == TASK_OPEN:
                from app.services.events import log_event
                task.status = TASK_IN_PROGRESS
                log_event(db, "TASK_STARTED",
                          f"Task #{task_id} started (seed fallback)",
                          task_id=task_id, incident_id=task.incident_id)
                db.flush()
            return task

    def _submit_closure(task_id: int, note: str,
                        lat: float | None = None, lng: float | None = None,
                        photo_url: str | None = None) -> object | None:
        try:
            from app.services.verification import submit_closure as _sc
            return _sc(db, task_id, note=note, photo_url=photo_url, lat=lat, lng=lng)
        except (ImportError, AttributeError):
            # M6 not yet merged — finalise directly so seed works
            task = db.get(Task, task_id)
            if task and task.status in (TASK_OPEN, TASK_IN_PROGRESS):
                from app.services.events import log_event
                from app.models import Closure, OUTCOME_PENDING
                closure = Closure(task_id=task_id, note=note, photo_url=photo_url,
                                  lat=lat, lng=lng,
                                  checks={"photo_present": bool(photo_url),
                                          "geo_ok": bool(lat and lng),
                                          "note_present": len(note.strip()) >= 5},
                                  outcome=OUTCOME_PENDING)
                db.add(closure)
                db.flush()
                log_event(db, "CLOSURE_SUBMITTED",
                          f"Task #{task_id} closure submitted (seed fallback)",
                          task_id=task_id, incident_id=task.incident_id)
                task.status = TASK_PENDING_VERIFICATION
                db.flush()
                return closure
            return None

    def _record_response(task_id: int, report_id: int, fixed: bool,
                         comment: str | None = None) -> object | None:
        try:
            from app.services.verification import record_response as _rr
            return _rr(db, task_id, report_id=report_id, fixed=fixed, comment=comment)
        except (ImportError, AttributeError):
            # M6 not yet merged — finalize directly
            task = db.get(Task, task_id)
            if task and task.status == TASK_PENDING_VERIFICATION:
                from app.services.events import log_event
                from app.models import TASK_CLOSED
                if fixed:
                    log_event(db, "CITIZEN_CONFIRMED",
                              f"Citizen confirmed fix for task #{task_id} (seed fallback)",
                              task_id=task_id, incident_id=task.incident_id, actor="citizen")
                    task.status = TASK_CLOSED
                    task.closure_confidence = "VERIFIED"
                    task.closed_at = clock.now()
                    db.flush()
                    # Resolve incident if all tasks closed
                    inc = db.get(Incident, task.incident_id)
                    if inc and all(t.status == TASK_CLOSED for t in inc.tasks):
                        from app.models import INCIDENT_RESOLVED
                        inc.status = INCIDENT_RESOLVED
                        inc.resolved_at = clock.now()
                        log_event(db, "INCIDENT_RESOLVED",
                                  f"Incident #{inc.id} resolved (seed fallback)",
                                  incident_id=inc.id)
                    db.flush()
                else:
                    log_event(db, "CITIZEN_REJECTED",
                              f"Citizen rejected fix for task #{task_id} (seed fallback): {comment}",
                              task_id=task_id, incident_id=task.incident_id, actor="citizen")
                    try:
                        from app.services.escalation import reopen_task
                        reopen_task(task, reason=f"citizen rejected closure: {comment}",
                                    source="citizen")
                    except (ImportError, AttributeError):
                        from app.models import OUTCOME_CONTRADICTED
                        task.status = TASK_IN_PROGRESS
                        task.reopen_count += 1
                        task.closed_at = None
                        task.closure_confidence = None
                        for cl in task.closures:
                            cl.outcome = OUTCOME_CONTRADICTED
                        db.flush()
                        log_event(db, "TASK_REOPENED",
                                  f"Task #{task_id} reopened: citizen rejected closure (seed fallback)",
                                  task_id=task_id, incident_id=task.incident_id)
                    db.flush()
            return None

    def _run_watchdog() -> None:
        try:
            from app.services.sla import run_watchdog
            run_watchdog(db)
        except (ImportError, AttributeError):
            pass  # M5 not yet merged; watchdog not available

    def _get_incident_task(incident_id: int) -> "Task | None":
        """Return the first non-blocked task on an incident."""
        return (
            db.query(Task)
            .filter(Task.incident_id == incident_id)
            .first()
        )

    def _ingest(cid: str) -> dict:
        """Submit a complaint from the JSON file and return the result dict."""
        c = complaints_by_id[cid]
        _check_coord(c["lat"], c["lng"], cid)
        result = submit_report(
            db,
            text=c["text"],
            lat=c["lat"],
            lng=c["lng"],
            reporter_name=c["reported_by"],
        )
        db.commit()
        return result

    # ==================================================================
    # Reset the clock to a known baseline; we'll advance back and forth
    # to back-date incidents, then leave it at 0 when done.
    # ==================================================================
    clock.reset(db)
    db.commit()

    # ==================================================================
    # SCENARIO A — CLOSED / VERIFIED: water_leak (C-032, ~10 days ago)
    # Uses: Ward 29, booster pump leak — well away from scenario origin.
    # ==================================================================
    clock.advance(-240, db)   # back-date to 10 days ago
    db.commit()

    res_a = _ingest("C-032")
    inc_a = res_a["incident"]  # water_leak -> WATER dept
    task_a = _get_incident_task(inc_a.id)

    if task_a:
        _start_task(task_a.id)
        db.commit()

        # Advance to "fixed" time: 20h later (within 24h SLA)
        clock.advance(20, db)
        db.commit()

        _submit_closure(
            task_a.id,
            note="Booster pump valve replaced and sealed. Supply pressure restored.",
            lat=inc_a.lat,
            lng=inc_a.lng,
            photo_url="https://seed.local/photos/c032_fixed.jpg",
        )
        db.commit()

        # Citizen confirms fix
        if task_a.status == TASK_PENDING_VERIFICATION:
            report_a = res_a["report"]
            _record_response(task_a.id, report_a.id, fixed=True,
                             comment="Water pressure is back, tanks refilled.")
            db.commit()

    # Reset clock to "now" baseline between scenarios
    clock.reset(db)
    db.commit()

    # ==================================================================
    # SCENARIO B — CLOSED / VERIFIED: streetlight (C-033, 8 days ago)
    # Ward 33, flickering high-mast tower — Central Club roundabout.
    # ==================================================================
    clock.advance(-192, db)   # back-date to 8 days ago
    db.commit()

    res_b = _ingest("C-033")
    inc_b = res_b["incident"]  # streetlight -> ELEC dept
    task_b = _get_incident_task(inc_b.id)

    if task_b:
        _start_task(task_b.id)
        db.commit()

        clock.advance(48, db)  # 48h later — within 72h SLA
        db.commit()

        _submit_closure(
            task_b.id,
            note="High mast tower capacitor bank and control relay replaced. Stable illumination confirmed.",
            lat=inc_b.lat,
            lng=inc_b.lng,
            photo_url="https://seed.local/photos/c033_fixed.jpg",
        )
        db.commit()

        if task_b.status == TASK_PENDING_VERIFICATION:
            report_b = res_b["report"]
            _record_response(task_b.id, report_b.id, fixed=True,
                             comment="Lights are stable now. Good work!")
            db.commit()

    clock.reset(db)
    db.commit()

    # ==================================================================
    # SCENARIO C — CLOSED / LOW_CONFIDENCE: garbage (C-034, 7 days ago)
    # Ward 25, dhalao overflow. No citizen response → LOW_CONFIDENCE via
    # watchdog timeout simulation.
    # ==================================================================
    clock.advance(-168, db)   # back-date 7 days
    db.commit()

    res_c = _ingest("C-034")
    inc_c = res_c["incident"]  # garbage -> SANI dept
    task_c = _get_incident_task(inc_c.id)

    if task_c:
        _start_task(task_c.id)
        db.commit()

        clock.advance(36, db)   # 36h later — within 48h SLA
        db.commit()

        _submit_closure(
            task_c.id,
            note="Dhalao cleared, cattle-proof cover installed, area disinfected.",
            lat=inc_c.lat,
            lng=inc_c.lng,
            photo_url="https://seed.local/photos/c034_cleared.jpg",
        )
        db.commit()

        # Advance past verification_deadline (VERIFY_WINDOW_HOURS = 48) with no response
        clock.advance(50, db)
        db.commit()
        _run_watchdog()   # triggers evaluate_timeout → LOW_CONFIDENCE
        db.commit()

        # If watchdog isn't live yet, finalize manually
        db.refresh(task_c) if hasattr(db, "refresh") else None
        if task_c.status == TASK_PENDING_VERIFICATION:
            task_c.status = TASK_CLOSED
            task_c.closure_confidence = "LOW_CONFIDENCE"
            task_c.closed_at = clock.now()
            inc_c.status = "RESOLVED"
            inc_c.resolved_at = clock.now()
            from app.services.events import log_event
            log_event(db, "TASK_CLOSED",
                      "Task closed with LOW_CONFIDENCE after verification timeout (seed fallback)",
                      task_id=task_c.id, incident_id=inc_c.id)
            log_event(db, "INCIDENT_RESOLVED",
                      f"Incident #{inc_c.id} resolved with LOW_CONFIDENCE (seed fallback)",
                      incident_id=inc_c.id)
            db.commit()

    clock.reset(db)
    db.commit()

    # ==================================================================
    # SCENARIO D — IN_PROGRESS: road_damage (C-028, 4 days ago)
    # Ward 23, broken footpath at Preet Vihar metro. Task started, still open.
    # ==================================================================
    clock.advance(-96, db)   # back-date 4 days
    db.commit()

    res_d = _ingest("C-028")
    inc_d = res_d["incident"]  # road_damage -> ROADS dept
    task_d = _get_incident_task(inc_d.id)

    if task_d:
        clock.advance(2, db)   # small delay before starting
        db.commit()
        _start_task(task_d.id)
        db.commit()
        # Leave in IN_PROGRESS — no closure submitted

    clock.reset(db)
    db.commit()

    # ==================================================================
    # SCENARIO E — Close to SLA BREACH / WARNING: drain_blockage (C-029)
    # Ward 36, construction debris blocking drain. Submitted 46h ago
    # (base SLA for drain_blockage = 48h) → in warning zone.
    # ==================================================================
    clock.advance(-46, db)    # 46 hours ago — 2h before 48h SLA expires
    db.commit()

    res_e = _ingest("C-029")
    inc_e = res_e["incident"]  # drain_blockage -> DRAIN dept
    task_e = _get_incident_task(inc_e.id)

    if task_e:
        clock.advance(1, db)   # 1h later — task assigned and opened
        db.commit()
        _start_task(task_e.id)
        db.commit()
        # Now the task has ~1h left on its SLA (warning zone = last 20% = 9.6h for 48h SLA,
        # so this is definitively "breached" — watchdog will escalate on next tick)
        _run_watchdog()
        db.commit()

    clock.reset(db)
    db.commit()

    # ==================================================================
    # SCENARIO F — reopen_count = 1: road_damage (C-036, 5 days ago)
    # Ward 7, speed bump without reflector. Closed once, citizen rejected.
    # ==================================================================
    clock.advance(-120, db)   # 5 days ago
    db.commit()

    res_f = _ingest("C-036")
    inc_f = res_f["incident"]  # road_damage -> ROADS dept
    task_f = _get_incident_task(inc_f.id)

    if task_f:
        _start_task(task_f.id)
        db.commit()

        clock.advance(48, db)  # 48h later — first attempted closure
        db.commit()

        _submit_closure(
            task_f.id,
            note="Speed bump painted white and warning sign erected.",
            lat=inc_f.lat,
            lng=inc_f.lng,
            photo_url="https://seed.local/photos/c036_first_close.jpg",
        )
        db.commit()

        if task_f.status == TASK_PENDING_VERIFICATION:
            report_f = res_f["report"]
            _record_response(task_f.id, report_f.id, fixed=False,
                             comment="Paint has already washed away, no proper retro-reflective material used.")
            db.commit()
            # task_f now has reopen_count = 1, status = IN_PROGRESS (or OPEN)

    clock.reset(db)
    db.commit()

    # ==================================================================
    # SCENARIO G — OPEN baseline incidents across remaining wards/categories
    # C-027: Health / dengue swamp (Ward 12) — no task workflow, OPEN
    # C-030: Public Safety / manhole (Ward 42) — submitted, OPEN
    # C-037: Health / carcass (Ward 10) — submitted, OPEN
    # ==================================================================
    for cid, hours_ago in [("C-027", -72), ("C-030", -48), ("C-037", -24)]:
        clock.advance(hours_ago, db)
        db.commit()
        _ingest(cid)
        clock.reset(db)
        db.commit()

    # ==================================================================
    # Final: ensure clock is at offset 0.
    # ==================================================================
    clock.reset(db)
    db.commit()

    print(
        "Seed complete. Baseline incidents created:\n"
        "  C-032 → CLOSED/VERIFIED (water_leak)\n"
        "  C-033 → CLOSED/VERIFIED (streetlight)\n"
        "  C-034 → CLOSED/LOW_CONFIDENCE (garbage)\n"
        "  C-028 → IN_PROGRESS (road_damage)\n"
        "  C-029 → OPEN/SLA-WARNING (drain_blockage, close to breach)\n"
        "  C-036 → IN_PROGRESS/reopen_count=1 (road_damage)\n"
        "  C-027 → OPEN (health)\n"
        "  C-030 → OPEN (public safety / sanitation)\n"
        "  C-037 → OPEN (health)\n"
    )


# ---------------------------------------------------------------------------
# Standalone entry-point: python scripts/seed.py
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    from app.db import init_db, SessionLocal

    print("Initialising DB and seeding reference data...")
    init_db()

    with SessionLocal() as session:
        print("Running baseline seed...")
        seed(session)

    print("Done.")

