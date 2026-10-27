import pytest

from app import clock, config
from app.models import Closure, Event, VerificationRequest
from app.services import routing, sla, verification
from app.services.errors import InvalidTransition, NotFound
from app.services.reports import submit_report

LAT, LNG = config.DEMO_SCENARIO_ORIGIN


def at(m: float) -> tuple[float, float]:
    return LAT + m / 111_195, LNG


def evs(db, type_, task_id=None):
    q = db.query(Event).filter_by(type=type_)
    if task_id:
        q = q.filter_by(task_id=task_id)
    return q.order_by(Event.id).all()


def pothole(db, n_reports=1):
    r = submit_report(db, "Big pothole on the road", *at(0))
    for i in range(1, n_reports):
        submit_report(db, "Big pothole on the road", *at(3 * i))
    return r["incident"], routing.primary_task(r["incident"])


def good_close(db, task):
    return verification.submit_closure(db, task.id, "Filled and levelled", "http://img/ok.jpg", *at(5))


def test_08_closure_without_photo_rejected_and_reopened(db):
    inc, t = pothole(db)
    c = verification.submit_closure(db, t.id, "Filled the hole", None, *at(0))
    assert c.outcome == "REJECTED" and c.checks["photo_present"] is False
    assert t.status == "OPEN" and t.reopen_count == 1
    assert len(evs(db, "CLOSURE_REJECTED", t.id)) == 1 and len(evs(db, "TASK_REOPENED", t.id)) == 1
    assert "no photo" in evs(db, "TASK_REOPENED")[0].reason


def test_09_closure_far_from_incident_rejected(db):
    inc, t = pothole(db)
    c = verification.submit_closure(db, t.id, "Filled the hole", "http://img/x.jpg", *at(500))
    assert c.checks["geo_ok"] is False and c.outcome == "REJECTED"
    assert t.status == "OPEN" and t.reopen_count == 1
    c2 = verification.submit_closure(db, t.id, "Filled the hole", "http://img/x.jpg", None, None)
    assert c2.checks["geo_ok"] is False and t.reopen_count == 2


def test_10_valid_closure_pending_verification_with_requests(db):
    inc, t = pothole(db, n_reports=7)
    routing.start_task(db, t.id)
    c = good_close(db, t)
    assert t.status == "PENDING_VERIFICATION" and c.outcome == "PENDING"
    assert all(c.checks.values())
    assert abs((t.verification_deadline - clock.now()).total_seconds() - 48 * 3600) < 5
    reqs = db.query(VerificationRequest).filter_by(task_id=t.id).all()
    assert len(reqs) == config.MAX_VERIFICATION_REQUESTS == 5 and len({r.report_id for r in reqs}) == 5
    assert len(evs(db, "VERIFICATION_REQUESTED", t.id)) == 1


def test_11_quorum_confirms_and_resolves_incident(db):
    inc, t = pothole(db, n_reports=4)  # 4 requests -> need 2
    good_close(db, t)
    ids = [r.report_id for r in db.query(VerificationRequest).filter_by(task_id=t.id)]
    verification.record_response(db, t.id, ids[0], True)
    assert t.status == "PENDING_VERIFICATION"
    verification.record_response(db, t.id, ids[1], True, "all good")
    assert t.status == "CLOSED" and t.closure_confidence == "VERIFIED" and t.closed_at
    assert inc.status == "RESOLVED" and inc.resolved_at
    assert db.query(Closure).one().outcome == "VERIFIED"
    assert len(evs(db, "TASK_CLOSED")) == 1 and len(evs(db, "INCIDENT_RESOLVED")) == 1
    assert len(evs(db, "CITIZEN_CONFIRMED")) == 2


def test_11b_closing_upstream_unblocks_downstream(db):
    leak = submit_report(db, "Water pipe burst and leaking", *at(0))
    road = submit_report(db, "Big pothole on the road", *at(60))
    lt, rt = routing.primary_task(leak["incident"]), routing.primary_task(road["incident"])
    assert rt.status == "BLOCKED"
    with pytest.raises(InvalidTransition):
        verification.submit_closure(db, rt.id, "done", "http://i", *at(60))
    verification.submit_closure(db, lt.id, "Pipe replaced", "http://i/p.jpg", *at(0))
    rid = db.query(VerificationRequest).filter_by(task_id=lt.id).one().report_id
    verification.record_response(db, lt.id, rid, True)
    assert lt.status == "CLOSED" and rt.status == "OPEN" and rt.paused_at is None
    assert road["incident"].status == "OPEN" and leak["incident"].status == "RESOLVED"


def test_12_citizen_rejects_reopens_with_shorter_sla(db):
    inc, t = pothole(db)
    good_close(db, t)
    rid = db.query(VerificationRequest).one().report_id
    verification.record_response(db, t.id, rid, False, "still a hole")
    assert t.status == "OPEN" and t.reopen_count == 1 and t.escalation_level == 0
    assert abs((t.sla_deadline - clock.now()).total_seconds() - 0.5 * 144 * 3600) < 5
    assert db.query(Closure).one().outcome == "CONTRADICTED" and inc.status == "OPEN"
    assert "still a hole" in evs(db, "TASK_REOPENED")[0].reason
    assert len(evs(db, "CITIZEN_REJECTED")) == 1


def test_13_new_report_after_closure_contradicts(db):
    inc, t = pothole(db)
    good_close(db, t)
    verification.record_response(db, t.id, db.query(VerificationRequest).one().report_id, True)
    assert t.status == "CLOSED" and inc.status == "RESOLVED"
    r = submit_report(db, "Pothole is back on the road", *at(10))
    assert r["decision"] == "duplicate" and r["incident"].id == inc.id
    assert len(evs(db, "CONTRADICTION_DETECTED", t.id)) == 1
    assert t.status == "OPEN" and t.reopen_count == 1 and inc.status == "OPEN" and t.closure_confidence is None
    assert db.query(Closure).one().outcome == "CONTRADICTED"


def test_13b_report_during_pending_verification_contradicts(db):
    inc, t = pothole(db)
    good_close(db, t)
    submit_report(db, "Big pothole on the road", *at(8))
    assert t.status == "OPEN" and t.reopen_count == 1 and len(evs(db, "CONTRADICTION_DETECTED")) == 1


def test_13c_old_closure_outside_window_not_contradicted(db):
    inc, t = pothole(db)
    good_close(db, t)
    verification.record_response(db, t.id, db.query(VerificationRequest).one().report_id, True)
    clock.advance(24 * (config.POST_CLOSURE_WINDOW_DAYS + 1))
    r = submit_report(db, "Big pothole on the road", *at(8))
    assert r["decision"] == "new" and t.status == "CLOSED" and not evs(db, "CONTRADICTION_DETECTED")


def test_14_second_reopen_forces_escalation_to_dept_head(db):
    inc, t = pothole(db)
    good_close(db, t)
    verification.record_response(db, t.id, db.query(VerificationRequest).one().report_id, False, "nope")
    assert t.reopen_count == 1 and t.escalation_level == 0
    good_close(db, t)
    last = db.query(VerificationRequest).order_by(VerificationRequest.id.desc()).first()
    verification.record_response(db, t.id, last.report_id, False, "still broken")
    assert t.reopen_count == 2 and t.escalation_level >= 2
    esc = evs(db, "ESCALATED", t.id)
    assert esc and "repeated failed closure" in esc[0].reason and esc[-1].payload["to_role"] == "Department Head"


def test_14b_contradiction_after_reopen_escalates(db):
    inc, t = pothole(db)
    good_close(db, t)
    verification.record_response(db, t.id, db.query(VerificationRequest).one().report_id, False)
    good_close(db, t)
    for r in db.query(VerificationRequest).filter_by(closure_id=db.query(Closure).order_by(Closure.id.desc()).first().id):
        verification.record_response(db, t.id, r.report_id, True)
    assert t.status == "CLOSED"
    submit_report(db, "Big pothole on the road", *at(10))
    assert t.reopen_count == 2 and t.escalation_level == 2


def test_15_timeout_closes_low_confidence(db):
    inc, t = pothole(db)
    good_close(db, t)
    clock.advance(47)
    sla.run_watchdog(db)
    assert t.status == "PENDING_VERIFICATION"
    clock.advance(2)
    sla.run_watchdog(db)
    assert t.status == "CLOSED" and t.closure_confidence == "LOW_CONFIDENCE"
    assert db.query(Closure).one().outcome == "LOW_CONFIDENCE" and inc.status == "RESOLVED"
    assert "low confidence" in evs(db, "TASK_CLOSED")[0].reason


def test_15b_rejection_beats_timeout(db):
    inc, t = pothole(db)
    good_close(db, t)
    verification.record_response(db, t.id, db.query(VerificationRequest).one().report_id, False)
    clock.advance(49)
    verification.evaluate_timeout(db, t)
    assert t.status == "OPEN"


def test_16_every_event_has_reason_and_expected_types(db):
    inc, t = pothole(db, 3)
    verification.submit_closure(db, t.id, "x", None, None, None)          # rejected + reopen
    good_close(db, t)
    rid = db.query(VerificationRequest).first().report_id
    verification.record_response(db, t.id, rid, False, "no")              # reopen #2 + escalate
    good_close(db, t)
    clock.advance(49)
    sla.run_watchdog(db)                                                   # low-confidence close
    submit_report(db, "Big pothole on the road", *at(4))                  # contradiction
    types = {e.type for e in db.query(Event)}
    assert {"CLOSURE_SUBMITTED", "CLOSURE_REJECTED", "VERIFICATION_REQUESTED", "CITIZEN_REJECTED", "TASK_REOPENED",
            "ESCALATED", "TASK_CLOSED", "INCIDENT_RESOLVED", "CONTRADICTION_DETECTED"} <= types
    assert all(e.reason and e.reason.strip() for e in db.query(Event))
    assert all(e.incident_id for e in db.query(Event).filter(Event.type != "CLOCK_ADVANCED"))


def test_17_invalid_transitions(db):
    leak = submit_report(db, "Water pipe burst and leaking", *at(0))
    road = submit_report(db, "Big pothole on the road", *at(60))
    lt, rt = routing.primary_task(leak["incident"]), routing.primary_task(road["incident"])
    with pytest.raises(InvalidTransition):
        verification.submit_closure(db, rt.id, "done now", "http://i", *at(60))  # BLOCKED
    verification.submit_closure(db, lt.id, "Pipe replaced", "http://i/p.jpg", *at(0))
    with pytest.raises(InvalidTransition):
        verification.submit_closure(db, lt.id, "again", "http://i", *at(0))      # PENDING_VERIFICATION
    rid = db.query(VerificationRequest).filter_by(task_id=lt.id).one().report_id
    with pytest.raises(NotFound):
        verification.record_response(db, lt.id, 9999, True)
    verification.record_response(db, lt.id, rid, True)
    with pytest.raises(InvalidTransition):
        verification.submit_closure(db, lt.id, "again", "http://i", *at(0))      # CLOSED
    with pytest.raises(InvalidTransition):
        verification.record_response(db, lt.id, rid, True)                       # not awaiting verification
    with pytest.raises(NotFound):
        verification.submit_closure(db, 999, "x", None, None, None)
    with pytest.raises(InvalidTransition):
        routing.start_task(db, lt.id)


def test_17_api_status_codes(client):
    client.post("/api/reports", json={"text": "Big pothole on the road", "lat": LAT, "lng": LNG})
    assert client.post("/api/tasks/999/close", json={"note": "x"}).status_code == 404
    bad = client.post("/api/tasks/1/close", json={"note": "Filled it in", "lat": LAT, "lng": LNG})
    assert bad.status_code == 200 and bad.json()["closure"]["outcome"] == "REJECTED"
    assert bad.json()["task"]["reopen_count"] == 1
    ok = client.post("/api/tasks/1/close", json={"note": "Filled it in", "photo_url": "http://i/a.jpg",
                                                 "lat": LAT, "lng": LNG}).json()
    assert ok["task"]["status"] == "PENDING_VERIFICATION"
    assert client.post("/api/tasks/1/close", json={"note": "Filled again"}).status_code == 409
    assert client.post("/api/tasks/1/verify-response", json={"report_id": 99, "fixed": True}).status_code == 404
    res = client.post("/api/tasks/1/verify-response", json={"report_id": 1, "fixed": True})
    assert res.status_code == 200 and res.json()["task"]["closure_confidence"] == "VERIFIED"
    assert client.post("/api/tasks/1/verify-response", json={"report_id": 1, "fixed": True}).status_code == 409
