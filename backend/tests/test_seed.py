"""Tests for backend/scripts/seed.py (Teammate 3 contract, CONTEXT.md §9.4).

All tests use the standard in-memory SQLite fixture from conftest.py (no real DB file,
no network, no teammate-owned imports). The seed script must not be imported at module
level — import it lazily inside each test to avoid triggering DB side-effects.

Acceptance criteria checked (CONTEXT.md §9.4):
1. seed(db) is importable and callable without error.
2. Does NOT create departments or vulnerable zones.
3. ~10 baseline incidents across categories and states.
4. Every incident is >= SEED_MIN_DISTANCE_FROM_SCENARIO_M from DEMO_SCENARIO_ORIGIN.
5. Clock is left at offset 0 when seed() finishes.
6. Specific state-mix present (CLOSED/VERIFIED, CLOSED/LOW_CONFIDENCE, IN_PROGRESS,
   close-to-SLA-breach, reopen_count >= 1, OPEN baseline).
"""

from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

import pytest

from app import clock, config
from app.models import (
    TASK_CLOSED,
    TASK_IN_PROGRESS,
    TASK_OPEN,
    Incident,
    Task,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Duplicated here so tests never import from app.geo directly."""
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * 6_371_000 * asin(sqrt(a))


def _run_seed(db):
    """Import and run the seed function against the provided session."""
    import importlib, sys
    # Remove cached module so each test gets a clean import
    for key in list(sys.modules):
        if "scripts.seed" in key or key == "seed":
            del sys.modules[key]
    from scripts.seed import seed
    seed(db)


# ---------------------------------------------------------------------------
# Basic contract tests
# ---------------------------------------------------------------------------

def test_seed_importable_and_callable(db):
    """seed(db) must complete without raising."""
    _run_seed(db)


def test_seed_does_not_create_departments(db):
    """seed() must not create new departments (seed_reference_data owns those)."""
    from app.models import Department
    before_codes = {d.code for d in db.query(Department).all()}
    _run_seed(db)
    after_codes = {d.code for d in db.query(Department).all()}
    assert before_codes == after_codes, (
        f"seed() must not add/remove departments. "
        f"Before: {before_codes}, After: {after_codes}"
    )


def test_seed_does_not_create_vulnerable_zones(db):
    """seed() must not create new vulnerable zones."""
    from app.models import VulnerableZone
    before_count = db.query(VulnerableZone).count()
    _run_seed(db)
    after_count = db.query(VulnerableZone).count()
    assert before_count == after_count, (
        f"seed() must not add vulnerable zones. Before: {before_count}, After: {after_count}"
    )


def test_seed_clock_reset_to_zero(db):
    """Clock offset must be exactly 0 when seed() returns."""
    _run_seed(db)
    offset = clock.offset_seconds()
    assert offset == 0.0, (
        f"Clock must be at offset 0 after seed, got {offset}s"
    )


def test_seed_is_idempotent_enough_not_to_crash_twice(db):
    """Running seed twice should not raise (re-runnable for demo resets)."""
    _run_seed(db)
    clock.reset(db)
    db.commit()
    # Second run may produce more incidents (dedup will merge some),
    # but must not raise.
    _run_seed(db)


# ---------------------------------------------------------------------------
# Incident count & geography
# ---------------------------------------------------------------------------

def test_seed_produces_at_least_eight_incidents(db):
    """At least 8 baseline incidents must be created (contract says ~10)."""
    _run_seed(db)
    count = db.query(Incident).count()
    assert count >= 8, f"Expected >= 8 incidents after seed, got {count}"


def test_all_incidents_clear_of_demo_scenario_origin(db):
    """Every seeded incident must be >= SEED_MIN_DISTANCE_FROM_SCENARIO_M from DEMO_SCENARIO_ORIGIN."""
    _run_seed(db)
    origin_lat, origin_lng = config.DEMO_SCENARIO_ORIGIN
    min_dist = config.SEED_MIN_DISTANCE_FROM_SCENARIO_M

    violations = []
    for inc in db.query(Incident).all():
        d = _haversine_m(inc.lat, inc.lng, origin_lat, origin_lng)
        if d < min_dist:
            violations.append(
                f"Incident #{inc.id} ({inc.category}) is only {d:.0f}m from DEMO_SCENARIO_ORIGIN"
                f" (minimum {min_dist}m required)"
            )

    assert not violations, "\n".join(violations)


# ---------------------------------------------------------------------------
# Required state-mix
# ---------------------------------------------------------------------------

def test_at_least_one_closed_verified_task(db):
    """There must be at least one CLOSED/VERIFIED task after seeding."""
    _run_seed(db)
    verified = (
        db.query(Task)
        .filter(Task.status == TASK_CLOSED, Task.closure_confidence == "VERIFIED")
        .count()
    )
    assert verified >= 1, (
        f"Expected at least 1 CLOSED/VERIFIED task, found {verified}"
    )


def test_at_least_one_closed_low_confidence_task(db):
    """There must be at least one CLOSED/LOW_CONFIDENCE task after seeding."""
    _run_seed(db)
    low_conf = (
        db.query(Task)
        .filter(Task.status == TASK_CLOSED, Task.closure_confidence == "LOW_CONFIDENCE")
        .count()
    )
    assert low_conf >= 1, (
        f"Expected at least 1 CLOSED/LOW_CONFIDENCE task, found {low_conf}"
    )


def test_at_least_one_in_progress_task(db):
    """There must be at least one IN_PROGRESS task after seeding."""
    _run_seed(db)
    in_progress = (
        db.query(Task)
        .filter(Task.status == TASK_IN_PROGRESS)
        .count()
    )
    assert in_progress >= 1, (
        f"Expected at least 1 IN_PROGRESS task, found {in_progress}"
    )


def test_at_least_one_task_with_reopen_count(db):
    """There must be at least one task with reopen_count >= 1."""
    _run_seed(db)
    reopened = (
        db.query(Task)
        .filter(Task.reopen_count >= 1)
        .count()
    )
    assert reopened >= 1, (
        f"Expected at least 1 task with reopen_count >= 1, found {reopened}"
    )


def test_at_least_one_sla_warning_or_breached_task(db):
    """At least one task must have a passed or nearly passed SLA deadline (warning or breach)."""
    from app.services.sla import sla_state
    _run_seed(db)

    near_breach = [
        t for t in db.query(Task).filter(Task.status.in_([TASK_OPEN, TASK_IN_PROGRESS]))
        if sla_state(t) in ("warning", "breached")
    ]
    assert near_breach, (
        "Expected at least one task in 'warning' or 'breached' SLA state after seed"
    )


def test_at_least_two_open_baseline_incidents(db):
    """At least 2 plain OPEN incidents (without any task workflow) should exist."""
    _run_seed(db)
    open_incidents = db.query(Incident).filter_by(status="OPEN").count()
    assert open_incidents >= 2, (
        f"Expected >= 2 OPEN incidents, found {open_incidents}"
    )


# ---------------------------------------------------------------------------
# Data quality: events audit trail
# ---------------------------------------------------------------------------

def test_every_incident_has_at_least_one_event(db):
    """Every incident must have at least INCIDENT_CREATED in the event log."""
    from app.models import Event
    _run_seed(db)
    incidents = db.query(Incident).all()
    for inc in incidents:
        ev_count = db.query(Event).filter_by(incident_id=inc.id).count()
        assert ev_count >= 1, (
            f"Incident #{inc.id} ({inc.category}) has no events — "
            "seed must go through services, not raw inserts"
        )


def test_no_raw_incident_inserts(db):
    """All incidents must have a corresponding REPORT_RECEIVED event, proving
    they were created through submit_report (not raw inserts)."""
    from app.models import Event
    _run_seed(db)
    received_incident_ids = {
        e.incident_id
        for e in db.query(Event).filter_by(type="REPORT_RECEIVED").all()
        if e.incident_id is not None
    }
    incident_ids = {inc.id for inc in db.query(Incident).all()}
    # Every incident must appear in at least one REPORT_RECEIVED or INCIDENT_CREATED event
    created_incident_ids = {
        e.incident_id
        for e in db.query(Event).filter_by(type="INCIDENT_CREATED").all()
        if e.incident_id is not None
    }
    all_event_incident_ids = received_incident_ids | created_incident_ids
    orphans = incident_ids - all_event_incident_ids
    assert not orphans, (
        f"Incidents {orphans} have no REPORT_RECEIVED or INCIDENT_CREATED events — "
        "they were probably inserted raw, bypassing services"
    )


# ---------------------------------------------------------------------------
# Category coverage
# ---------------------------------------------------------------------------

def test_multiple_categories_present(db):
    """Seed should span at least 3 different categories for realistic demo coverage."""
    _run_seed(db)
    categories = {inc.category for inc in db.query(Incident).all()}
    assert len(categories) >= 3, (
        f"Expected >= 3 distinct categories, found {categories}"
    )


def test_water_leak_or_drain_category_present(db):
    """At least one water_leak or drain_blockage incident (for SLA demo)."""
    _run_seed(db)
    cats = {inc.category for inc in db.query(Incident).all()}
    assert cats & {"water_leak", "drain_blockage"}, (
        f"Expected a water_leak or drain_blockage incident; found {cats}"
    )


def test_road_damage_category_present(db):
    """At least one road_damage incident (for reopen demo)."""
    _run_seed(db)
    cats = {inc.category for inc in db.query(Incident).all()}
    assert "road_damage" in cats, (
        f"Expected a road_damage incident; found {cats}"
    )

