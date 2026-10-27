"""Admin endpoints: clock, tick (stats/seed/reset arrive in M7)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import clock
from app.db import get_db
from app.schemas import ClockAdvanceIn, ClockOut
from app.services import sla
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
