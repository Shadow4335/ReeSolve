"""The whole report pipeline in one call (shared by the API, tests and the seed script)."""
from typing import Any

from sqlalchemy.orm import Session

from app.models import Incident, Report
from app.services import clusters, dedup, intake, routing, verification
from app.services.events import log_event


def submit_report(
    db: Session,
    text: str,
    lat: float,
    lng: float,
    photo_url: str | None = None,
    reporter_name: str | None = None,
    reporter_contact: str | None = None,
    category_hint: str | None = None,
) -> dict[str, Any]:
    """Create a Report, then merge it into a duplicate incident or open a new one with a task; link related clusters.

    Logs REPORT_RECEIVED, then DUPLICATE_MERGED (+PRIORITY_RAISED, +CONTRADICTION_DETECTED/TASK_REOPENED after closure) or INCIDENT_CREATED + TASK_CREATED, then RELATED_LINKED (+TASK_BLOCKED).
    """
    s = intake.structure_report(text)
    s["category"] = intake.apply_category_hint(s["category"], category_hint)
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

    res = dedup.resolve_report(db, report)
    if res["decision"] == "duplicate":
        incident = res["incident"]
        expl = res["explanation"]
        incident.report_count += 1
        incident.severity_max = max(incident.severity_max, report.severity)
        report.incident_id = incident.id
        received.incident_id = incident.id
        log_event(
            db, "DUPLICATE_MERGED",
            f"Report #{report.id} merged into incident #{incident.id}: {expl['distance_m']}m away, "
            f"text similarity {expl['text_similarity']}, score {expl['score']} ({expl['rule']})",
            incident_id=incident.id, payload={**expl, "report_id": report.id},
        )
        routing.recompute_priority(db, incident)
        verification.on_post_closure_report(db, incident, report)
    else:
        zone = routing.in_vulnerable_zone(db, lat, lng)
        incident = Incident(
            category=report.category, summary=report.summary, lat=lat, lng=lng,
            severity_max=report.severity, report_count=1, in_vulnerable_zone=zone,
            priority=routing.compute_priority(report.severity, 1, zone),
        )
        db.add(incident)
        db.flush()
        report.incident_id = incident.id
        received.incident_id = incident.id
        log_event(
            db, "INCIDENT_CREATED",
            f"New incident #{incident.id} ({incident.category}, priority {incident.priority}) from report #{report.id}",
            incident_id=incident.id, payload={"report_id": report.id},
        )
        routing.create_primary_task(db, incident)
    report.dedup_explanation = res["explanation"]

    for rel in res["related"]:
        clusters.link_related(
            db, incident, rel["incident"], rel["upstream"], rel["downstream"],
            rel["explanation"]["blocks_downstream"], rel["explanation"],
        )
        if rel["explanation"]["blocks_downstream"]:
            up_inc, down_inc = (incident, rel["incident"]) if incident.category == rel["upstream"] \
                else (rel["incident"], incident)
            up_t, down_t = routing.primary_task(up_inc), routing.primary_task(down_inc)
            if up_t and down_t:
                routing.apply_dependency(db, up_t, down_t, f"related incidents ({rel['explanation']['rule']})")
    return {
        "report": report,
        "incident": incident,
        "decision": res["decision"],
        "explanation": res["explanation"],
        "cluster": incident.cluster,
    }
