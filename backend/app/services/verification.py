"""Verification gate (CONTEXT 6.7): closure evidence, citizen responses, timeout, post-closure contradiction."""
from datetime import timedelta
from math import ceil

from sqlalchemy.orm import Session

from app import clock, config
from app.geo import haversine_m
from app.models import (
    CONF_LOW, CONF_VERIFIED, INCIDENT_RESOLVED, OUTCOME_LOW_CONFIDENCE, OUTCOME_REJECTED, OUTCOME_VERIFIED,
    TASK_CLOSED, TASK_IN_PROGRESS, TASK_OPEN, TASK_PENDING_VERIFICATION, VR_FIXED, VR_NOT_FIXED,
    Closure, Incident, Report, Task, VerificationRequest,
)
from app.services import escalation, sla
from app.services.errors import InvalidTransition, NotFound
from app.services.events import log_event


def _get_task(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise NotFound(f"task {task_id} not found")
    return task


def latest_closure(db: Session, task: Task) -> Closure | None:
    return db.query(Closure).filter_by(task_id=task.id).order_by(Closure.id.desc()).first()


def submit_closure(db: Session, task_id: int, note: str, photo_url: str | None,
                   lat: float | None, lng: float | None) -> Closure:
    """OPEN/IN_PROGRESS -> PENDING_VERIFICATION (valid evidence) or auto-rejected and reopened (no photo / wrong place).

    Logs CLOSURE_SUBMITTED, then VERIFICATION_REQUESTED or CLOSURE_REJECTED + TASK_REOPENED. 409 otherwise.
    """
    task = _get_task(db, task_id)
    if task.status not in (TASK_OPEN, TASK_IN_PROGRESS):
        raise InvalidTransition(f"task {task_id} is {task.status}; only OPEN or IN_PROGRESS tasks can be closed")
    inc = task.incident
    checks = {
        "photo_present": bool(photo_url),
        "geo_ok": lat is not None and lng is not None
        and haversine_m(lat, lng, inc.lat, inc.lng) <= config.CLOSURE_GEO_TOLERANCE_M,
        "note_present": len((note or "").strip()) >= config.CLOSURE_NOTE_MIN_CHARS,
    }
    closure = Closure(task_id=task.id, note=note or "", photo_url=photo_url, lat=lat, lng=lng, checks=checks)
    db.add(closure)
    db.flush()
    actor = f"dept:{task.department.code}"
    log_event(
        db, "CLOSURE_SUBMITTED", f"{task.department.name} submitted closure for task #{task.id}; checks: {checks}",
        incident_id=inc.id, task_id=task.id, actor=actor, payload={"closure_id": closure.id, "checks": checks},
    )
    failed = [name for name in ("photo_present", "geo_ok") if not checks[name]]
    if failed:
        labels = {"photo_present": "no photo evidence", "geo_ok": "closure location not at the incident"}
        why = ", ".join(labels[f] for f in failed)
        closure.outcome = OUTCOME_REJECTED
        log_event(
            db, "CLOSURE_REJECTED", f"Closure for task #{task.id} rejected automatically: {why}",
            incident_id=inc.id, task_id=task.id, payload={"closure_id": closure.id, "failed_checks": failed},
        )
        escalation.reopen_task(db, task, f"closure evidence invalid: {why}", source="closure_rejected")
        return closure

    task.status = TASK_PENDING_VERIFICATION
    task.verification_deadline = clock.now() + timedelta(hours=config.VERIFY_WINDOW_HOURS)
    reports = db.query(Report).filter_by(incident_id=inc.id).order_by(Report.id).limit(config.MAX_VERIFICATION_REQUESTS).all()
    for r in reports:
        db.add(VerificationRequest(task_id=task.id, closure_id=closure.id, report_id=r.id))
    db.flush()
    log_event(
        db, "VERIFICATION_REQUESTED",
        f"Asked {len(reports)} reporter(s) to confirm the fix for task #{task.id}; "
        f"{config.VERIFY_WINDOW_HOURS}h to respond",
        incident_id=inc.id, task_id=task.id,
        payload={"report_ids": [r.id for r in reports], "verification_deadline": task.verification_deadline.isoformat()},
    )
    return closure


def record_response(db: Session, task_id: int, report_id: int, fixed: bool,
                    comment: str | None = None) -> VerificationRequest:
    """Citizen answers a verification request: 'not fixed' reopens; enough 'fixed' answers close as VERIFIED."""
    task = _get_task(db, task_id)
    if task.status != TASK_PENDING_VERIFICATION:
        raise InvalidTransition(f"task {task_id} is {task.status}; it is not awaiting verification")
    closure = latest_closure(db, task)
    reqs = db.query(VerificationRequest).filter_by(closure_id=closure.id).all()
    req = next((r for r in reqs if r.report_id == report_id), None)
    if req is None:
        raise NotFound(f"report {report_id} was not asked to verify task {task_id}")
    if req.status != "PENDING":
        raise InvalidTransition(f"report {report_id} already responded ({req.status})")
    req.comment, req.responded_at = comment, clock.now()
    if not fixed:
        req.status = VR_NOT_FIXED
        log_event(
            db, "CITIZEN_REJECTED", f"Reporter of report #{report_id} says task #{task.id} is NOT fixed"
            + (f": {comment}" if comment else ""),
            incident_id=task.incident_id, task_id=task.id, actor="citizen", payload={"report_id": report_id},
        )
        escalation.reopen_task(db, task, f"citizen rejected closure: {comment or 'no comment'}", source="citizen")
        return req
    req.status = VR_FIXED
    confirmations = sum(1 for r in reqs if r.status == VR_FIXED)
    needed = max(1, ceil(config.VERIFY_QUORUM_FRACTION * len(reqs)))
    log_event(
        db, "CITIZEN_CONFIRMED",
        f"Reporter of report #{report_id} confirms task #{task.id} is fixed ({confirmations}/{needed} needed)",
        incident_id=task.incident_id, task_id=task.id, actor="citizen", payload={"report_id": report_id},
    )
    if confirmations >= needed and not any(r.status == VR_NOT_FIXED for r in reqs):
        finalize_close(db, task, CONF_VERIFIED, f"{confirmations} of {len(reqs)} reporters confirmed the fix")
    return req


def evaluate_timeout(db: Session, task: Task) -> bool:
    """PENDING_VERIFICATION past its deadline with no rejection -> CLOSED / LOW_CONFIDENCE. Returns True if closed."""
    if task.status != TASK_PENDING_VERIFICATION or task.verification_deadline is None \
            or clock.now() <= task.verification_deadline:
        return False
    finalize_close(db, task, CONF_LOW,
                   f"no citizen response within {config.VERIFY_WINDOW_HOURS}h; closed with low confidence")
    return True


def finalize_close(db: Session, task: Task, confidence: str, reason: str) -> None:
    """PENDING_VERIFICATION -> CLOSED (VERIFIED|LOW_CONFIDENCE); unblock dependents; resolve the incident if done."""
    task.status = TASK_CLOSED
    task.closed_at = clock.now()
    task.closure_confidence = confidence
    closure = latest_closure(db, task)
    if closure is not None:
        closure.outcome = OUTCOME_VERIFIED if confidence == CONF_VERIFIED else OUTCOME_LOW_CONFIDENCE
    log_event(
        db, "TASK_CLOSED", f"Task #{task.id} closed ({confidence}): {reason}",
        incident_id=task.incident_id, task_id=task.id, payload={"confidence": confidence},
    )
    sla.unblock_dependents(db, task)
    inc = task.incident
    db.refresh(inc)
    if all(t.status == TASK_CLOSED for t in inc.tasks):
        inc.status, inc.resolved_at = INCIDENT_RESOLVED, clock.now()
        log_event(db, "INCIDENT_RESOLVED", f"Incident #{inc.id} resolved: all tasks closed",
                  incident_id=inc.id)


def on_post_closure_report(db: Session, incident: Incident, report: Report) -> list[Task]:
    """A new report landed on an incident with a pending/recently closed task: evidence contradicts the closure.

    Logs CONTRADICTION_DETECTED and reopens each affected task (source 'evidence').
    """
    cutoff = clock.now() - timedelta(days=config.POST_CLOSURE_WINDOW_DAYS)
    hit = [t for t in incident.tasks
           if t.status == TASK_PENDING_VERIFICATION
           or (t.status == TASK_CLOSED and t.closed_at is not None and t.closed_at >= cutoff)]
    for task in hit:
        log_event(
            db, "CONTRADICTION_DETECTED",
            f"New report #{report.id} at the same location after closure of task #{task.id} contradicts the closure",
            incident_id=incident.id, task_id=task.id, payload={"report_id": report.id},
        )
        escalation.reopen_task(db, task, f"new report #{report.id} after closure", source="evidence")
    return hit
