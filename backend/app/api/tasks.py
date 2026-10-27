"""Task mutation endpoints (thin: validate -> service -> return)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Task
from app.schemas import ClosureIn, ClosureResultOut, TaskOut, VerifyResultOut, VerifyResponseIn
from app.services import routing, verification

router = APIRouter()


@router.post("/tasks/{task_id}/start", response_model=TaskOut)
def start_task(task_id: int, db: Session = Depends(get_db)):
    task = routing.start_task(db, task_id)
    db.commit()
    return TaskOut.from_task(task)


@router.post("/tasks/{task_id}/close", response_model=ClosureResultOut)
def close_task(task_id: int, body: ClosureIn, db: Session = Depends(get_db)):
    closure = verification.submit_closure(db, task_id, **body.model_dump())
    db.commit()
    return {"closure": closure, "task": TaskOut.from_task(db.get(Task, task_id))}


@router.post("/tasks/{task_id}/verify-response", response_model=VerifyResultOut)
def verify_response(task_id: int, body: VerifyResponseIn, db: Session = Depends(get_db)):
    req = verification.record_response(db, task_id, body.report_id, body.fixed, body.comment)
    db.commit()
    return {"verification": req, "task": TaskOut.from_task(db.get(Task, task_id))}
