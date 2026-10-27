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
HOURS_BACK = 120
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
        # breached and escalated by the watchdog
        (-70, report("K", "Garbage dump has not been cleared at Linden Crossing for a week", -100, 0)),
        # reopened once after a citizen said "not fixed"
        (-60, report("G", "Garbage piled up and not collected for days on Pine Street", -600, 300)),
        (-55, start("G")), (-30, close("G")),
        (-10, respond("G", False, "Still a pile of rubbish, nothing was collected")),
        # duplicates raising priority
        (-50, report("H", pothole_n[0], -600, -300, "Resident 1")),
        (-48, report("H", pothole_n[1], -600 + 0.0001 * 111_195 / 10, -300, "Resident 2")),
        (-46, report("H", pothole_n[2], -600 + 0.0001 * 111_195 / 6, -300, "Resident 3")),
        (-44, report("H", pothole_n[3], -600 + 0.0001 * 111_195 / 5, -300, "Resident 4")),
        # near breach, in progress, cluster pair (road blocked behind leak), fresh report
        (-20, report("F", "Leaking water pipe near Elm Street junction, low pressure at the tap", -600, 0)),
        (-12, report("I", "Water pipe burst and leaking near Cypress Square", -850, -100)),
        (-11.5, report("IR", "Large pothole and cracked road near Cypress Square", -790, -100)),
        (-10.5, report("E", "Water pipe burst on Birch Road, leaking onto the footpath", -350, -300)),
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
