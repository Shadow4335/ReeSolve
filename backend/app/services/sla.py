"""SLA engine. M1 provides the task view helper; the watchdog is added in M5."""
from typing import Any

from app import clock, config
from app.models import TASK_BLOCKED, TASK_IN_PROGRESS, TASK_OPEN, Task


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
