"""SQLAlchemy models (CONTEXT.md section 5). Timestamps are naive UTC from clock.now()."""
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app import clock

# Status / enum values (stored as plain strings)
INCIDENT_OPEN, INCIDENT_RESOLVED = "OPEN", "RESOLVED"
TASK_BLOCKED, TASK_OPEN, TASK_IN_PROGRESS = "BLOCKED", "OPEN", "IN_PROGRESS"
TASK_PENDING_VERIFICATION, TASK_CLOSED = "PENDING_VERIFICATION", "CLOSED"
CONF_VERIFIED, CONF_LOW = "VERIFIED", "LOW_CONFIDENCE"
OUTCOME_PENDING, OUTCOME_VERIFIED, OUTCOME_REJECTED = "PENDING", "VERIFIED", "REJECTED"
OUTCOME_CONTRADICTED, OUTCOME_LOW_CONFIDENCE = "CONTRADICTED", "LOW_CONFIDENCE"
VR_PENDING, VR_FIXED, VR_NOT_FIXED = "PENDING", "FIXED", "NOT_FIXED"

EVENT_TYPES = [
    "REPORT_RECEIVED", "INCIDENT_CREATED", "DUPLICATE_MERGED", "RELATED_LINKED", "TASK_CREATED",
    "TASK_BLOCKED", "TASK_UNBLOCKED", "PRIORITY_RAISED", "TASK_STARTED", "SLA_WARNING",
    "SLA_BREACHED", "ESCALATED", "CLOSURE_SUBMITTED", "CLOSURE_REJECTED", "VERIFICATION_REQUESTED",
    "CITIZEN_CONFIRMED", "CITIZEN_REJECTED", "CONTRADICTION_DETECTED", "TASK_REOPENED",
    "TASK_CLOSED", "INCIDENT_RESOLVED", "CLOCK_ADVANCED",
]


class Base(DeclarativeBase):
    pass


class Department(Base):
    __tablename__ = "departments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(10), unique=True)


class VulnerableZone(Base):
    __tablename__ = "vulnerable_zones"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    radius_m: Mapped[float] = mapped_column(Float)


class Cluster(Base):
    __tablename__ = "clusters"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200))
    coordination_note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)

    incidents: Mapped[list["Incident"]] = relationship(back_populates="cluster")


class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(30))
    summary: Mapped[str] = mapped_column(String(300))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    priority: Mapped[str] = mapped_column(String(10), default="MEDIUM")
    severity_max: Mapped[int] = mapped_column(Integer, default=3)
    report_count: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(10), default=INCIDENT_OPEN)
    cluster_id: Mapped[int | None] = mapped_column(ForeignKey("clusters.id"), nullable=True)
    in_vulnerable_zone: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    cluster: Mapped[Cluster | None] = relationship(back_populates="incidents")
    reports: Mapped[list["Report"]] = relationship(back_populates="incident")
    tasks: Mapped[list["Task"]] = relationship(back_populates="incident")


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    text: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(String(300))
    category: Mapped[str] = mapped_column(String(30))
    severity: Mapped[int] = mapped_column(Integer, default=3)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reporter_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reporter_contact: Mapped[str | None] = mapped_column(String(100), nullable=True)
    incident_id: Mapped[int | None] = mapped_column(ForeignKey("incidents.id"), nullable=True)
    dedup_explanation: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)

    incident: Mapped[Incident | None] = relationship(back_populates="reports")


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    status: Mapped[str] = mapped_column(String(25), default=TASK_OPEN)
    priority: Mapped[str] = mapped_column(String(10), default="MEDIUM")
    base_sla_hours: Mapped[float] = mapped_column(Float)
    sla_deadline: Mapped[datetime] = mapped_column(DateTime)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    warned: Mapped[bool] = mapped_column(Boolean, default=False)
    breach_count: Mapped[int] = mapped_column(Integer, default=0)
    escalation_level: Mapped[int] = mapped_column(Integer, default=0)
    reopen_count: Mapped[int] = mapped_column(Integer, default=0)
    depends_on_task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    closure_confidence: Mapped[str | None] = mapped_column(String(20), nullable=True)
    verification_deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_lead: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Length of the current SLA window in hours; lets the watchdog compute the 80% warning point
    # after escalations/reopens re-arm the deadline (see DECISIONS.md).
    sla_window_hours: Mapped[float] = mapped_column(Float, default=0.0)

    incident: Mapped[Incident] = relationship(back_populates="tasks")
    department: Mapped[Department] = relationship()
    closures: Mapped[list["Closure"]] = relationship(back_populates="task")


class Closure(Base):
    __tablename__ = "closures"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"))
    note: Mapped[str] = mapped_column(Text, default="")
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)
    checks: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    outcome: Mapped[str] = mapped_column(String(20), default=OUTCOME_PENDING)

    task: Mapped[Task] = relationship(back_populates="closures")


class VerificationRequest(Base):
    __tablename__ = "verification_requests"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"))
    closure_id: Mapped[int] = mapped_column(ForeignKey("closures.id"))
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id"))
    status: Mapped[str] = mapped_column(String(10), default=VR_PENDING)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=clock.now, index=True)
    type: Mapped[str] = mapped_column(String(40))
    incident_id: Mapped[int | None] = mapped_column(ForeignKey("incidents.id"), nullable=True, index=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True, index=True)
    actor: Mapped[str] = mapped_column(String(30), default="system")
    reason: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String(200))
