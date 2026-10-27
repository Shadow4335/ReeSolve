"""Pydantic request/response shapes. Shared shapes (TaskOut etc.) are consumed by the read-side router."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models import Task
from app.services import sla


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- requests ----------
class ReportIn(BaseModel):
    text: str = Field(min_length=3)
    lat: float
    lng: float
    photo_url: str | None = None
    reporter_name: str | None = None
    reporter_contact: str | None = None


class ClosureIn(BaseModel):
    note: str = ""
    photo_url: str | None = None
    lat: float | None = None
    lng: float | None = None


class VerifyResponseIn(BaseModel):
    report_id: int
    fixed: bool
    comment: str | None = None


class ClockAdvanceIn(BaseModel):
    hours: float = Field(gt=0)


# ---------- shared output shapes ----------
class ReportOut(ORM):
    id: int
    text: str
    summary: str
    category: str
    severity: int
    lat: float
    lng: float
    photo_url: str | None
    reporter_name: str | None
    incident_id: int | None
    dedup_explanation: dict[str, Any] | None
    created_at: datetime


class IncidentOut(ORM):
    id: int
    category: str
    summary: str
    lat: float
    lng: float
    priority: str
    severity_max: int
    report_count: int
    status: str
    cluster_id: int | None
    in_vulnerable_zone: bool
    created_at: datetime
    resolved_at: datetime | None


class TaskOut(ORM):
    id: int
    incident_id: int
    department_id: int
    department_name: str
    department_code: str
    incident_summary: str
    incident_category: str
    status: str
    priority: str
    base_sla_hours: float
    sla_deadline: datetime
    paused_at: datetime | None
    warned: bool
    breach_count: int
    escalation_level: int
    escalation_level_label: str
    reopen_count: int
    depends_on_task_id: int | None
    closure_confidence: str | None
    verification_deadline: datetime | None
    is_lead: bool
    created_at: datetime
    closed_at: datetime | None
    sla_state: str            # ok | warning | breached | paused
    sla_remaining_seconds: float

    @classmethod
    def from_task(cls, task: Task) -> "TaskOut":
        """Build a TaskOut; derived SLA fields always come from sla.task_view (rule 11)."""
        base = {k: getattr(task, k) for k in cls.model_fields if hasattr(task, k)}
        return cls(**{**base, **sla.task_view(task)})


class EventOut(ORM):
    id: int
    ts: datetime
    type: str
    incident_id: int | None
    task_id: int | None
    actor: str
    reason: str
    payload: dict[str, Any]


class ClusterOut(ORM):
    id: int
    title: str
    coordination_note: str
    created_at: datetime
    incidents: list[IncidentOut] = []


class IncidentDetailOut(IncidentOut):
    reports: list[ReportOut] = []
    tasks: list[TaskOut] = []
    cluster: ClusterOut | None = None
    events: list[EventOut] = []


class ReportResultOut(BaseModel):
    """Response of POST /reports (the submit_report return value)."""
    report: ReportOut
    incident: IncidentOut
    decision: str                       # new | duplicate
    explanation: dict[str, Any] | None
    cluster: ClusterOut | None = None


class ClockOut(BaseModel):
    now: datetime
    offset_seconds: float
