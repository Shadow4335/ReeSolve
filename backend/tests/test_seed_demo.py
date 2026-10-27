from app import clock, config
from app.geo import haversine_m
from app.models import Event, Incident, Task
from app.services import sla
from app.services.reports import submit_report
from scripts.seed_demo import seed


def test_seed_mix_and_distances(db):
    seed(db)
    incs = db.query(Incident).all()
    assert 10 <= len(incs) <= 12
    assert all(haversine_m(i.lat, i.lng, *config.DEMO_SCENARIO_ORIGIN) >= config.SEED_MIN_DISTANCE_FROM_SCENARIO_M
               for i in incs)
    tasks = db.query(Task).all()
    assert sum(1 for t in tasks if t.closure_confidence == "VERIFIED") >= 3
    assert sum(1 for t in tasks if t.closure_confidence == "LOW_CONFIDENCE") == 1
    assert sum(1 for t in tasks if t.status == "IN_PROGRESS") == 1
    assert sum(1 for t in tasks if t.reopen_count == 1) == 1
    assert sum(1 for t in tasks if t.status == "BLOCKED") == 1
    assert sum(1 for t in tasks if t.escalation_level >= 1) >= 1
    assert any(t.warned and t.status in ("OPEN", "IN_PROGRESS") for t in tasks)  # close to breach
    assert any(i.report_count == 4 and i.priority == "HIGH" for i in incs)
    assert sum(1 for i in incs if i.status == "RESOLVED") >= 4


def test_seed_leaves_clock_at_zero_and_events_consistent(db):
    seed(db)
    assert clock.offset_seconds() == 0
    assert all(e.reason for e in db.query(Event))
    assert max(e.ts for e in db.query(Event)) <= clock.now()


def test_seed_idempotent_and_demo_origin_stays_clean(db):
    seed(db)
    n = db.query(Incident).count()
    seed(db)
    assert db.query(Incident).count() == n
    r = submit_report(db, "Big pothole on the road", *config.DEMO_SCENARIO_ORIGIN)
    assert r["decision"] == "new" and r["cluster"] is None


def test_baseline_stays_quiet_during_early_demo_clock_jumps(db):
    seed(db)
    before = db.query(Event).count()
    clock.advance(27)
    sla.run_watchdog(db)
    new = db.query(Event).filter(Event.id > before).all()
    assert [e.type for e in new if e.type in ("SLA_BREACHED", "ESCALATED", "TASK_CLOSED")] == []
