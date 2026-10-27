"""Routing: priority, task creation, SLA assignment, dependencies, start (CONTEXT 6.4)."""
from datetime import timedelta

from sqlalchemy.orm import Session

from app import clock, config
from app.geo import haversine_m
from app.models import (
    TASK_BLOCKED, TASK_CLOSED, TASK_IN_PROGRESS, TASK_OPEN, Department, Incident, Task, VulnerableZone,
)
from app.services.errors import InvalidTransition, NotFound
from app.services.events import log_event

ACTIVE = (TASK_BLOCKED, TASK_OPEN, TASK_IN_PROGRESS)


def in_vulnerable_zone(db: Session, lat: float, lng: float) -> bool:
    """True if the point lies within any vulnerable zone's radius."""
    return any(haversine_m(lat, lng, z.lat, z.lng) <= z.radius_m for z in db.query(VulnerableZone))


def compute_priority(severity: int, report_count: int, in_zone: bool) -> str:
    """score = severity*2 + min(report_count, cap) + zone bonus -> CRITICAL/HIGH/MEDIUM/LOW."""
    score = severity * 2 + min(report_count, config.REPORT_COUNT_CAP)
    score += config.VULNERABLE_ZONE_BONUS if in_zone else 0
    for name, threshold in config.PRIORITY_THRESHOLDS:
        if score >= threshold:
            return name
    return "LOW"


def sla_hours(category: str, priority: str) -> float:
    """Base SLA window = category base hours x priority multiplier."""
    return config.BASE_SLA_HOURS[category] * config.PRIORITY_MULTIPLIER[priority]


def create_primary_task(db: Session, incident: Incident) -> Task:
    """New incident -> OPEN task for the owning department with priority-based SLA. Logs TASK_CREATED."""
    dept = db.query(Department).filter_by(code=config.CATEGORY_TO_DEPT[incident.category]).one()
    hours = sla_hours(incident.category, incident.priority)
    t = clock.now()
    task = Task(
        incident_id=incident.id, department_id=dept.id, status=TASK_OPEN, priority=incident.priority,
        base_sla_hours=hours, sla_window_hours=hours, sla_deadline=t + timedelta(hours=hours), created_at=t,
    )
    db.add(task)
    db.flush()
    db.refresh(incident)
    log_event(
        db, "TASK_CREATED",
        f"Task #{task.id} assigned to {dept.name}: {incident.priority} priority, SLA {hours:g}h "
        f"(deadline {task.sla_deadline:%Y-%m-%d %H:%M})",
        incident_id=incident.id, task_id=task.id,
        payload={"department": dept.code, "priority": incident.priority, "sla_hours": hours},
    )
    return task


def primary_task(incident: Incident) -> Task | None:
    """The incident's (single, in the MVP) task."""
    return incident.tasks[0] if incident.tasks else None


def recompute_priority(db: Session, incident: Incident) -> bool:
    """After a merge: recompute incident priority; if it rose, log PRIORITY_RAISED and shorten SLAs.

    Deadline may only get shorter: min(old, created_at + new_sla). Tasks that already breached or
    were reopened keep their re-armed deadline (only priority/base hours update).
    """
    new = compute_priority(incident.severity_max, incident.report_count, incident.in_vulnerable_zone)
    old = incident.priority
    if config.PRIORITY_ORDER.index(new) <= config.PRIORITY_ORDER.index(old):
        return False
    incident.priority = new
    changed = []
    for task in incident.tasks:
        if task.status not in ACTIVE:
            continue
        task.priority = new
        task.base_sla_hours = sla_hours(incident.category, new)
        if task.breach_count == 0 and task.reopen_count == 0:
            task.sla_deadline = min(task.sla_deadline, task.created_at + timedelta(hours=task.base_sla_hours))
            task.sla_window_hours = task.base_sla_hours
        changed.append({"task_id": task.id, "sla_deadline": task.sla_deadline.isoformat()})
    log_event(
        db, "PRIORITY_RAISED",
        f"Priority raised {old} -> {new} ({incident.report_count} reports, severity {incident.severity_max}); "
        f"SLA deadline tightened",
        incident_id=incident.id, payload={"from": old, "to": new, "tasks": changed},
    )
    return True


def apply_dependency(db: Session, upstream: Task, downstream: Task, reason: str) -> bool:
    """Block `downstream` behind `upstream` (clock paused, upstream becomes lead). Returns True if applied.

    Skipped if downstream is not OPEN, already depends on something, upstream is already CLOSED,
    or the link would create a cycle.
    """
    if downstream.status != TASK_OPEN or downstream.depends_on_task_id is not None:
        return False
    if upstream.status == TASK_CLOSED or upstream.id == downstream.id:
        return False
    node: Task | None = upstream
    while node is not None:  # cycle check: walk upstream's dependency chain
        if node.id == downstream.id:
            return False
        node = db.get(Task, node.depends_on_task_id) if node.depends_on_task_id else None
    downstream.depends_on_task_id = upstream.id
    downstream.status = TASK_BLOCKED
    downstream.paused_at = clock.now()
    upstream.is_lead = True
    log_event(
        db, "TASK_BLOCKED",
        f"Task #{downstream.id} ({downstream.department.name}) blocked until task #{upstream.id} "
        f"({upstream.department.name}) closes: {reason}. SLA clock paused.",
        incident_id=downstream.incident_id, task_id=downstream.id,
        payload={"depends_on_task_id": upstream.id},
    )
    return True


def start_task(db: Session, task_id: int) -> Task:
    """OPEN -> IN_PROGRESS. 404 if unknown; 409 if BLOCKED or not OPEN. Logs TASK_STARTED."""
    task = db.get(Task, task_id)
    if task is None:
        raise NotFound(f"task {task_id} not found")
    if task.status == TASK_BLOCKED:
        raise InvalidTransition(
            f"task {task_id} is BLOCKED waiting for task {task.depends_on_task_id}; it cannot be started yet")
    if task.status != TASK_OPEN:
        raise InvalidTransition(f"task {task_id} is {task.status}; only OPEN tasks can be started")
    task.status = TASK_IN_PROGRESS
    log_event(
        db, "TASK_STARTED", f"{task.department.name} started work on task #{task.id}",
        incident_id=task.incident_id, task_id=task.id, actor=f"dept:{task.department.code}",
    )
    return task
