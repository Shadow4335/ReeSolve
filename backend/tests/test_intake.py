import pytest

from app import config
from app.models import Event, Incident, Report
from app.services.intake import structure_report
from app.services.reports import submit_report


@pytest.mark.parametrize("text,cat,sev", [
    ("Huge pothole on the main road near the market", "road_damage", 3),
    ("Dangerous pothole, there was an accident here", "road_damage", 5),
    ("Water pipe burst and leaking all over the lane", "water_leak", 3),
    ("Sewer drain is clogged and overflowing", "drain_blockage", 4),
    ("Garbage dump not cleared for a week", "garbage", 3),
    ("Street light is out, whole lane is dark", "streetlight", 3),
    ("Stray dogs barking at night", "other", 3),
    ("Flood near the school, dangerous for kids, hospital road blocked", "other", 5),
])
def test_keyword_intake(text, cat, sev):
    out = structure_report(text)
    if cat != "other" or "Flood" not in text:
        assert out["category"] == cat
    assert out["severity"] == sev


def test_summary_truncated_and_cleaned():
    out = structure_report("pothole   " + "x" * 300)
    assert len(out["summary"]) == 120 and "  " not in out["summary"]


def test_submit_report_creates_report_incident_events(db):
    r = submit_report(db, "Big pothole on the road", 28.62, 77.21, reporter_name="Asha")
    db.commit()
    assert r["decision"] == "new"
    assert r["report"].incident_id == r["incident"].id
    assert r["incident"].report_count == 1 and r["incident"].category == "road_damage"
    evs = db.query(Event).order_by(Event.id).all()
    assert [e.type for e in evs] == ["REPORT_RECEIVED", "INCIDENT_CREATED", "TASK_CREATED"]
    assert all(e.reason and e.incident_id == r["incident"].id for e in evs)


def test_vulnerable_zone_raises_priority(db):
    plain = submit_report(db, "dangerous pothole on road", 28.6300, 77.2300)["incident"]
    hospital = config.VULNERABLE_ZONES[0]  # first zone: Dr Ram Manohar Lohia Hospital
    zone = submit_report(db, "dangerous pothole on road", hospital["lat"], hospital["lng"])["incident"]
    assert not plain.in_vulnerable_zone and zone.in_vulnerable_zone
    assert plain.priority == "MEDIUM" and zone.priority == "HIGH"


def test_post_and_get_report(client):
    res = client.post("/api/reports", json={"text": "Burst water pipe", "lat": 28.62, "lng": 77.21})
    assert res.status_code == 201
    body = res.json()
    assert body["decision"] == "new" and body["incident"]["category"] == "water_leak"
    assert body["cluster"] is None
    got = client.get(f"/api/reports/{body['report']['id']}")
    assert got.status_code == 200 and got.json()["incident_id"] == body["incident"]["id"]


def test_get_unknown_report_404(client):
    assert client.get("/api/reports/999").status_code == 404


def test_post_invalid_body_422(client):
    assert client.post("/api/reports", json={"text": "x"}).status_code == 422


def test_category_hint_overrides_keywords(db):
    r = submit_report(db, "Something is wrong near the market", 28.62, 77.21, category_hint="streetlight")
    assert r["incident"].category == "streetlight" and r["report"].category == "streetlight"
    assert submit_report(db, "Water pipe burst", 28.65, 77.25, category_hint="garbage")["incident"].category == "garbage"


def test_water_hint_picks_drain_or_leak(db):
    drain = submit_report(db, "Sewer is clogged and overflowing", 28.62, 77.21, category_hint="water")
    leak = submit_report(db, "Something is dripping near the tank", 28.70, 77.30, category_hint="water")
    assert drain["incident"].category == "drain_blockage" and leak["incident"].category == "water_leak"


def test_unknown_hint_ignored_and_api_accepts_hint(client):
    body = {"text": "Big pothole on the road", "lat": 28.62, "lng": 77.21, "category_hint": "nonsense"}
    assert client.post("/api/reports", json=body).json()["incident"]["category"] == "road_damage"
    body = {"text": "Please look at this", "lat": 28.7, "lng": 77.3, "category_hint": "road_damage"}
    assert client.post("/api/reports", json=body).json()["incident"]["category"] == "road_damage"
