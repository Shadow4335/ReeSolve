"""Routing and priority. M3 holds the priority helpers; tasks and SLA assignment arrive in M4."""
from sqlalchemy.orm import Session

from app import config
from app.geo import haversine_m
from app.models import Incident, VulnerableZone
from app.services.events import log_event


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


def recompute_priority(db: Session, incident: Incident) -> bool:
    """Recompute incident priority after a merge; log PRIORITY_RAISED if it rose. Returns True if raised.

    (M4 extends this to shorten the task SLA deadline.)
    """
    new = compute_priority(incident.severity_max, incident.report_count, incident.in_vulnerable_zone)
    old = incident.priority
    if config.PRIORITY_ORDER.index(new) <= config.PRIORITY_ORDER.index(old):
        return False
    incident.priority = new
    log_event(
        db, "PRIORITY_RAISED",
        f"Priority raised {old} -> {new} ({incident.report_count} reports, severity {incident.severity_max})",
        incident_id=incident.id, payload={"from": old, "to": new},
    )
    return True
