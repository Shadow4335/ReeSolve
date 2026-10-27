"""Routing and priority. M2 holds the pure priority helpers; tasks and SLA assignment arrive in M4."""
from sqlalchemy.orm import Session

from app import config
from app.geo import haversine_m
from app.models import VulnerableZone


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
