from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app import clock, config
from app.geo import haversine_m
from app.main import app
from app.models import Department, Incident, Setting, Task, VulnerableZone, Event
from app.schemas import TaskOut
from app.services.events import log_event
from app.services import sla


def test_health():
    assert TestClient(app).get("/api/health").json() == {"status": "ok"}


def test_clock_advance_and_reset(db):
    t0 = clock.now()
    clock.advance(24, db)
    assert clock.now() - t0 >= timedelta(hours=24)
    assert db.get(Setting, "clock_offset_seconds").value == str(24 * 3600.0)
    clock.reset(db)
    assert abs((clock.now() - t0).total_seconds()) < 5


def test_clock_load_restores_offset(db):
    clock.advance(2, db)
    db.commit()
    clock.reset()
    clock.load(db)
    assert clock.offset_seconds() == 2 * 3600


def test_haversine():
    assert haversine_m(*config.DEMO_CENTER, *config.DEMO_CENTER) == 0
    d = haversine_m(*config.DEMO_CENTER, *config.DEMO_SCENARIO_ORIGIN)
    assert 700 < d < 900


def test_reference_data_seeded_and_idempotent(db):
    from app.db import seed_reference_data
    seed_reference_data(db)
    db.commit()
    assert {d.code for d in db.query(Department)} == {"ROADS", "WATER", "DRAIN", "SANI", "ELEC"}
    assert db.query(VulnerableZone).count() == len(config.VULNERABLE_ZONES)


def test_zones_clear_of_demo_origin():
    for z in config.VULNERABLE_ZONES:
        assert haversine_m(z["lat"], z["lng"], *config.DEMO_SCENARIO_ORIGIN) > z["radius_m"] + 300


def test_log_event_requires_reason_and_known_type(db):
    ev = log_event(db, "REPORT_RECEIVED", "citizen submitted report #1", actor="citizen", payload={"a": 1})
    assert ev.id and ev.payload == {"a": 1}
    with pytest.raises(ValueError):
        log_event(db, "REPORT_RECEIVED", "  ")
    with pytest.raises(ValueError):
        log_event(db, "NOPE", "x")


def _task(db, status="OPEN", window=10.0, deadline_in=10.0):
    inc = Incident(category="road_damage", summary="pothole", lat=1, lng=1)
    db.add(inc)
    db.flush()
    dept = db.query(Department).filter_by(code="ROADS").one()
    t = Task(incident_id=inc.id, department_id=dept.id, status=status, base_sla_hours=window,
             sla_window_hours=window, sla_deadline=clock.now() + timedelta(hours=deadline_in))
    db.add(t)
    db.flush()
    return t


def test_task_view_states(db):
    t = _task(db)
    assert sla.task_view(t)["sla_state"] == "ok"
    clock.advance(8.5)
    assert sla.task_view(t)["sla_state"] == "warning"
    clock.advance(2)
    assert sla.task_view(t)["sla_state"] == "breached"
    t.status = "BLOCKED"
    t.paused_at = clock.now()
    assert sla.task_view(t)["sla_state"] == "paused"


def test_task_out_shape(db):
    out = TaskOut.from_task(_task(db))
    d = out.model_dump(mode="json")
    for k in ("sla_state", "sla_remaining_seconds", "escalation_level_label", "department_name", "escalation_level", "status"):
        assert k in d
    assert d["escalation_level_label"] == "Field Team"
    assert d["department_name"] == "Roads & Infrastructure"
