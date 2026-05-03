from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select as sa_select, desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SessionRecordORM, RaterAssessmentORM
from ..schemas import RaterAssessmentIn
from ..auth import require_rater

router = APIRouter(prefix="/rater")


def _rater_id_from_role(role: str) -> int:
    """rater1 → 1, rater2 → 2. Role sudah divalidasi oleh require_rater."""
    return 1 if role == "rater1" else 2


@router.get("/sessions")
def rater_list_sessions(
    current_user: dict = Depends(require_rater),
    db: Session = Depends(get_db),
    limit: int = 100,
):
    """Sessions untuk rater — skor AI disembunyikan, status rater lain juga disembunyikan."""
    my_id = _rater_id_from_role(current_user.get("role", "rater1"))

    sessions = db.execute(
        sa_select(SessionRecordORM)
        .where(SessionRecordORM.audio_path.isnot(None))
        .order_by(desc(SessionRecordORM.created_at))
        .limit(limit)
    ).scalars().all()

    result = []
    for s in sessions:
        my_assessment = db.execute(
            sa_select(RaterAssessmentORM).where(
                RaterAssessmentORM.session_id == s.id,
                RaterAssessmentORM.rater_id   == my_id,
            )
        ).scalar_one_or_none()

        result.append({
            "id":             s.id,
            "scenario":       s.scenario,
            "audio_path":     s.audio_path,
            "duration_min":   s.duration_min,
            "created_at":     s.created_at.isoformat(),
            # Tidak ada ai_scores, tidak ada info rater lain
            "my_rater_id":    my_id,
            "my_rating_done": my_assessment is not None,
        })
    return result


@router.post("/assessments")
def rater_save_assessment(
    payload: RaterAssessmentIn,
    current_user: dict = Depends(require_rater),
    db: Session = Depends(get_db),
):
    """rater_id di-override dari role login — tidak bisa dimanipulasi dari request body."""
    rater_id = _rater_id_from_role(current_user.get("role", "rater1"))

    session = db.get(SessionRecordORM, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session tidak ditemukan")

    existing = db.execute(
        sa_select(RaterAssessmentORM).where(
            RaterAssessmentORM.session_id == payload.session_id,
            RaterAssessmentORM.rater_id   == rater_id,
        )
    ).scalar_one_or_none()

    if existing:
        existing.score_range     = payload.score_range
        existing.score_accuracy  = payload.score_accuracy
        existing.score_fluency   = payload.score_fluency
        existing.score_coherence = payload.score_coherence
        existing.score_phonology = payload.score_phonology
        existing.notes           = payload.notes
        existing.rated_at        = datetime.utcnow()
        db.add(existing)
    else:
        db.add(RaterAssessmentORM(
            session_id      = payload.session_id,
            rater_id        = rater_id,
            score_range     = payload.score_range,
            score_accuracy  = payload.score_accuracy,
            score_fluency   = payload.score_fluency,
            score_coherence = payload.score_coherence,
            score_phonology = payload.score_phonology,
            notes           = payload.notes,
        ))
    db.commit()
    return {"ok": True, "session_id": payload.session_id, "rater_id": rater_id}
