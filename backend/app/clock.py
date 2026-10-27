"""Simulated clock. The only place that touches the real wall clock (golden rule 1)."""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

_offset_seconds: float = 0.0
_SETTINGS_KEY = "clock_offset_seconds"


def _real_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def now() -> datetime:
    """Return the simulated time as naive UTC."""
    return _real_now() + timedelta(seconds=_offset_seconds)


def offset_seconds() -> float:
    return _offset_seconds


def advance(hours: float, db: Session | None = None) -> None:
    """Move the simulated clock forward; persist the offset if a session is given."""
    global _offset_seconds
    _offset_seconds += hours * 3600
    _persist(db)


def reset(db: Session | None = None) -> None:
    """Reset the offset to zero."""
    global _offset_seconds
    _offset_seconds = 0.0
    _persist(db)


def load(db: Session) -> None:
    """Restore the offset from the settings table (called at startup)."""
    from app.models import Setting

    global _offset_seconds
    row = db.get(Setting, _SETTINGS_KEY)
    _offset_seconds = float(row.value) if row else 0.0


def _persist(db: Session | None) -> None:
    if db is None:
        return
    from app.models import Setting

    row = db.get(Setting, _SETTINGS_KEY)
    if row is None:
        db.add(Setting(key=_SETTINGS_KEY, value=str(_offset_seconds)))
    else:
        row.value = str(_offset_seconds)
