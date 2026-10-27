"""Read-side GET endpoints (CONTEXT 9.2). FALLBACK written by the main dev; see DECISIONS.md."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Cluster, Department, Event, Incident, Task
from app.schemas import ClusterOut, EventOut, IncidentDetailOut, IncidentOut, TaskOut
from app.services.errors import NotFound

router = APIRouter()
_ACTIVE = ("BLOCKED", "OPEN", "IN_PROGRESS")


@router.get("/incidents", response_model=list[IncidentOut])
def list_incidents(status: str | None = None, category: str | None = None, department: str | None = None,
                   cluster_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Incident)
    if status:
        q = q.filter(Incident.status == status.upper())
    if category:
        q = q.filter(Incident.category == category)
    if cluster_id is not None:
        q = q.filter(Incident.cluster_id == cluster_id)
    if department:
        q = q.filter(Incident.tasks.any(Task.department.has(Department.code == department.upper())))
    return q.order_by(Incident.id).all()


@router.get("/incidents/{incident_id}", response_model=IncidentDetailOut)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    inc = db.get(Incident, incident_id)
    if inc is None:
        raise NotFound(f"incident {incident_id} not found")
    events = db.query(Event).filter_by(incident_id=inc.id).order_by(Event.id).all()
    return IncidentDetailOut(
        **IncidentOut.model_validate(inc).model_dump(),
        reports=sorted(inc.reports, key=lambda r: r.id),
        tasks=[TaskOut.from_task(t) for t in sorted(inc.tasks, key=lambda t: t.id)],
        cluster=ClusterOut.model_validate(inc.cluster) if inc.cluster else None,
        events=events,
    )


@router.get("/clusters/{cluster_id}", response_model=ClusterOut)
def get_cluster(cluster_id: int, db: Session = Depends(get_db)):
    cluster = db.get(Cluster, cluster_id)
    if cluster is None:
        raise NotFound(f"cluster {cluster_id} not found")
    return cluster


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(department: str | None = None, status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Task)
    if department:
        q = q.filter(Task.department.has(Department.code == department.upper()))
    if status:
        q = q.filter(Task.status == status.upper())
    out = [TaskOut.from_task(t) for t in q.all()]
    # most urgent first: running clocks by remaining time ascending, finished tasks last
    out.sort(key=lambda t: (t.status not in _ACTIVE, t.sla_remaining_seconds, t.id))
    return out


@router.get("/events", response_model=list[EventOut])
def list_events(incident_id: int | None = None, task_id: int | None = None, limit: int | None = None,
                since_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Event)
    if incident_id is not None:
        q = q.filter(Event.incident_id == incident_id)
    if task_id is not None:
        q = q.filter(Event.task_id == task_id)
    if since_id is not None:
        q = q.filter(Event.id > since_id).order_by(Event.id)
        return (q.limit(limit) if limit else q).all()
    if limit:  # latest N, returned oldest-first
        return list(reversed(q.order_by(Event.id.desc()).limit(limit).all()))
    return q.order_by(Event.id).all()
