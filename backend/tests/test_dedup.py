from datetime import timedelta

from app import clock, config
from app.geo import haversine_m
from app.models import Event, Incident
from app.services.reports import submit_report

LAT, LNG = config.DEMO_SCENARIO_ORIGIN


def at(meters_north: float) -> tuple[float, float]:
    return LAT + meters_north / 111_195, LNG


def events(db, type_):
    return db.query(Event).filter_by(type=type_).order_by(Event.id).all()


def test_near_duplicate_merges_and_explains(db):
    a = submit_report(db, "Dangerous pothole on Maple Street", *at(0))
    b = submit_report(db, "Pothole near Maple Street junction", *at(20))
    assert b["decision"] == "duplicate" and b["incident"].id == a["incident"].id
    assert b["incident"].report_count == 2 and b["report"].incident_id == a["incident"].id
    ex = b["explanation"]
    assert ex["matched_incident_id"] == a["incident"].id and ex["rule"].startswith("same_category_within")
    assert {"distance_m", "text_similarity", "score"} <= set(ex)
    merged = events(db, "DUPLICATE_MERGED")
    assert len(merged) == 1 and merged[0].payload["matched_incident_id"] == a["incident"].id and merged[0].reason


def test_priority_recomputed_on_merge(db):
    first = submit_report(db, "Dangerous pothole on Maple Street", *at(0))["incident"]
    assert first.priority == "MEDIUM"
    for i in range(3):
        submit_report(db, "Dangerous pothole on Maple Street", *at(5 * (i + 1)))
    assert first.report_count == 4 and first.priority == "HIGH"
    raised = events(db, "PRIORITY_RAISED")
    assert len(raised) == 1 and raised[0].payload["from"] == "MEDIUM" and raised[0].payload["to"] == "HIGH"


def test_same_category_300m_away_not_merged(db):
    a = submit_report(db, "Pothole on Maple Street", *at(0))
    b = submit_report(db, "Pothole on Maple Street", *at(300))
    assert b["decision"] == "new" and b["incident"].id != a["incident"].id
    assert a["incident"].report_count == 1 and not events(db, "DUPLICATE_MERGED")


def test_mid_distance_needs_text_similarity(db):
    submit_report(db, "Deep pothole outside the bakery", *at(0))
    far_text = submit_report(db, "Crack in the road asphalt by the temple", *at(60))
    assert far_text["decision"] == "new"
    same_text = submit_report(db, "Deep pothole outside the bakery", *at(-60))
    assert same_text["decision"] == "duplicate"


def test_old_incident_outside_window_not_merged(db):
    submit_report(db, "Pothole on Maple Street", *at(0))
    clock.advance(24 * (config.DEDUP_WINDOW_DAYS + 1))
    assert submit_report(db, "Pothole on Maple Street", *at(0))["decision"] == "new"


def test_leak_near_pothole_creates_cluster(db):
    road = submit_report(db, "Big pothole on the road", *at(0))
    leak = submit_report(db, "Water pipe burst and leaking", *at(60))
    assert leak["decision"] == "new"
    cluster = leak["cluster"]
    assert cluster is not None and road["incident"].cluster_id == cluster.id == leak["incident"].cluster_id
    assert "Water & Sewerage must resolve" in cluster.coordination_note
    assert "Roads & Infrastructure" in cluster.coordination_note
    linked = events(db, "RELATED_LINKED")
    assert len(linked) == 1 and linked[0].payload["blocks_downstream"] is True
    assert linked[0].payload["rule"] == "water_leak->road_damage"


def test_related_in_either_order(db):
    leak = submit_report(db, "Water pipe burst and leaking", *at(0))
    road = submit_report(db, "Big pothole on the road", *at(60))
    assert road["cluster"].id == leak["incident"].cluster_id


def test_unrelated_categories_or_far_not_linked(db):
    submit_report(db, "Big pothole on the road", *at(0))
    assert submit_report(db, "Street light is dark", *at(60))["cluster"] is None
    assert submit_report(db, "Water pipe burst and leaking", *at(400))["cluster"] is None


def test_third_incident_joins_existing_cluster(db):
    road = submit_report(db, "Big pothole on the road", *at(0))
    leak = submit_report(db, "Water pipe burst and leaking", *at(60))
    drain = submit_report(db, "Drain is clogged and overflowing", *at(40))
    assert drain["cluster"].id == road["incident"].cluster_id == leak["incident"].cluster_id
    assert db.query(Incident).filter_by(cluster_id=drain["cluster"].id).count() == 3
