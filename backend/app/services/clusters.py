"""Cluster linking for related (not duplicate) incidents."""
from typing import Any

from sqlalchemy.orm import Session

from app import config
from app.models import Cluster, Department, Incident
from app.services.events import log_event


def _dept_name(db: Session, category: str) -> str:
    code = config.CATEGORY_TO_DEPT[category]
    return db.query(Department).filter_by(code=code).one().name


def _label(category: str) -> str:
    return category.replace("_", " ")


def coordination_note(db: Session, upstream: str, downstream: str, blocked: bool) -> str:
    """Human-readable next-steps text for a related pair."""
    up_d, down_d = _dept_name(db, upstream), _dept_name(db, downstream)
    if blocked:
        return (f"{up_d} must resolve the {_label(upstream)} first; {down_d} resumes the "
                f"{_label(downstream)} work after the {_label(upstream)} task is closed. "
                f"{down_d} SLA clock is paused meanwhile.")
    return (f"{up_d} ({_label(upstream)}) and {down_d} ({_label(downstream)}) are handling related "
            f"incidents independently; share findings on the common cause.")


def link_related(db: Session, incident: Incident, other: Incident, upstream: str, downstream: str,
                 blocked: bool, explanation: dict[str, Any]) -> Cluster | None:
    """Put two related incidents in one cluster (reusing/merging existing ones). Logs RELATED_LINKED.

    Returns None if they already share a cluster (nothing changed).
    """
    if incident.cluster_id and incident.cluster_id == other.cluster_id:
        return None
    cluster = incident.cluster or other.cluster
    if cluster is None:
        cluster = Cluster(title=f"{_label(upstream).title()} + {_label(downstream).title()}", coordination_note="")
        db.add(cluster)
        db.flush()
    elif incident.cluster and other.cluster:
        for member in list(other.cluster.incidents):  # merge two existing clusters
            member.cluster = cluster
    incident.cluster = other.cluster = cluster
    note = coordination_note(db, upstream, downstream, blocked)
    cluster.coordination_note = f"{cluster.coordination_note} {note}".strip() if cluster.coordination_note else note
    db.flush()
    log_event(
        db, "RELATED_LINKED",
        f"Incident #{incident.id} linked to #{other.id} ({explanation['rule']}, {explanation['distance_m']}m apart): {note}",
        incident_id=incident.id, payload={**explanation, "cluster_id": cluster.id},
    )
    return cluster
