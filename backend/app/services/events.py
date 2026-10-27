"""Audit log. Every state change calls log_event in the same transaction."""
from typing import Any

from sqlalchemy.orm import Session

from app import clock
from app.models import EVENT_TYPES, Event


def log_event(
    db: Session,
    type: str,
    reason: str,
    *,
    incident_id: int | None = None,
    task_id: int | None = None,
    actor: str = "system",
    payload: dict[str, Any] | None = None,
) -> Event:
    """Append an Event row (flushed, not committed). Reason must be human-readable."""
    if type not in EVENT_TYPES:
        raise ValueError(f"unknown event type {type!r}")
    if not reason or not reason.strip():
        raise ValueError("events require a non-empty reason")
    ev = Event(
        ts=clock.now(),
        type=type,
        incident_id=incident_id,
        task_id=task_id,
        actor=actor,
        reason=reason,
        payload=payload or {},
    )
    db.add(ev)
    db.flush()
    return ev
