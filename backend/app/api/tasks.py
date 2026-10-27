"""Task mutation endpoints (thin: validate -> service -> return)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import TaskOut
from app.services import routing

router = APIRouter()


@router.post("/tasks/{task_id}/start", response_model=TaskOut)
def start_task(task_id: int, db: Session = Depends(get_db)):
    task = routing.start_task(db, task_id)
    db.commit()
    return TaskOut.from_task(task)
