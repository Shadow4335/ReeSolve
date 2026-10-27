"""Scripted live-demo storyline (CONTEXT section 11), driven entirely through the HTTP API.

    python scripts/demo_scenario.py [--base-url http://localhost:8000] [--pause 3] [--no-reset]

By default it resets the DB and loads the seed data first, so it is re-runnable. `--pause N` waits N seconds
between steps (use it when narrating live). Each step prints what happened and asserts the expected outcome;
the exit code is non-zero if any assertion fails.
"""
import argparse
import sys
import time
from math import cos, radians
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import config  # noqa: E402

LAT0, LNG0 = config.DEMO_SCENARIO_ORIGIN
FAILURES: list[str] = []
FOCUS: set[int] = set()  # incident ids whose events we narrate; other city activity is summarised as a count
last_event_id = 0


def at(north_m: float = 0.0, east_m: float = 0.0) -> dict[str, float]:
    """Coordinates offset in metres from DEMO_SCENARIO_ORIGIN."""
    return {"lat": LAT0 + north_m / 111_195, "lng": LNG0 + east_m / (111_195 * cos(radians(LAT0)))}


def banner(n: int | str, title: str) -> None:
    print(f"\n{'=' * 78}\n STEP {n}: {title}\n{'=' * 78}")


def check(cond: bool, msg: str) -> None:
    print(f"  {'OK  ' if cond else 'FAIL'} {msg}")
    if not cond:
        FAILURES.append(msg)


class Api:
    def __init__(self, base_url: str) -> None:
        self.c = httpx.Client(base_url=f"{base_url}/api", timeout=30)

    def call(self, method: str, path: str, **kw):
        r = self.c.request(method, path, **kw)
        if r.status_code >= 400:
            raise SystemExit(f"{method} {path} -> {r.status_code}: {r.text}")
        return r.json()

    def get(self, path: str, **params):
        return self.call("GET", path, params=params)

    def post(self, path: str, body: dict | None = None):
        return self.call("POST", path, json=body or {})


def show_new_events(api: Api, only: set[str] | None = None) -> list[dict]:
    """Print (and return) audit events created since the last call, limited to the narrated incidents."""
    global last_event_id
    events = api.get("/events", since_id=last_event_id)
    if events:
        last_event_id = events[-1]["id"]
    elsewhere = 0
    for e in events:
        if FOCUS and e["incident_id"] is not None and e["incident_id"] not in FOCUS:
            elsewhere += 1
        elif only is None or e["type"] in only:
            print(f"  [{e['type']:<22}] {e['reason']}")
    if elsewhere:
        print(f"  (+{elsewhere} events on other city incidents, e.g. baseline tasks reaching their own deadlines)")
    return events


def submit(api: Api, text: str, north: float, east: float, name: str) -> dict:
    res = api.post("/reports", {"text": text, "reporter_name": name, **at(north, east)})
    ex = res["explanation"] or {}
    detail = (f"merged -> incident #{res['incident']['id']}, {ex.get('distance_m')}m away, "
              f"similarity {ex.get('text_similarity')}") if res["decision"] == "duplicate" else \
        f"NEW incident #{res['incident']['id']}"
    print(f"  {name}: \"{text}\"\n      => {detail} | reports={res['incident']['report_count']}, "
          f"priority={res['incident']['priority']}")
    return res


def task_of(api: Api, incident_id: int) -> dict:
    return api.get(f"/incidents/{incident_id}")["tasks"][0]


def close_task(api: Api, task_id: int, incident: dict, note: str) -> dict:
    return api.post(f"/tasks/{task_id}/close", {
        "note": note, "photo_url": f"https://example.org/proof/task-{task_id}.jpg",
        "lat": incident["lat"], "lng": incident["lng"],
    })


def confirm_until_closed(api: Api, task_id: int, report_ids: list[int]) -> dict:
    task = {}
    for rid in report_ids:
        task = api.post(f"/tasks/{task_id}/verify-response", {"report_id": rid, "fixed": True})["task"]
        if task["status"] == "CLOSED":
            break
    return task


def pause(seconds: float) -> None:
    if seconds:
        time.sleep(seconds)


def main() -> int:
    global last_event_id
    FOCUS.clear()
    FAILURES.clear()
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8000")
    ap.add_argument("--pause", type=float, default=0.0, help="seconds to wait between steps")
    ap.add_argument("--no-reset", action="store_true", help="skip /admin/reset + /admin/seed")
    args = ap.parse_args()
    api = Api(args.base_url)
    try:
        api.get("/health")
    except httpx.HTTPError:
        raise SystemExit(f"backend not reachable at {args.base_url} (start it with: uvicorn app.main:app --port 8000)")

    if not args.no_reset:
        banner(0, "Fresh start: reset database, load baseline city data")
        api.post("/admin/reset")
        try:
            api.post("/admin/seed")
        except SystemExit as e:
            print(f"  (seed skipped: {e})")
    evs = api.get("/events", limit=1)
    last_event_id = evs[-1]["id"] if evs else 0
    base_stats = api.get("/admin/stats")["totals"]
    print(f"  City baseline: {base_stats['incidents']} incidents, {base_stats['open_tasks']} open tasks")
    pause(args.pause)

    # ---- 1. duplicates -----------------------------------------------------------------------------------------
    banner(1, "Five citizens report the same pothole -> ONE incident (explainable dedup)")
    texts = [
        ("Huge pothole on Rosewood Lane near the bakery", 0, 0, "Asha"),
        ("Dangerous pothole on Rosewood Lane by the bakery, a scooter fell", 8, 4, "Ravi"),
        ("There is a big pothole on Rosewood Lane outside the bakery", -12, 6, "Meera"),
        ("Rosewood Lane pothole near the bakery is dangerous for bikes", 20, -10, "Imran"),
        ("Pothole on Rosewood Lane next to the bakery, please fix it", -15, -12, "Sunita"),
    ]
    results = [submit(api, *t) for t in texts]
    pothole = results[0]["incident"]
    pid = pothole["id"]
    FOCUS.add(pid)
    check(all(r["incident"]["id"] == pid for r in results), "all 5 reports share one incident")
    inc = api.get(f"/incidents/{pid}")
    check(inc["report_count"] == 5, f"report_count == 5 (got {inc['report_count']})")
    check(inc["priority"] in ("HIGH", "CRITICAL"), f"priority raised to {inc['priority']}")
    road_task = inc["tasks"][0]
    check(road_task["department_code"] == "ROADS", "routed to Roads & Infrastructure")
    show_new_events(api, {"DUPLICATE_MERGED", "PRIORITY_RAISED"})
    report_ids = [r["id"] for r in inc["reports"]]
    pause(args.pause)

    # ---- 2. related incident -----------------------------------------------------------------------------------
    banner(2, "A water leak 60 m away -> related cluster, Roads task BLOCKED behind Water")
    leak_res = submit(api, "Water pipe burst and leaking near Rosewood Lane bakery", 0, 60, "Kiran")
    lid = leak_res["incident"]["id"]
    FOCUS.add(lid)
    cluster = leak_res["cluster"]
    check(cluster is not None, "cluster created")
    if cluster:
        print(f"  Coordination note: {cluster['coordination_note']}")
    road_task = task_of(api, pid)
    leak_task = task_of(api, lid)
    check(road_task["status"] == "BLOCKED", f"Roads task is {road_task['status']} (SLA {road_task['sla_state']})")
    check(road_task["depends_on_task_id"] == leak_task["id"], "Roads depends on the Water task")
    show_new_events(api, {"RELATED_LINKED", "TASK_BLOCKED", "TASK_CREATED"})
    pause(args.pause)

    # ---- 3. missed SLA -----------------------------------------------------------------------------------------
    banner(3, "Water misses its SLA -> warning, breach, automatic escalation")
    print("  Advancing the simulated clock +20h ...")
    api.post("/admin/clock/advance", {"hours": 20})
    leak_task = task_of(api, lid)
    check(leak_task["sla_state"] == "warning", f"Water SLA state: {leak_task['sla_state']}")
    show_new_events(api, {"SLA_WARNING", "SLA_BREACHED", "ESCALATED"})
    print("  Advancing the simulated clock +5h ...")
    api.post("/admin/clock/advance", {"hours": 5})
    leak_task = task_of(api, lid)
    check(leak_task["escalation_level"] == 1, f"escalated to {leak_task['escalation_level_label']}")
    check(task_of(api, pid)["status"] == "BLOCKED", "Roads clock stays paused (no breach while blocked)")
    show_new_events(api, {"SLA_WARNING", "SLA_BREACHED", "ESCALATED"})
    pause(args.pause)

    # ---- 4. water closes properly ------------------------------------------------------------------------------
    banner(4, "Water fixes the leak with proof; the reporter confirms -> CLOSED/VERIFIED, Roads unblocks")
    api.post(f"/tasks/{leak_task['id']}/start")
    res = close_task(api, leak_task["id"], leak_res["incident"], "Pipe section replaced and trench backfilled")
    check(res["task"]["status"] == "PENDING_VERIFICATION", "closure accepted -> PENDING_VERIFICATION")
    leak_report = api.get(f"/incidents/{lid}")["reports"][0]["id"]
    res = api.post(f"/tasks/{leak_task['id']}/verify-response", {"report_id": leak_report, "fixed": True})
    check(res["task"]["status"] == "CLOSED" and res["task"]["closure_confidence"] == "VERIFIED",
          "Water task CLOSED / VERIFIED")
    road_task = task_of(api, pid)
    check(road_task["status"] == "OPEN", f"Roads task unblocked automatically ({road_task['status']})")
    check(api.get(f"/incidents/{lid}")["status"] == "RESOLVED", "leak incident RESOLVED")
    show_new_events(api, {"CLOSURE_SUBMITTED", "VERIFICATION_REQUESTED", "CITIZEN_CONFIRMED", "TASK_CLOSED",
                          "INCIDENT_RESOLVED", "TASK_UNBLOCKED"})
    pause(args.pause)

    # ---- 5. contradicted closure -------------------------------------------------------------------------------
    banner(5, "Roads claims it is fixed; a citizen says 'not fixed' -> automatic reopen")
    api.post(f"/tasks/{road_task['id']}/start")
    res = close_task(api, road_task["id"], pothole, "Pothole patched with cold mix")
    check(res["task"]["status"] == "PENDING_VERIFICATION", "Roads closure accepted -> PENDING_VERIFICATION")
    res = api.post(f"/tasks/{road_task['id']}/verify-response",
                   {"report_id": report_ids[0], "fixed": False, "comment": "The patch already crumbled, hole is back"})
    check(res["task"]["status"] == "OPEN" and res["task"]["reopen_count"] == 1,
          f"task reopened (reopen_count={res['task']['reopen_count']}) with a shorter SLA")
    show_new_events(api, {"CLOSURE_SUBMITTED", "VERIFICATION_REQUESTED", "CITIZEN_REJECTED", "TASK_REOPENED"})
    pause(args.pause)

    # ---- 6. post-closure contradiction -------------------------------------------------------------------------
    banner(6, "Roads closes again and citizens confirm; then a NEW report lands -> reopen #2 + forced escalation")
    res = close_task(api, road_task["id"], pothole, "Pothole properly excavated and re-laid with asphalt")
    check(res["task"]["status"] == "PENDING_VERIFICATION", "second closure accepted")
    task = confirm_until_closed(api, road_task["id"], report_ids)
    check(task["status"] == "CLOSED" and task["closure_confidence"] == "VERIFIED", "Roads task CLOSED / VERIFIED")
    check(api.get(f"/incidents/{pid}")["status"] == "RESOLVED", "pothole incident RESOLVED")
    show_new_events(api, {"TASK_CLOSED", "INCIDENT_RESOLVED"})
    print("  ... a day later, another citizen reports the pothole at the same spot:")
    api.post("/admin/clock/advance", {"hours": 24})
    show_new_events(api, set())
    submit(api, "The pothole on Rosewood Lane near the bakery is back, worse than before", 5, -3, "Farah")
    task = task_of(api, pid)
    check(task["reopen_count"] == 2, f"reopen_count == 2 (got {task['reopen_count']})")
    check(task["escalation_level"] >= 2, f"forced escalation to {task['escalation_level_label']}")
    check(task["status"] == "OPEN", "task is OPEN again")
    show_new_events(api, {"DUPLICATE_MERGED", "CONTRADICTION_DETECTED", "TASK_REOPENED", "ESCALATED"})
    pause(args.pause)

    # ---- 7. admin view -----------------------------------------------------------------------------------------
    banner(7, "Admin view: department performance and the full audit timeline")
    stats = api.get("/admin/stats")
    print(f"  {'Department':<26}{'tasks':>6}{'SLA %':>8}{'reopen %':>10}")
    for d in stats["by_department"]:
        sla = "-" if d["sla_compliance_pct"] is None else f"{d['sla_compliance_pct']:.0f}"
        rr = "-" if d["reopen_rate_pct"] is None else f"{d['reopen_rate_pct']:.0f}"
        print(f"  {d['name']:<26}{d['total_tasks']:>6}{sla:>8}{rr:>10}")
    print(f"  Escalations by level: {stats['escalations_by_level']}")
    print(f"  Avg resolution time: {stats['avg_resolution_hours']} h | totals: {stats['totals']}")
    check(stats["totals"]["reopens"] >= 2, "stats show the reopens")
    full = api.get(f"/incidents/{pid}")
    print(f"\n  Audit timeline for pothole incident #{pid} ({len(full['events'])} events):")
    for e in full["events"]:
        print(f"    {e['ts'][:16]}  {e['type']:<22} {e['reason']}")
    cl = api.get(f"/clusters/{full['cluster_id']}")
    print(f"\n  Cluster #{cl['id']}: {[i['summary'][:40] for i in cl['incidents']]}\n  Note: {cl['coordination_note']}")

    print("\n" + ("DEMO SCENARIO COMPLETE: all checks passed" if not FAILURES
                  else f"DEMO SCENARIO FINISHED WITH {len(FAILURES)} FAILED CHECK(S):\n  - " + "\n  - ".join(FAILURES)))
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
