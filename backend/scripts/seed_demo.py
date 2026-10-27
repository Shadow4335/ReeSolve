"""Demo-tuned baseline data (main dev): 12 incidents at real New Delhi localities, quiet under early clock jumps,
re-runnable.

Alternative to scripts/seed.py (teammate-owned). Importable as `seed(db)` and runnable
as `python scripts/seed_demo.py`. Every incident sits >= SEED_MIN_DISTANCE_FROM_SCENARIO_M from DEMO_SCENARIO_ORIGIN
(Gurudwara Bangla Sahib, Ashoka Road), clear of the vulnerable zones, inside the default map view.
Coordinates are approximate landmark positions (good to a few tens of metres), which is what a pin needs.
"""
import sys
from collections.abc import Callable
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.orm import Session  # noqa: E402

from app import clock, config  # noqa: E402
from app.geo import haversine_m  # noqa: E402
from app.models import Incident, VerificationRequest  # noqa: E402
from app.services import sla, verification  # noqa: E402
from app.services.reports import submit_report  # noqa: E402
from app.services.routing import primary_task, start_task  # noqa: E402

HOURS_BACK = 170
STEP_HOURS = 4

# Real New Delhi localities (lat, lng).
PLACES = {
    "A": (28.6178, 77.2430),   # Pragati Maidan gate, Mathura Road
    "B": (28.6285, 77.2338),   # Bengali Market
    "C": (28.6045, 77.2438),   # Sunder Nagar
    "D": (28.6296, 77.2225),   # Barakhamba Road metro gate
    "K": (28.6330, 77.2185),   # Connaught Place, outer circle
    "G": (28.6290, 77.2405),   # ITO crossing, Vikas Marg
    "F": (28.6227, 77.2406),   # Supreme Court, Tilak Marg
    "H": (28.6118, 77.2318),   # India Gate, Shahjahan Road
    "I": (28.6215, 77.2130),   # Patel Chowk metro, Sansad Marg
    "E": (28.6258, 77.2343),   # Mandi House
    "J": (28.6137, 77.2050),   # Krishi Bhawan, Rajpath
}


def _shift(lat: float, lng: float, north_m: float) -> tuple[float, float]:
    """Move a point `north_m` metres north (used to nudge duplicate reports and to place the blocked pothole)."""
    return lat + north_m / 111_195, lng


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

    def report(key: str, text: str, place: str, name: str = "Resident", north_m: float = 0.0) -> Callable[[], None]:
        def run() -> None:
            lat, lng = _shift(*PLACES[place], north_m)
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
        ("Dangerous pothole on Shahjahan Road near India Gate, a bike nearly crashed", "Harpreet Kaur"),
        ("Shahjahan Road pothole by India Gate is getting worse, dangerous for scooters", "Rohit Mehra"),
        ("Deep dangerous pothole near the India Gate lawns on Shahjahan Road", "Neha Gupta"),
        ("Pothole on Shahjahan Road near India Gate, an accident waiting to happen", "Imran Qureshi"),
    ]
    # Timing rule: every running baseline task keeps >= ~28h of SLA left (except F, deliberately at the warning
    # point), so the demo's early clock jumps do not trip unrelated tasks.
    timeline: list[tuple[float, Callable[[], None]]] = [
        # verified closures
        (-120, report("A", "Large pothole on Mathura Road near Pragati Maidan gate, two-wheelers are slipping", "A", "Anil Bhatia")),
        (-115, start("A")), (-100, close("A")), (-96, respond("A", True)),
        (-110, report("B", "Garbage dump overflowing next to the Bengali Market bus stop", "B", "Sunita Devi")),
        (-105, start("B")), (-80, close("B")), (-70, respond("B", True)),
        (-100, report("C", "Street light on Sunder Nagar Main Road has been out for days, the lane is dark", "C", "Farah Siddiqui")),
        (-90, start("C")), (-60, close("C")), (-58, respond("C", True)),
        # closed with low confidence: nobody answers the verification request
        (-100, report("D", "Drain outside Barakhamba Road metro gate is clogged with sludge", "D", "Vikram Singh")),
        (-95, start("D")), (-90, close("D")),
        # breached long ago and escalated by the watchdog (long road SLA keeps it quiet now)
        (-151, report("K", "Large pothole at Connaught Place outer circle, it has been there for weeks and nobody came", "K", "Meera Joshi")),
        # reopened once after a citizen said "not fixed"
        (-60, report("G", "Road surface collapsed into a deep crack near ITO crossing on Vikas Marg", "G", "Arjun Nair")),
        (-55, start("G")), (-30, close("G")),
        (-2, respond("G", False, "Still a crater, the patch washed away")),
        # near its SLA warning point (deliberate: the "close to breach" example)
        (-115.5, report("F", "Cracked road surface near the Supreme Court on Tilak Marg, vehicles are swerving", "F", "Kavita Rao")),
        # duplicates raising priority (India Gate)
        (-20, report("H", pothole_n[0][0], "H", pothole_n[0][1])),
        (-18, report("H", pothole_n[1][0], "H", pothole_n[1][1], north_m=1.1)),
        (-16, report("H", pothole_n[2][0], "H", pothole_n[2][1], north_m=1.9)),
        (-14, report("H", pothole_n[3][0], "H", pothole_n[3][1], north_m=2.2)),
        # cluster pair at Patel Chowk: clogged drain upstream, road blocked behind it (60 m apart)
        (-0.5, report("I", "Drain near Patel Chowk metro station is clogged and overflowing", "I", "Deepak Verma")),
        (-0.4, report("IR", "Large pothole and cracked road near Patel Chowk metro station", "I", "Pooja Malhotra", north_m=60)),
        # in progress, and a fresh report
        (-10, report("E", "Street light near Mandi House roundabout is out, the whole stretch is dark", "E", "Sanjay Kapoor")),
        (-8, start("E")),
        (-2, report("J", "Street light not working near Krishi Bhawan on Rajpath, very dark at night", "J", "Ritu Agarwal")),
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
