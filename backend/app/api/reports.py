"""Report endpoints (thin: validate -> service -> return)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Report
from app.schemas import ReportIn, ReportOut, ReportResultOut
from app.services import reports as svc
from app.services.errors import NotFound

router = APIRouter()


@router.post("/reports", response_model=ReportResultOut, status_code=201)
def create_report(body: ReportIn, db: Session = Depends(get_db)):
    result = svc.submit_report(db, **body.model_dump())
    db.commit()
    return result


@router.get("/reports/{report_id}", response_model=ReportOut)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if report is None:
        raise NotFound(f"report {report_id} not found")
    return report
