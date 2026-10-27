import pytest

from app import clock, config
from app.models import Event, Task
from app.services import routing, sla
from app.services.reports import submit_report

LAT, LNG = config.DEMO_SCENARIO_ORIGIN


def at(m: float) -> tuple[float, float]:
    return LAT + m / 111_195, LNG


def evs(db, type_, task_id=None):
    q = db.query(Event).filter_by(type=type_)
    if task_id:
        q = q.filter_by(task_id=task_id)
    return q.order_by(Event.id).all()


def leak_task(db):
    return routing.primary_task(submit_report(db, "Water pipe burst and leaking", *at(0))["incident"])


def advance(db, hours):
    clock.advance(hours)
    sla.run_watchdog(db)


def test_blocked_task_paused_then_resumes_with_extension(db):
    leak = routing.primary_task(submit_report(db, "Water pipe burst and leaking", *at(0))["incident"])
    road = routing.primary_task(submit_report(db, "Big pothole on the road", *at(60))["incident"])
    assert road.status == "BLOCKED"
    deadline0, paused_at = road.sla_deadline, road.paused_at
    remaining0 = sla.sla_remaining_seconds(road)
    advance(db, 300)  # far past road's own deadline
    assert sla.sla_state(road) == "paused" and abs(sla.sla_remaining_seconds(road) - remaining0) < 5
    assert not evs(db, "SLA_BREACHED", road.id) and not evs(db, "SLA_WARNING", road.id)
    assert road.sla_deadline == deadline0 and road.escalation_level == 0
    leak.status = "CLOSED"
    freed = sla.unblock_dependents(db, leak)
    assert freed == [road] and road.status == "OPEN" and road.paused_at is None
    assert abs(((road.sla_deadline - deadline0) - (clock.now() - paused_at)).total_seconds()) < 1
    assert abs((road.sla_deadline - deadline0).total_seconds() - 300 * 3600) < 5
    assert road.sla_deadline > clock.now()  # clock resumed with its remaining time intact
    unblocked = evs(db, "TASK_UNBLOCKED", road.id)
    assert len(unblocked) == 1 and unblocked[0].reason


def test_warning_fires_once_at_80_percent(db):
    t = leak_task(db)  # 24h window
    advance(db, 19)
    assert not evs(db, "SLA_WARNING") and sla.sla_state(t) == "ok"
    advance(db, 0.5)
    assert len(evs(db, "SLA_WARNING")) == 1 and t.warned and sla.sla_state(t) == "warning"
    sla.run_watchdog(db)
    advance(db, 1)
    assert len(evs(db, "SLA_WARNING")) == 1 and not evs(db, "SLA_BREACHED")


def test_breach_escalates_up_ladder_and_caps(db):
    t = leak_task(db)
    advance(db, 25)
    assert len(evs(db, "SLA_WARNING")) == 1  # warning is never skipped
    assert len(evs(db, "SLA_BREACHED")) == 1 and t.breach_count == 1 and t.escalation_level == 1
    assert t.sla_window_hours == 12 and not t.warned
    assert abs((t.sla_deadline - clock.now()).total_seconds() - 12 * 3600) < 5
    esc = evs(db, "ESCALATED")[-1]
    assert esc.payload == {"from_level": 0, "to_level": 1, "to_role": "Department Supervisor"} and esc.reason
    advance(db, 13)
    assert t.escalation_level == 2 and t.breach_count == 2
    advance(db, 13)
    assert t.escalation_level == 3
    advance(db, 13)
    assert t.escalation_level == 3 and t.breach_count == 4
    last = evs(db, "ESCALATED")[-1]
    assert last.payload["from_level"] == 3 and "commissioner review" in last.reason


def test_rearmed_window_warns_again(db):
    t = leak_task(db)
    advance(db, 25)
    advance(db, 10)  # 10 of 12h used -> past 80% of the re-armed window
    assert t.warned and len(evs(db, "SLA_WARNING")) == 2


def test_in_progress_breaches_but_pending_and_closed_do_not(db):
    a, b, c = (routing.primary_task(submit_report(db, "Water pipe burst and leaking", *at(m))["incident"])
               for m in (0, 1000, 2000))
    routing.start_task(db, a.id)
    b.status, c.status = "PENDING_VERIFICATION", "CLOSED"
    advance(db, 30)
    assert a.escalation_level == 1 and b.escalation_level == 0 and c.escalation_level == 0


def test_view_helper_shows_breached(db):
    t = leak_task(db)
    clock.advance(30)
    assert sla.sla_state(t) == "breached" and sla.sla_remaining_seconds(t) < 0


def test_clock_endpoints_run_watchdog(client, db):
    client.post("/api/reports", json={"text": "Water pipe burst and leaking", "lat": LAT, "lng": LNG})
    assert client.get("/api/admin/clock").json()["offset_seconds"] == 0
    res = client.post("/api/admin/clock/advance", json={"hours": 25})
    assert res.status_code == 200 and res.json()["offset_seconds"] == 25 * 3600
    types = [e.type for e in db.query(Event).order_by(Event.id)]
    assert {"CLOCK_ADVANCED", "SLA_WARNING", "SLA_BREACHED", "ESCALATED"} <= set(types)
    assert db.query(Task).one().escalation_level == 1
    assert client.post("/api/admin/tick").status_code == 200
    assert client.post("/api/admin/clock/advance", json={"hours": 0}).status_code == 422
    assert client.post("/api/admin/clock/reset").json()["offset_seconds"] == 0
