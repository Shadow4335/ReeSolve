import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import clock
from app.db import seed_reference_data
from app.models import Base


@pytest.fixture(autouse=True)
def _fresh_clock():
    clock.reset()
    yield
    clock.reset()


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        seed_reference_data(session)
        session.commit()
        yield session
