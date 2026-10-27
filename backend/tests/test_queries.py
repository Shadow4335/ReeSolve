from app import config

LAT, LNG = config.DEMO_SCENARIO_ORIGIN


def post(client, text, north_m=0.0):
    return client.post("/api/reports", json={"text": text, "lat": LAT + north_m / 111_195, "lng": LNG}).json()


def test_incident_list_and_filters(client):
    post(client, "Big pothole on the road")
    leak = post(client, "Water pipe burst and leaking", 60)
    post(client, "Street light is dark", 900)
    assert len(client.get("/api/incidents").json()) == 3
    assert [i["category"] for i in client.get("/api/incidents?category=water_leak").json()] == ["water_leak"]
    assert len(client.get("/api/incidents?department=ROADS").json()) == 1
    cid = leak["incident"]["cluster_id"]
    assert len(client.get(f"/api/incidents?cluster_id={cid}").json()) == 2
    assert client.get("/api/incidents?status=RESOLVED").json() == []


def test_incident_detail(client):
    post(client, "Big pothole on the road")
    leak = post(client, "Water pipe burst and leaking", 60)
    d = client.get(f"/api/incidents/{leak['incident']['id']}").json()
    assert d["category"] == "water_leak" and len(d["reports"]) == 1 and d["tasks"][0]["department_code"] == "WATER"
    assert d["tasks"][0]["sla_state"] == "ok" and d["cluster"]["coordination_note"]
    assert len(d["cluster"]["incidents"]) == 2
    assert [e["type"] for e in d["events"]][:2] == ["REPORT_RECEIVED", "INCIDENT_CREATED"]
    assert client.get("/api/incidents/999").status_code == 404


def test_cluster_endpoint(client):
    post(client, "Big pothole on the road")
    cid = post(client, "Water pipe burst and leaking", 60)["incident"]["cluster_id"]
    c = client.get(f"/api/clusters/{cid}").json()
    assert len(c["incidents"]) == 2 and "Water & Sewerage" in c["coordination_note"]
    assert client.get("/api/clusters/999").status_code == 404


def test_tasks_sorted_by_sla_remaining_with_filters(client):
    post(client, "Big pothole on the road")            # 144h
    post(client, "Street light is dark", 900)          # 72h
    post(client, "Water pipe burst and leaking", 1800)  # 24h
    tasks = client.get("/api/tasks").json()
    assert [t["department_code"] for t in tasks] == ["WATER", "ELEC", "ROADS"]
    rem = [t["sla_remaining_seconds"] for t in tasks]
    assert rem == sorted(rem)
    assert len(client.get("/api/tasks?department=ROADS").json()) == 1
    assert client.get("/api/tasks?status=CLOSED").json() == []


def test_blocked_and_closed_tasks_sort_after_running(client):
    post(client, "Big pothole on the road")
    post(client, "Water pipe burst and leaking", 60)   # road becomes BLOCKED
    tasks = client.get("/api/tasks").json()
    assert tasks[0]["status"] == "OPEN" and tasks[1]["status"] == "BLOCKED" and tasks[1]["sla_state"] == "paused"


def test_events_feed_params(client):
    post(client, "Big pothole on the road")
    post(client, "Street light is dark", 900)
    allev = client.get("/api/events").json()
    ids = [e["id"] for e in allev]
    assert ids == sorted(ids) and len(ids) == 6
    assert [e["id"] for e in client.get(f"/api/events?since_id={ids[2]}").json()] == ids[3:]
    assert [e["id"] for e in client.get(f"/api/events?since_id={ids[0]}&limit=2").json()] == ids[1:3]
    assert [e["id"] for e in client.get("/api/events?limit=2").json()] == ids[:2]  # first N, ordered by id
    assert all(e["incident_id"] == 2 for e in client.get("/api/events?incident_id=2").json())
    assert all(e["task_id"] == 1 or e["type"] == "TASK_CREATED" for e in client.get("/api/events?task_id=1").json())
