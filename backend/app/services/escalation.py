"""Escalation ladder and reopen (CONTEXT 6.6)."""
from datetime import timedelta

from sqlalchemy.orm import Session

from app import clock, config
from app.models import (
    INCIDENT_OPEN, OUTCOME_CONTRADICTED, TASK_CLOSED, TASK_IN_PROGRESS, TASK_OPEN, TASK_PENDING_VERIFICATION,
    Closure, Task,
)
from app.services.errors import InvalidTransition
from app.services.events import log_event


def escalate(db: Session, task: Task, reason: str, actor: str = "system") -> int:
    """Raise escalation_level by one (cap 3) and re-arm the SLA window. Logs ESCALATED. Returns new level."""
    from_level = task.escalation_level
    to_level = min(from_level + 1, config.MAX_ESCALATION_LEVEL)
    top = from_level == config.MAX_ESCALATION_LEVEL
    task.escalation_level = to_level
    window = config.ESCALATION_INTERVAL_FRACTION * task.base_sla_hours
    task.sla_window_hours = window
    task.sla_deadline = clock.now() + timedelta(hours=window)
    task.warned = False
    role = config.ESCALATION_LEVELS[to_level]
    text = f"{reason}; already at top level — flagged for commissioner review" if top \
        else f"{reason}; escalated to {role}"
    log_event(
        db, "ESCALATED", f"Task #{task.id}: {text}. SLA re-armed for {window:g}h.",
        incident_id=task.incident_id, task_id=task.id, actor=actor,
        payload={"from_level": from_level, "to_level": to_level, "to_role": role},
    )
    return to_level


def reopen_task(db: Session, task: Task, reason: str, source: str) -> Task:
    """PENDING_VERIFICATION/CLOSED -> OPEN with a shorter SLA; reopen_count += 1. Logs TASK_REOPENED.

    source: 'citizen' | 'evidence' | 'closure_rejected' (the last also allows OPEN/IN_PROGRESS tasks, since an
    invalid closure is rejected before the task ever reached PENDING_VERIFICATION). At reopen_count >= 2
    the task is force-escalated to at least level 2.
    """
    allowed = {TASK_PENDING_VERIFICATION, TASK_CLOSED}
    if source == "closure_rejected":
        allowed |= {TASK_OPEN, TASK_IN_PROGRESS}
    if task.status not in allowed:
        raise InvalidTransition(f"task {task.id} is {task.status} and cannot be reopened")
    task.status = TASK_OPEN
    task.reopen_count += 1
    task.closed_at = None
    task.closure_confidence = None
    task.verification_deadline = None
    window = config.REOPEN_SLA_FRACTION * task.base_sla_hours
    task.sla_window_hours = window
    task.sla_deadline = clock.now() + timedelta(hours=window)
    task.warned = False
    task.incident.status = INCIDENT_OPEN
    task.incident.resolved_at = None
    closure = db.query(Closure).filter_by(task_id=task.id).order_by(Closure.id.desc()).first()
    if closure is not None and source != "closure_rejected":
        closure.outcome = OUTCOME_CONTRADICTED
    log_event(
        db, "TASK_REOPENED",
        f"Task #{task.id} reopened (#{task.reopen_count}): {reason}. New SLA {window:g}h.",
        incident_id=task.incident_id, task_id=task.id, actor="citizen" if source == "citizen" else "system",
        payload={"reopen_count": task.reopen_count, "source": source},
    )
    if task.reopen_count >= config.REPEATED_REOPEN_THRESHOLD:
        while task.escalation_level < config.REPEATED_REOPEN_MIN_LEVEL:
            escalate(db, task, f"repeated failed closure (reopened {task.reopen_count} times)")
    return task
