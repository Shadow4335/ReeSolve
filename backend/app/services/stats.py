"""Aggregate numbers for the admin dashboard (read-only)."""
from typing import Any

from sqlalchemy.orm import Session

from app import config
from app.services import sla
from app.models import (
    CONF_LOW, INCIDENT_RESOLVED, TASK_CLOSED, Department, Event, Incident, Task,
)


def _pct(num: int, den: int) -> float | None:
    return round(100 * num / den, 1) if den else None


def compute_stats(db: Session) -> dict[str, Any]:
    """SLA compliance and reopen rate per department, escalations by level, resolution time, totals."""
    tasks = db.query(Task).all()
    by_dept = []
    for dept in db.query(Department).order_by(Department.id):
        mine = [t for t in tasks if t.department_id == dept.id]
        total = len(mine)
        by_dept.append({
            "code": dept.code, "name": dept.name, "total_tasks": total,
            "open_tasks": sum(1 for t in mine if t.status != TASK_CLOSED),
            "breached_tasks": sum(1 for t in mine if t.breach_count > 0),
            "sla_compliance_pct": _pct(sum(1 for t in mine if t.breach_count == 0), total),
            "reopened_tasks": sum(1 for t in mine if t.reopen_count > 0),
            "reopen_rate_pct": _pct(sum(1 for t in mine if t.reopen_count > 0), total),
        })
    levels = {name: 0 for name in config.ESCALATION_LEVELS[1:]}
    for ev in db.query(Event).filter_by(type="ESCALATED"):
        levels[ev.payload.get("to_role", config.ESCALATION_LEVELS[-1])] += 1
    resolved = db.query(Incident).filter_by(status=INCIDENT_RESOLVED).all()
    hours = [(i.resolved_at - i.created_at).total_seconds() / 3600 for i in resolved if i.resolved_at]
    return {
        "by_department": by_dept,
        "escalations_by_level": levels,
        "avg_resolution_hours": round(sum(hours) / len(hours), 1) if hours else None,
        "totals": {
            "incidents": db.query(Incident).count(),
            "open_incidents": db.query(Incident).filter(Incident.status != INCIDENT_RESOLVED).count(),
            "resolved_incidents": len(resolved),
            "tasks": len(tasks),
            "open_tasks": sum(1 for t in tasks if t.status != TASK_CLOSED),
            "currently_breached": sum(1 for t in tasks if sla.sla_state(t) == "breached"),
            "low_confidence_closures": sum(1 for t in tasks if t.closure_confidence == CONF_LOW),
            "reopens": sum(t.reopen_count for t in tasks),
        },
    }
