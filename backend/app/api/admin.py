"""Admin endpoints: clock, tick, stats, reset, seed."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import clock
from app.db import get_db, reset_db
from app.schemas import ClockAdvanceIn, ClockOut
from app.services import sla, stats
from app.services.events import log_event

router = APIRouter()


def _clock_out() -> ClockOut:
    return ClockOut(now=clock.now(), offset_seconds=clock.offset_seconds())


@router.get("/admin/clock", response_model=ClockOut)
def get_clock():
    return _clock_out()


@router.post("/admin/clock/advance", response_model=ClockOut)
def advance_clock(body: ClockAdvanceIn, db: Session = Depends(get_db)):
    clock.advance(body.hours, db)
    log_event(db, "CLOCK_ADVANCED", f"Simulated clock advanced by {body.hours:g}h", actor="admin",
              payload={"hours": body.hours})
    sla.run_watchdog(db)
    db.commit()
    return _clock_out()


@router.post("/admin/clock/reset", response_model=ClockOut)
def reset_clock(db: Session = Depends(get_db)):
    clock.reset(db)
    log_event(db, "CLOCK_ADVANCED", "Simulated clock reset to real time", actor="admin", payload={"hours": 0})
    db.commit()
    return _clock_out()


@router.post("/admin/tick", response_model=ClockOut)
def tick(db: Session = Depends(get_db)):
    sla.run_watchdog(db)
    db.commit()
    return _clock_out()


@router.get("/admin/stats")
def get_stats(db: Session = Depends(get_db)) -> dict[str, Any]:
    return stats.compute_stats(db)


@router.post("/admin/reset")
def reset(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Wipe the database and clock; reload departments and vulnerable zones only."""
    db.rollback()
    reset_db(db.get_bind())
    return {"reset": True}


@router.post("/admin/seed")
def seed_baseline(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Load baseline data via the seed script (imported lazily so the app boots without it)."""
    try:
        from scripts.seed_demo import seed  # demo-tuned baseline; teammate's scripts/seed.py stays available
    except ImportError:
        raise HTTPException(status_code=501, detail="seed script (scripts/seed_demo.py) is not installed")
    seed(db)
    db.commit()
    return {"seeded": True}
