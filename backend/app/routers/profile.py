from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import require_user
from ..utils import ensure_profile

router = APIRouter()


@router.get("/profile")
def get_profile(
    current_user: dict = Depends(require_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["sub"])
    prof    = ensure_profile(db, user_id=user_id)
    return {
        "user_id":        prof.user_id,
        "level":          prof.level,
        "target_cefr":    prof.target_cefr,
        "sessions_count": prof.sessions_count,
        "ma": {
            "range":     round(prof.ma_range, 2),
            "accuracy":  round(prof.ma_accuracy, 2),
            "fluency":   round(prof.ma_fluency, 2),
            "coherence": round(prof.ma_coherence, 2),
            "phonology": round(prof.ma_phonology, 2),
            "overall":   round(prof.ma_overall, 2),
        },
    }
