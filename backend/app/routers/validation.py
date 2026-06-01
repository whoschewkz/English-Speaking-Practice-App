from sqlalchemy import select as sa_select, desc
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime

from ..database import get_db
from ..models import SessionRecordORM, RaterAssessmentORM
from ..schemas import RaterAssessmentIn, SessionForRatingOut
from ..auth import require_admin

router = APIRouter(prefix="/admin/validation")


@router.get("/sessions")
def list_sessions_for_rating(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = 100,
):
    """List sessions available for rater assessment."""
    sessions = db.execute(
        sa_select(SessionRecordORM)
        .where(SessionRecordORM.audio_path.isnot(None))
        .order_by(desc(SessionRecordORM.created_at))
        .limit(limit)
    ).scalars().all()

    result = []
    for s in sessions:
        # Get rater assessments for this session
        assessments = db.execute(
            sa_select(RaterAssessmentORM).where(RaterAssessmentORM.session_id == s.id)
        ).scalars().all()

        rater_scores = {}
        for a in assessments:
            rater_id = a.rater_id
            rater_scores[rater_id] = {
                "range": a.score_range,
                "accuracy": a.score_accuracy,
                "fluency": a.score_fluency,
                "coherence": a.score_coherence,
                "interaction": a.score_interaction,
            }

        result.append({
            "id": s.id,
            "user_id": s.user_id,
            "scenario": s.scenario,
            "audio_path": s.audio_path,
            "duration_min": s.duration_min,
            "created_at": s.created_at.isoformat(),
            "ai_scores": {
                "range": round(s.score_range, 2),
                "accuracy": round(s.score_accuracy, 2),
                "fluency": round(s.score_fluency, 2),
                "coherence": round(s.score_coherence, 2),
                "interaction": round(s.score_interaction, 2),
                "overall": round(s.score_overall, 2),
            },
            "rater_scores": rater_scores,
            "rating_status": {
                "rater_1_done": 1 in rater_scores,
                "rater_2_done": 2 in rater_scores,
                "both_done": len(rater_scores) == 2,
            }
        })

    return result


@router.post("/assessments")
def save_assessment(
    payload: RaterAssessmentIn,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Save rater assessment for a session."""
    session = db.get(SessionRecordORM, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session tidak ditemukan")

    # Check if assessment already exists for this rater
    existing = db.execute(
        sa_select(RaterAssessmentORM).where(
            RaterAssessmentORM.session_id == payload.session_id,
            RaterAssessmentORM.rater_id == payload.rater_id,
        )
    ).scalar_one_or_none()

    if existing:
        # Update existing
        existing.score_range = payload.score_range
        existing.score_accuracy = payload.score_accuracy
        existing.score_fluency = payload.score_fluency
        existing.score_coherence = payload.score_coherence
        existing.score_interaction = payload.score_interaction
        existing.notes = payload.notes
        existing.rated_at = datetime.utcnow()
        db.add(existing)
    else:
        # Create new
        assessment = RaterAssessmentORM(
            session_id=payload.session_id,
            rater_id=payload.rater_id,
            score_range=payload.score_range,
            score_accuracy=payload.score_accuracy,
            score_fluency=payload.score_fluency,
            score_coherence=payload.score_coherence,
            score_interaction=payload.score_interaction,
            notes=payload.notes,
        )
        db.add(assessment)

    db.commit()
    return {"ok": True, "session_id": payload.session_id, "rater_id": payload.rater_id}


@router.get("/correlations")
def calculate_correlations(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Calculate correlation between AI scores and human raters."""
    from scipy import stats

    sessions = db.execute(
        sa_select(SessionRecordORM)
        .where(SessionRecordORM.audio_path.isnot(None))
    ).scalars().all()

    dimensions = ["range", "accuracy", "fluency", "coherence", "interaction"]
    result = {
        "ai_vs_rater1": {},
        "ai_vs_rater2": {},
        "rater1_vs_rater2": {},
        "sample_size": 0,
        "timestamp": datetime.utcnow().isoformat(),
    }

    ai_scores  = {d: [] for d in dimensions}
    r1_scores  = {d: [] for d in dimensions}
    r2_scores  = {d: [] for d in dimensions}
    avg_scores = {d: [] for d in dimensions}  # rata-rata kedua rater sebagai ground truth

    for s in sessions:
        assessments = db.execute(
            sa_select(RaterAssessmentORM).where(RaterAssessmentORM.session_id == s.id)
        ).scalars().all()

        rater_map = {a.rater_id: a for a in assessments}
        if not rater_map:
            continue

        has_r1 = 1 in rater_map
        has_r2 = 2 in rater_map

        if has_r1 and has_r2:
            result["sample_size"] += 1
            for d in dimensions:
                ai_val = getattr(s, f"score_{d}")
                r1_val = getattr(rater_map[1], f"score_{d}")
                r2_val = getattr(rater_map[2], f"score_{d}")

                if all(v is not None for v in [ai_val, r1_val, r2_val]):
                    ai_scores[d].append(ai_val)
                    r1_scores[d].append(r1_val)
                    r2_scores[d].append(r2_val)
                    avg_scores[d].append((r1_val + r2_val) / 2)

    import math

    result["ai_vs_avg_rater"] = {}

    def safe_spearman(x, y):
        """Spearman ρ — tidak berasumsi normalitas, cocok untuk data ordinal skala 1–5."""
        if len(x) < 3:
            return None
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            r, p = stats.spearmanr(x, y)
        if math.isnan(r) or math.isinf(r):
            return None
        return round(float(r), 3), round(float(p), 4)

    # Hitung Spearman ρ per dimensi untuk semua kombinasi
    for d in dimensions:
        n = len(ai_scores[d])
        if n < 3:
            entry = {"r": None, "n": n, "insufficient": True}
            result["ai_vs_rater1"][d]    = entry
            result["ai_vs_rater2"][d]    = entry
            result["rater1_vs_rater2"][d] = entry
            result["ai_vs_avg_rater"][d] = entry
            continue

        res_ai_r1  = safe_spearman(ai_scores[d],  r1_scores[d])
        res_ai_r2  = safe_spearman(ai_scores[d],  r2_scores[d])
        res_r1_r2  = safe_spearman(r1_scores[d],  r2_scores[d])
        res_ai_avg = safe_spearman(ai_scores[d],  avg_scores[d])

        result["ai_vs_rater1"][d]     = {"r": res_ai_r1[0],  "p_value": res_ai_r1[1],  "n": n} if res_ai_r1  else {"r": None, "n": n, "insufficient": True}
        result["ai_vs_rater2"][d]     = {"r": res_ai_r2[0],  "p_value": res_ai_r2[1],  "n": n} if res_ai_r2  else {"r": None, "n": n, "insufficient": True}
        result["rater1_vs_rater2"][d] = {"r": res_r1_r2[0],  "p_value": res_r1_r2[1],  "n": n} if res_r1_r2  else {"r": None, "n": n, "insufficient": True}
        result["ai_vs_avg_rater"][d]  = {"r": res_ai_avg[0], "p_value": res_ai_avg[1], "n": n} if res_ai_avg else {"r": None, "n": n, "insufficient": True}

    # Overall (gabungkan semua dimensi)
    all_ai  = [v for vals in ai_scores.values()  for v in vals]
    all_r1  = [v for vals in r1_scores.values()  for v in vals]
    all_r2  = [v for vals in r2_scores.values()  for v in vals]
    all_avg = [v for vals in avg_scores.values() for v in vals]

    if len(all_ai) >= 3:
        n_all = len(all_ai)
        for key, x, y in [
            ("ai_vs_rater1",    all_ai, all_r1),
            ("ai_vs_rater2",    all_ai, all_r2),
            ("rater1_vs_rater2",all_r1, all_r2),
            ("ai_vs_avg_rater", all_ai, all_avg),
        ]:
            res = safe_spearman(x, y)
            if res:
                result[key]["overall"] = {"r": res[0], "p_value": res[1], "n": n_all}

    return result
