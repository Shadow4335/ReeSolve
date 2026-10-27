"""Engine, session factory, init and reference-data seeding. Reset = delete the SQLite file / drop_all."""
from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app import clock, config
from app.models import Base, Department, VulnerableZone

engine = create_engine(config.DB_URL, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _sqlite_fk_on(dbapi_conn, _record) -> None:  # pragma: no cover - trivial
    dbapi_conn.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request; the API layer commits."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_reference_data(db: Session) -> None:
    """Idempotently insert the 5 departments and vulnerable zones from config. Caller commits."""
    existing = {d.code for d in db.query(Department).all()}
    for dept in config.DEPARTMENTS:
        if dept["code"] not in existing:
            db.add(Department(code=dept["code"], name=dept["name"]))
    if db.query(VulnerableZone).count() == 0:
        for z in config.VULNERABLE_ZONES:
            db.add(VulnerableZone(**z))


def init_db(bind=None) -> None:
    """Create tables, seed reference data, restore the clock offset."""
    bind = bind or engine
    Base.metadata.create_all(bind)
    with Session(bind) as db:
        seed_reference_data(db)
        db.commit()
        clock.load(db)


def reset_db(bind=None) -> None:
    """Drop everything and re-create with reference data only; resets the clock."""
    bind = bind or engine
    Base.metadata.drop_all(bind)
    clock.reset()
    init_db(bind)
