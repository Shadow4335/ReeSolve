"""Read-side GET routes (Teammate 1 contract, CONTEXT.md §9.2).

Exposes a FastAPI router that the main dev wires in via::

    app.include_router(queries.router, prefix="/api")

Endpoints:
    GET /incidents          – filtered list of IncidentOut
    GET /incidents/{id}     – IncidentDetailOut (404 if unknown)
    GET /clusters/{id}      – ClusterOut with member incidents (404 if unknown)
    GET /tasks              – TaskOut list, sorted by SLA remaining ascending
    GET /events             – EventOut list, ordered by id (supports pagination)

All response shapes come from app.schemas; SLA-derived fields always delegate
to TaskOut.from_task() so that sla_state/sla_remaining_seconds are never
recomputed here (rule 11).
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Cluster, Event, Incident, Task
from app.schemas import (
    ClusterOut,
    EventOut,
    IncidentDetailOut,
    IncidentOut,
    TaskOut,
)
from app.services.errors import NotFound

router = APIRouter()


# ---------------------------------------------------------------------------
# /incidents
# ---------------------------------------------------------------------------


@router.get("/incidents", response_model=list[IncidentOut])
def list_incidents(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    cluster_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
) -> list[Incident]:
    """Return incidents filtered by any combination of status, category, department, cluster_id."""
    q = db.query(Incident)
    if status:
        q = q.filter(Incident.status == status)
    if category:
        q = q.filter(Incident.category == category)
    if cluster_id is not None:
        q = q.filter(Incident.cluster_id == cluster_id)
    if department:
        # Filter via tasks → department code
        q = q.join(Incident.tasks).join(Task.department).filter_by(code=department)
    return q.all()


@router.get("/incidents/{incident_id}", response_model=IncidentDetailOut)
def get_incident(incident_id: int, db: Session = Depends(get_db)) -> IncidentDetailOut:
    """Return a single incident with full detail (reports, tasks, cluster, event timeline).

    Raises 404 if the incident does not exist.
    """
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise NotFound(f"incident {incident_id} not found")

    events = (
        db.query(Event)
        .filter(Event.incident_id == incident_id)
        .order_by(Event.id)
        .all()
    )

    tasks_out = [TaskOut.from_task(t) for t in incident.tasks]

    return IncidentDetailOut(
        **IncidentOut.model_validate(incident).model_dump(),
        reports=incident.reports,
        tasks=tasks_out,
        cluster=incident.cluster,
        events=events,
    )


# ---------------------------------------------------------------------------
# /clusters
# ---------------------------------------------------------------------------


@router.get("/clusters/{cluster_id}", response_model=ClusterOut)
def get_cluster(cluster_id: int, db: Session = Depends(get_db)) -> ClusterOut:
    """Return a cluster with its member incidents.

    Raises 404 if the cluster does not exist.
    """
    cluster = db.get(Cluster, cluster_id)
    if cluster is None:
        raise NotFound(f"cluster {cluster_id} not found")
    return cluster


# ---------------------------------------------------------------------------
# /tasks
# ---------------------------------------------------------------------------


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> list[TaskOut]:
    """Return tasks filtered by department code and/or status.

    Results are sorted by SLA time remaining ascending (most urgent first),
    as required by the contract. SLA fields are always derived via
    TaskOut.from_task() to honour rule 11.
    """
    q = db.query(Task)
    if status:
        q = q.filter(Task.status == status)
    if department:
        q = q.join(Task.department).filter_by(code=department)

    tasks = q.all()
    task_outs = [TaskOut.from_task(t) for t in tasks]
    # Sort by SLA remaining ascending so the most urgent tasks appear first.
    task_outs.sort(key=lambda t: t.sla_remaining_seconds)
    return task_outs


# ---------------------------------------------------------------------------
# /events
# ---------------------------------------------------------------------------


@router.get("/events", response_model=list[EventOut])
def list_events(
    incident_id: Optional[int] = Query(None),
    task_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    since_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
) -> list[Event]:
    """Return events ordered by id, supporting timeline and live-feed pagination.

    Filters:
        incident_id – only events linked to this incident
        task_id     – only events linked to this task
        since_id    – only events with id > since_id (for polling)
        limit       – maximum number of results (default 100, max 1000)
    """
    q = db.query(Event).order_by(Event.id)
    if incident_id is not None:
        q = q.filter(Event.incident_id == incident_id)
    if task_id is not None:
        q = q.filter(Event.task_id == task_id)
    if since_id is not None:
        q = q.filter(Event.id > since_id)
    return q.limit(limit).all()
