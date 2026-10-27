"""Duplicate / related detection. M2 stub: every report is a new incident (real logic in M3)."""
from typing import Any

from sqlalchemy.orm import Session

from app.models import Report


def resolve_report(db: Session, report: Report) -> dict[str, Any]:
    """Decide how a report relates to existing incidents. Stub: always {'decision': 'new'}."""
    return {
        "decision": "new",
        "incident": None,
        "explanation": {"decision": "new", "rule": "no_duplicate_found"},
    }
