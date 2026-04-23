from math import fsum

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select as sa_select, func, desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SessionRecordORM
from ..schemas import SaveSessionIn
from ..auth import require_user
from ..utils import ensure_profile, _clip1to5, _ma_update, _adjust_level

router = APIRouter()


@router.get("/sessions/recent")
def get_recent_sessions(
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(require_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["sub"])
    if current_user["role"] == "admin":
        query = sa_select(SessionRecordORM).order_by(desc(SessionRecordORM.created_at)).limit(limit)
    else:
        query = (
            sa_select(SessionRecordORM)
            .where(SessionRecordORM.user_id == user_id)
            .order_by(desc(SessionRecordORM.created_at))
            .limit(limit)
        )
    rows = db.execute(query).scalars().all()
    return [
        {"id": r.id, "scenario": r.scenario, "score_overall": r.score_overall or 0.0,
         "created_at": r.created_at.isoformat()}
        for r in rows
    ]


@router.post("/sessions")
def save_session(
    payload: SaveSessionIn,
    current_user: dict = Depends(require_user),
    db: Session = Depends(get_db),
):
    # User id dari token (bukan dari payload — cegah IDOR)
    user_id = int(current_user["sub"])
    overall = _clip1to5(fsum([
        payload.score_range, payload.score_accuracy, payload.score_fluency,
        payload.score_coherence, payload.score_phonology
    ]) / 5.0)

    row = SessionRecordORM(
        user_id=user_id,
        scenario=payload.scenario,
        score_range=_clip1to5(payload.score_range),
        score_accuracy=_clip1to5(payload.score_accuracy),
        score_fluency=_clip1to5(payload.score_fluency),
        score_coherence=_clip1to5(payload.score_coherence),
        score_phonology=_clip1to5(payload.score_phonology),
        score_overall=overall,
        comment=(payload.comment or ""),
        duration_min=float(payload.duration_min or 0.0),
        audio_path=payload.audio_path,
    )
    db.add(row); db.commit(); db.refresh(row)

    prof = ensure_profile(db, user_id=user_id)
    old_count = prof.sessions_count
    prof.ma_range     = _ma_update(prof.ma_range,     row.score_range,     old_count)
    prof.ma_accuracy  = _ma_update(prof.ma_accuracy,  row.score_accuracy,  old_count)
    prof.ma_fluency   = _ma_update(prof.ma_fluency,   row.score_fluency,   old_count)
    prof.ma_coherence = _ma_update(prof.ma_coherence, row.score_coherence, old_count)
    prof.ma_phonology = _ma_update(prof.ma_phonology, row.score_phonology, old_count)
    prof.ma_overall   = _ma_update(prof.ma_overall,   row.score_overall,   old_count)
    prof.sessions_count = old_count + 1
    _adjust_level(prof)
    db.add(prof); db.commit(); db.refresh(prof)

    return {
        "id": row.id, "saved": True,
        "profile": {
            "level": prof.level,
            "ma": {
                "range":     round(prof.ma_range, 2),
                "accuracy":  round(prof.ma_accuracy, 2),
                "fluency":   round(prof.ma_fluency, 2),
                "coherence": round(prof.ma_coherence, 2),
                "phonology": round(prof.ma_phonology, 2),
                "overall":   round(prof.ma_overall, 2),
            },
            "sessions_count": prof.sessions_count,
        },
    }


@router.get("/sessions/stats")
def sessions_stats(
    current_user: dict = Depends(require_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["sub"])
    if current_user["role"] == "admin":
        total_min      = db.execute(sa_select(func.coalesce(func.sum(SessionRecordORM.duration_min), 0.0))).scalar_one()
        total_sessions = db.execute(sa_select(func.count(SessionRecordORM.id))).scalar_one()
    else:
        total_min      = db.execute(
            sa_select(func.coalesce(func.sum(SessionRecordORM.duration_min), 0.0))
            .where(SessionRecordORM.user_id == user_id)
        ).scalar_one()
        total_sessions = db.execute(
            sa_select(func.count(SessionRecordORM.id))
            .where(SessionRecordORM.user_id == user_id)
        ).scalar_one()

    total_hours = float(total_min or 0.0) / 60.0
    return {
        "total_minutes":  float(total_min or 0.0),
        "total_hours":    round(total_hours, 2),
        "sessions_count": int(total_sessions or 0),
    }
