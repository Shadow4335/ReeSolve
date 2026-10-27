import sys
import types

from app import clock, config
from app.models import Department, Incident, Task
from app.services import sla, verification
from app.services.reports import submit_report
from app.services.stats import compute_stats

LAT, LNG = config.DEMO_SCENARIO_ORIGIN


def at(m):
    return LAT + m / 111_195, LNG


def test_stats_empty(db):
    s = compute_stats(db)
    assert len(s["by_department"]) == 5 and s["avg_resolution_hours"] is None
    assert all(d["sla_compliance_pct"] is None for d in s["by_department"])
    assert s["totals"]["incidents"] == 0


def test_stats_reflect_breaches_reopens_and_resolution(db):
    leak = submit_report(db, "Water pipe burst and leaking", *at(0))["incident"]
    road = submit_report(db, "Big pothole on the road", *at(1000))["incident"]
    lt, rt = leak.tasks[0], road.tasks[0]
    clock.advance(25)
    sla.run_watchdog(db)                       # leak breaches -> escalation level 1
    verification.submit_closure(db, rt.id, "Filled it in", None, None, None)  # rejected -> reopen
    s = compute_stats(db)
    water = next(d for d in s["by_department"] if d["code"] == "WATER")
    roads = next(d for d in s["by_department"] if d["code"] == "ROADS")
    assert water["sla_compliance_pct"] == 0.0 and water["breached_tasks"] == 1
    assert roads["sla_compliance_pct"] == 100.0 and roads["reopen_rate_pct"] == 100.0
    assert s["escalations_by_level"]["Department Supervisor"] == 1
    assert s["totals"]["reopens"] == 1 and s["totals"]["open_incidents"] == 2


def test_stats_avg_resolution(db):
    inc = submit_report(db, "Big pothole on the road", *at(0))["incident"]
    t = inc.tasks[0]
    clock.advance(10)
    verification.submit_closure(db, t.id, "Filled it in", "http://i", *at(0))
    verification.record_response(db, t.id, inc.reports[0].id, True)
    s = compute_stats(db)
    assert 9.9 < s["avg_resolution_hours"] < 10.1 and s["totals"]["resolved_incidents"] == 1


def test_stats_endpoint(client):
    client.post("/api/reports", json={"text": "Big pothole on the road", "lat": LAT, "lng": LNG})
    body = client.get("/api/admin/stats").json()
    assert body["totals"]["incidents"] == 1 and set(body) >= {"by_department", "escalations_by_level", "avg_resolution_hours"}


def test_reset_wipes_data_but_keeps_reference_data(client, db):
    client.post("/api/reports", json={"text": "Big pothole on the road", "lat": LAT, "lng": LNG})
    client.post("/api/admin/clock/advance", json={"hours": 5})
    assert client.post("/api/admin/reset").json() == {"reset": True}
    assert db.query(Incident).count() == 0 and db.query(Task).count() == 0
    assert db.query(Department).count() == 5
    assert client.get("/api/admin/clock").json()["offset_seconds"] == 0


def test_seed_endpoint_missing_script_501(client, monkeypatch):
    monkeypatch.setitem(sys.modules, "scripts.seed_demo", None)
    assert client.post("/api/admin/seed").status_code == 501


def test_seed_endpoint_calls_seed(client, monkeypatch):
    calls = []
    fake = types.ModuleType("scripts.seed_demo")
    fake.seed = lambda db: calls.append(db)
    monkeypatch.setitem(sys.modules, "scripts.seed_demo", fake)
    assert client.post("/api/admin/seed").json() == {"seeded": True} and len(calls) == 1
