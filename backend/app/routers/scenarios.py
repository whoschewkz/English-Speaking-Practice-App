from fastapi import APIRouter, Depends
from sqlalchemy import select as sa_select, asc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ScenarioORM

router = APIRouter()


@router.get("/scenarios")
def get_scenarios(db: Session = Depends(get_db)):
    rows = db.execute(sa_select(ScenarioORM).order_by(asc(ScenarioORM.id))).scalars().all()
    return [{"id": r.id, "title": r.title, "description": r.description} for r in rows]
