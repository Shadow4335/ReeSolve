"""Duplicate / related detection (CONTEXT 6.3). Pure reads: no state is changed here."""
from datetime import timedelta
from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from app import clock, config
from app.geo import haversine_m
from app.models import Incident, Report


def text_similarity(a: str, b: str) -> float:
    """TF-IDF cosine similarity of two short texts (0 if either has no usable words)."""
    try:
        m = TfidfVectorizer().fit_transform([a, b])
    except ValueError:
        return 0.0
    return float(cosine_similarity(m[0], m[1])[0, 0])


def related_rule(cat_a: str, cat_b: str) -> tuple[str, str, bool] | None:
    """Return (upstream, downstream, blocked) if the category pair is in RELATED_RULES (either order)."""
    for up, down, blocked in config.RELATED_RULES:
        if {up, down} == {cat_a, cat_b} and up != down:
            return up, down, blocked
    return None


def resolve_report(db: Session, report: Report) -> dict[str, Any]:
    """Decide duplicate/new and find related incidents.

    Returns {decision, incident (duplicate target or None), explanation, related: [{incident, explanation, upstream, downstream}]}.
    """
    t = clock.now()
    window_start = t - timedelta(days=config.DEDUP_WINDOW_DAYS)
    related_start = t - timedelta(days=config.RELATED_WINDOW_DAYS)
    candidates = db.query(Incident).filter(Incident.created_at >= window_start).all()

    best: tuple[float, Incident, dict[str, Any]] | None = None
    related: list[dict[str, Any]] = []
    for inc in candidates:
        d = haversine_m(report.lat, report.lng, inc.lat, inc.lng)
        if inc.category == report.category:
            if d > config.DUP_RADIUS_M:
                continue
            geo = max(0.0, 1 - d / config.DUP_RADIUS_M)
            sim = text_similarity(report.summary, inc.summary)
            score = config.DUP_GEO_WEIGHT * geo + config.DUP_TEXT_WEIGHT * sim
            hard = d <= config.DUP_HARD_RADIUS_M
            if hard or score >= config.DUP_THRESHOLD:
                rule = (f"same_category_within_{config.DUP_HARD_RADIUS_M}m" if hard
                        else f"same_category_within_{config.DUP_RADIUS_M}m")
                expl = {
                    "decision": "duplicate", "matched_incident_id": inc.id, "distance_m": round(d),
                    "text_similarity": round(sim, 2), "score": round(score, 2), "rule": rule,
                }
                if best is None or score > best[0]:
                    best = (score, inc, expl)
        elif d <= config.RELATED_RADIUS_M and inc.created_at >= related_start:
            rule = related_rule(report.category, inc.category)
            if rule:
                up, down, blocked = rule
                related.append({
                    "incident": inc, "upstream": up, "downstream": down,
                    "explanation": {
                        "decision": "related", "matched_incident_id": inc.id, "distance_m": round(d),
                        "rule": f"{up}->{down}", "blocks_downstream": blocked,
                    },
                })

    if best:
        return {"decision": "duplicate", "incident": best[1], "explanation": best[2], "related": related}
    return {"decision": "new", "incident": None, "related": related,
            "explanation": {"decision": "new", "rule": "no_duplicate_found"}}
