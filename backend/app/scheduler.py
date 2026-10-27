"""APScheduler job: run the SLA watchdog every WATCHDOG_INTERVAL_SECONDS."""
from apscheduler.schedulers.background import BackgroundScheduler

from app import config
from app.db import SessionLocal
from app.services import sla


def watchdog_job() -> None:
    """Open a session, run the watchdog, commit (the one place a job commits)."""
    with SessionLocal() as db:
        sla.run_watchdog(db)
        db.commit()


def start() -> BackgroundScheduler:
    sched = BackgroundScheduler()
    sched.add_job(watchdog_job, "interval", seconds=config.WATCHDOG_INTERVAL_SECONDS, max_instances=1)
    sched.start()
    return sched
