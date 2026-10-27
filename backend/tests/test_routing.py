from datetime import timedelta

import pytest

from app import clock, config
from app.models import Event, Task
from app.services import routing
from app.services.errors import InvalidTransition, NotFound
from app.services.reports import submit_report

LAT, LNG = config.DEMO_SCENARIO_ORIGIN


def at(m: float) -> tuple[float, float]:
    return LAT + m / 111_195, LNG


def types(db, task_id=None):
    q = db.query(Event)
    if task_id:
        q = q.filter_by(task_id=task_id)
    return [e.type for e in q.order_by(Event.id)]


def task_of(r):
    return routing.primary_task(r["incident"])


def test_primary_task_created_with_sla(db):
    t0 = clock.now()
    r = submit_report(db, "Big pothole on the road", *at(0))
    t = task_of(r)
    assert t.department.code == "ROADS" and t.status == "OPEN" and t.priority == "MEDIUM"
    assert t.base_sla_hours == 144 and t.sla_window_hours == 144
    assert abs((t.sla_deadline - t0).total_seconds() - 144 * 3600) < 5
    assert types(db) == ["REPORT_RECEIVED", "INCIDENT_CREATED", "TASK_CREATED"]


def test_high_priority_halves_sla(db):
    r = submit_report(db, "Dangerous pothole accident on the road", 28.6100, 77.2050)  # in hospital zone
    t = task_of(r)
    assert r["incident"].priority == "HIGH" and t.base_sla_hours == 72


def test_merge_raising_priority_shortens_deadline(db):
    r = submit_report(db, "Dangerous pothole on Maple Street", *at(0))
    t = task_of(r)
    before = t.sla_deadline
    for i in range(3):
        submit_report(db, "Dangerous pothole on Maple Street", *at(5 * (i + 1)))
    assert r["incident"].priority == "HIGH" and t.priority == "HIGH"
    assert t.base_sla_hours == 72 and t.sla_deadline == t.created_at + timedelta(hours=72) < before
    assert db.query(Task).count() == 1  # merges do not create tasks


def test_deadline_never_lengthens_on_merge(db):
    r = submit_report(db, "Dangerous pothole on Maple Street", *at(0))
    t = task_of(r)
    t.sla_deadline = t.created_at + timedelta(hours=10)  # already tighter than any new SLA
    for i in range(3):
        submit_report(db, "Dangerous pothole on Maple Street", *at(5 * (i + 1)))
    assert t.sla_deadline == t.created_at + timedelta(hours=10)


@pytest.mark.parametrize("leak_first", [False, True])
def test_leak_blocks_road_task(db, leak_first):
    if leak_first:
        leak = submit_report(db, "Water pipe burst and leaking", *at(0))
        road = submit_report(db, "Big pothole on the road", *at(60))
    else:
        road = submit_report(db, "Big pothole on the road", *at(0))
        leak = submit_report(db, "Water pipe burst and leaking", *at(60))
    rt, lt = task_of(road), task_of(leak)
    assert rt.status == "BLOCKED" and rt.depends_on_task_id == lt.id and rt.paused_at is not None
    assert lt.status == "OPEN" and lt.is_lead and not rt.is_lead
    assert "TASK_BLOCKED" in types(db, rt.id)
    assert road["incident"].cluster_id == leak["incident"].cluster_id
    assert "paused" in road["incident"].cluster.coordination_note


def test_non_blocking_rule_leaves_tasks_open(db):
    g = submit_report(db, "Garbage dump on the corner", *at(0))
    d = submit_report(db, "Drain is clogged and overflowing", *at(50))
    assert d["cluster"] is not None
    assert task_of(g).status == "OPEN" and task_of(d).status == "OPEN"


def test_closed_upstream_does_not_block(db):
    leak = submit_report(db, "Water pipe burst and leaking", *at(0))
    task_of(leak).status = "CLOSED"
    road = submit_report(db, "Big pothole on the road", *at(60))
    assert task_of(road).status == "OPEN"


def test_no_circular_dependency(db):
    a = task_of(submit_report(db, "Water pipe burst and leaking", *at(0)))
    b = task_of(submit_report(db, "Big pothole on the road", *at(500)))
    assert routing.apply_dependency(db, a, b, "t") is True
    assert routing.apply_dependency(db, b, a, "t") is False  # would be a cycle
    assert a.depends_on_task_id is None


def test_start_task(db):
    t = task_of(submit_report(db, "Big pothole on the road", *at(0)))
    routing.start_task(db, t.id)
    assert t.status == "IN_PROGRESS" and types(db, t.id)[-1] == "TASK_STARTED"
    with pytest.raises(InvalidTransition):
        routing.start_task(db, t.id)
    with pytest.raises(NotFound):
        routing.start_task(db, 999)


def test_cannot_start_blocked_task(db):
    submit_report(db, "Water pipe burst and leaking", *at(0))
    road = task_of(submit_report(db, "Big pothole on the road", *at(60)))
    with pytest.raises(InvalidTransition, match="BLOCKED"):
        routing.start_task(db, road.id)


def test_start_endpoint(client):
    r = client.post("/api/reports", json={"text": "Big pothole on the road", "lat": LAT, "lng": LNG}).json()
    tid = 1
    res = client.post(f"/api/tasks/{tid}/start")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "IN_PROGRESS" and body["sla_state"] == "ok" and body["department_code"] == "ROADS"
    assert client.post(f"/api/tasks/{tid}/start").status_code == 409
    assert client.post("/api/tasks/999/start").status_code == 404
