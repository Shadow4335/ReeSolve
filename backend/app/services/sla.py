"""SLA engine: task view helper, watchdog (warnings/breaches), pause/resume."""
from datetime import timedelta
from typing import Any

from sqlalchemy.orm import Session

from app import clock, config
from app.models import TASK_BLOCKED, TASK_IN_PROGRESS, TASK_OPEN, TASK_PENDING_VERIFICATION, Task
from app.services import escalation
from app.services.events import log_event


def current_window_hours(task: Task) -> float:
    """Length of the SLA window currently running (re-armed on escalation/reopen)."""
    return task.sla_window_hours or task.base_sla_hours


def sla_remaining_seconds(task: Task) -> float:
    """Seconds until the deadline. Frozen at the pause point for BLOCKED tasks; 0 once not running."""
    if task.status == TASK_BLOCKED:
        ref = task.paused_at or clock.now()
        return (task.sla_deadline - ref).total_seconds()
    if task.status in (TASK_OPEN, TASK_IN_PROGRESS):
        return (task.sla_deadline - clock.now()).total_seconds()
    return 0.0


def sla_state(task: Task) -> str:
    """One of ok | warning | breached | paused (pure read; the watchdog does the writes)."""
    if task.status == TASK_BLOCKED:
        return "paused"
    if task.status not in (TASK_OPEN, TASK_IN_PROGRESS):
        return "ok"
    remaining = sla_remaining_seconds(task)
    if remaining < 0:
        return "breached"
    window_s = current_window_hours(task) * 3600
    if task.warned or remaining <= (1 - config.SLA_WARNING_FRACTION) * window_s:
        return "warning"
    return "ok"


def escalation_level_label(level: int) -> str:
    return config.ESCALATION_LEVELS[max(0, min(level, config.MAX_ESCALATION_LEVEL))]


def task_view(task: Task) -> dict[str, Any]:
    """Derived fields for TaskOut: sla_state, sla_remaining_seconds, escalation_level_label, department."""
    return {
        "sla_state": sla_state(task),
        "sla_remaining_seconds": sla_remaining_seconds(task),
        "escalation_level_label": escalation_level_label(task.escalation_level),
        "department_name": task.department.name,
        "department_code": task.department.code,
        "incident_summary": task.incident.summary,
        "incident_category": task.incident.category,
    }


def unblock_dependents(db: Session, task: Task) -> list[Task]:
    """Upstream task closed: every BLOCKED dependent -> OPEN, deadline extended by the paused time.

    Logs TASK_UNBLOCKED per task.
    """
    freed = []
    for dep in db.query(Task).filter_by(depends_on_task_id=task.id, status=TASK_BLOCKED).all():
        paused = clock.now() - (dep.paused_at or clock.now())
        dep.sla_deadline = dep.sla_deadline + paused
        dep.paused_at = None
        dep.status = TASK_OPEN
        log_event(
            db, "TASK_UNBLOCKED",
            f"Task #{dep.id} ({dep.department.name}) unblocked: task #{task.id} ({task.department.name}) is closed. "
            f"SLA clock resumed after {paused.total_seconds() / 3600:.1f}h pause.",
            incident_id=dep.incident_id, task_id=dep.id, payload={"paused_seconds": paused.total_seconds()},
        )
        freed.append(dep)
    return freed


def run_watchdog(db: Session) -> None:
    """Scan active tasks: 80% elapsed -> SLA_WARNING (once per window); past deadline -> SLA_BREACHED + escalate;
    PENDING_VERIFICATION past its deadline -> verification timeout.

    BLOCKED tasks are paused and never breach. One breach per task per run. Caller commits.
    """
    t = clock.now()
    for task in db.query(Task).filter(Task.status.in_((TASK_OPEN, TASK_IN_PROGRESS))).all():
        window = timedelta(hours=current_window_hours(task))
        remaining = task.sla_deadline - t
        if not task.warned and remaining <= (1 - config.SLA_WARNING_FRACTION) * window:
            task.warned = True
            log_event(
                db, "SLA_WARNING",
                f"Task #{task.id} ({task.department.name}) has used {config.SLA_WARNING_FRACTION:.0%} of its "
                f"{window.total_seconds() / 3600:g}h SLA window; deadline {task.sla_deadline:%Y-%m-%d %H:%M}",
                incident_id=task.incident_id, task_id=task.id,
                payload={"deadline": task.sla_deadline.isoformat()},
            )
        if remaining.total_seconds() < 0:
            late_h = -remaining.total_seconds() / 3600
            task.breach_count += 1
            reason = f"SLA breached by {late_h:.1f} hours"
            log_event(
                db, "SLA_BREACHED", f"Task #{task.id} ({task.department.name}): {reason}",
                incident_id=task.incident_id, task_id=task.id,
                payload={"late_hours": round(late_h, 2), "breach_count": task.breach_count},
            )
            escalation.escalate(db, task, reason)

    from app.services import verification  # lazy: verification imports this module

    for task in db.query(Task).filter(Task.status == TASK_PENDING_VERIFICATION).all():
        verification.evaluate_timeout(db, task)
