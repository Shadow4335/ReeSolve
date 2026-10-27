"""The whole report pipeline in one call (shared by the API, tests and the seed script)."""
from typing import Any

from sqlalchemy.orm import Session

from app.models import Incident, Report
from app.services import dedup, intake, routing
from app.services.events import log_event


def submit_report(
    db: Session,
    text: str,
    lat: float,
    lng: float,
    photo_url: str | None = None,
    reporter_name: str | None = None,
    reporter_contact: str | None = None,
) -> dict[str, Any]:
    """Create a Report and (M2) a new Incident for it. Logs REPORT_RECEIVED + INCIDENT_CREATED."""
    s = intake.structure_report(text)
    report = Report(
        text=text, summary=s["summary"], category=s["category"], severity=s["severity"],
        lat=lat, lng=lng, photo_url=photo_url,
        reporter_name=reporter_name, reporter_contact=reporter_contact,
    )
    db.add(report)
    db.flush()
    received = log_event(
        db, "REPORT_RECEIVED",
        f"Report #{report.id} received: classified as {report.category}, severity {report.severity}",
        actor="citizen", payload={"report_id": report.id, "category": report.category},
    )

    decision = dedup.resolve_report(db, report)
    zone = routing.in_vulnerable_zone(db, lat, lng)
    incident = Incident(
        category=report.category, summary=report.summary, lat=lat, lng=lng,
        severity_max=report.severity, report_count=1, in_vulnerable_zone=zone,
        priority=routing.compute_priority(report.severity, 1, zone),
    )
    db.add(incident)
    db.flush()
    report.incident_id = incident.id
    report.dedup_explanation = decision["explanation"]
    received.incident_id = incident.id
    log_event(
        db, "INCIDENT_CREATED",
        f"New incident #{incident.id} ({incident.category}, priority {incident.priority}) from report #{report.id}",
        incident_id=incident.id, payload={"report_id": report.id},
    )
    return {
        "report": report,
        "incident": incident,
        "decision": decision["decision"],
        "explanation": decision["explanation"],
        "cluster": None,
    }
