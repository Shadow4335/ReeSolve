"""Baseline data: ~11 incidents in varied states, built only through the public services with a back-dated clock.

FALLBACK written by the main dev (see DECISIONS.md). Importable as `seed(db)` (used by POST /admin/seed) and runnable
as `python scripts/seed.py`. Every incident sits >= SEED_MIN_DISTANCE_FROM_SCENARIO_M from DEMO_SCENARIO_ORIGIN.
"""
import sys
from collections.abc import Callable
from math import cos, radians
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.orm import Session  # noqa: E402

from app import clock, config  # noqa: E402
from app.geo import haversine_m  # noqa: E402
from app.models import Incident, VerificationRequest  # noqa: E402
from app.services import sla, verification  # noqa: E402
from app.services.reports import submit_report  # noqa: E402
from app.services.routing import primary_task, start_task  # noqa: E402

CLC, CLN = config.DEMO_CENTER
HOURS_BACK = 170
STEP_HOURS = 4


def _pos(north_m: float, east_m: float) -> tuple[float, float]:
    return CLC + north_m / 111_195, CLN + east_m / (111_195 * cos(radians(CLC)))


def seed(db: Session) -> None:
    """Create baseline incidents (skips if any incident already exists); leaves the clock at offset 0."""
    if db.query(Incident).count():
        return
    handles: dict[str, Incident] = {}
    state = {"cur": float(-HOURS_BACK)}

    def go(t: float) -> None:
        """Move the simulated clock to `t` hours from now in steps, running the watchdog at each step."""
        while state["cur"] < t - 1e-9:
            step = min(STEP_HOURS, t - state["cur"])
            clock.advance(step, db)
            state["cur"] += step
            sla.run_watchdog(db)
            db.commit()

    def report(key: str, text: str, north: float, east: float, name: str = "Resident") -> Callable[[], None]:
        def run() -> None:
            lat, lng = _pos(north, east)
            assert haversine_m(lat, lng, *config.DEMO_SCENARIO_ORIGIN) >= config.SEED_MIN_DISTANCE_FROM_SCENARIO_M
            res = submit_report(db, text, lat, lng, reporter_name=name)
            handles.setdefault(key, res["incident"])
        return run

    def start(key: str) -> Callable[[], None]:
        return lambda: start_task(db, primary_task(handles[key]).id)

    def close(key: str, note: str = "Repair completed and site cleaned") -> Callable[[], None]:
        def run() -> None:
            inc = handles[key]
            verification.submit_closure(db, primary_task(inc).id, note, f"https://example.org/proof/{key}.jpg",
                                        inc.lat, inc.lng)
        return run

    def respond(key: str, fixed: bool, comment: str | None = None) -> Callable[[], None]:
        def run() -> None:
            task = primary_task(handles[key])
            closure = verification.latest_closure(db, task)
            for vr in db.query(VerificationRequest).filter_by(closure_id=closure.id, status="PENDING"):
                if task.status != "PENDING_VERIFICATION":
                    break
                verification.record_response(db, task.id, vr.report_id, fixed, comment)
                if not fixed:
                    break
        return run

    pothole_n = [
        "Dangerous pothole on Aspen Road, a bike nearly crashed",
        "Aspen Road pothole is getting worse, dangerous for scooters",
        "Deep dangerous pothole near Aspen Road bus stop",
        "Pothole on Aspen Road, an accident waiting to happen",
    ]
    # Timing rule: every running baseline task keeps >= ~28h of SLA left (except F, deliberately at the warning
    # point), so the demo's early clock jumps do not trip unrelated tasks.
    timeline: list[tuple[float, Callable[[], None]]] = [
        # verified closures
        (-120, report("A", "Large pothole on the road outside Cedar Market, two-wheelers are slipping", -100, -250)),
        (-115, start("A")), (-100, close("A")), (-96, respond("A", True)),
        (-110, report("B", "Garbage dump overflowing next to the Maple Ward bus stop", -100, 250)),
        (-105, start("B")), (-80, close("B")), (-70, respond("B", True)),
        (-100, report("C", "Street light on Orchard Lane has been out for days, the lane is dark", -350, 0)),
        (-90, start("C")), (-60, close("C")), (-58, respond("C", True)),
        # closed with low confidence: nobody answers the verification request
        (-100, report("D", "Drain outside Willow Court is clogged with sludge", -350, 300)),
        (-95, start("D")), (-90, close("D")),
        # breached long ago and escalated by the watchdog (long road SLA keeps it quiet now)
        (-151, report("K", "Large pothole at Linden Crossing, it has been there for weeks and nobody came", -100, 0)),
        # reopened once after a citizen said "not fixed"
        (-60, report("G", "Road surface collapsed into a deep crack on Pine Street", -600, 300)),
        (-55, start("G")), (-30, close("G")),
        (-2, respond("G", False, "Still a crater, the patch washed away")),
        # near its SLA warning point (deliberate: the "close to breach" example)
        (-115.5, report("F", "Cracked road surface near Elm Street junction, vehicles are swerving", -600, 0)),
        # duplicates raising priority
        (-20, report("H", pothole_n[0], -600, -300, "Resident 1")),
        (-18, report("H", pothole_n[1], -600 + 1.1, -300, "Resident 2")),
        (-16, report("H", pothole_n[2], -600 + 1.9, -300, "Resident 3")),
        (-14, report("H", pothole_n[3], -600 + 2.2, -300, "Resident 4")),
        # cluster pair: clogged drain upstream, road blocked behind it
        (-0.5, report("I", "Drain near Cypress Square is clogged and overflowing", -850, -100)),
        (-0.4, report("IR", "Large pothole and cracked road near Cypress Square", -790, -100)),
        # in progress, and a fresh report
        (-10, report("E", "Street light on Birch Road is out, the whole stretch is dark", -350, -300)),
        (-8, start("E")),
        (-2, report("J", "Street light not working near Hazel Park, very dark at night", -850, 250)),
    ]
    clock.advance(-HOURS_BACK, db)
    db.commit()
    for t, action in sorted(timeline, key=lambda x: x[0]):
        go(t)
        action()
        db.commit()
    go(0)
    clock.reset(db)
    db.commit()


if __name__ == "__main__":
    from app.db import SessionLocal, init_db

    init_db()
    with SessionLocal() as session:
        seed(session)
        print(f"seeded {session.query(Incident).count()} incidents")
