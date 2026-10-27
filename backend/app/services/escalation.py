"""Escalation ladder (CONTEXT 6.6). reopen_task is added in M6."""
from datetime import timedelta

from sqlalchemy.orm import Session

from app import clock, config
from app.models import Task
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
