from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import select as sa_select, asc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import UserORM, ScenarioORM, SessionRecordORM, ProfileORM
from ..schemas import ScenarioIn
from ..auth import require_admin

router = APIRouter(prefix="/admin")


@router.get("/users")
def admin_list_users(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.execute(sa_select(UserORM).order_by(asc(UserORM.id))).scalars().all()
    return [
        {
            "id": u.id, "username": u.username, "email": u.email,
            "full_name": u.full_name, "role": u.role, "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        }
        for u in users
    ]


@router.patch("/users/{user_id}")
def admin_update_user(
    user_id: int,
    body: dict = Body(...),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(UserORM, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    allowed = {"role", "is_active", "full_name"}
    for key, val in body.items():
        if key in allowed:
            setattr(user, key, val)
    db.commit(); db.refresh(user)
    return {"ok": True, "user": {"id": user.id, "username": user.username,
                                  "role": user.role, "is_active": user.is_active}}


@router.get("/scenarios")
def admin_list_scenarios(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = db.execute(sa_select(ScenarioORM).order_by(asc(ScenarioORM.id))).scalars().all()
    return [{"id": r.id, "title": r.title, "description": r.description} for r in rows]


@router.patch("/sessions/{session_id}/rater-visibility")
def toggle_rater_visibility(
    session_id: int,
    body: dict = Body(...),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    session = db.get(SessionRecordORM, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    session.rater_visible = bool(body.get("rater_visible", True))
    db.commit()
    return {"ok": True, "session_id": session_id, "rater_visible": session.rater_visible}


@router.post("/scenarios", status_code=201)
def admin_create_scenario(
    payload: ScenarioIn,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = ScenarioORM(title=payload.title.strip(), description=(payload.description or "").strip())
    db.add(row); db.commit(); db.refresh(row)
    return {"id": row.id, "title": row.title, "description": row.description}


@router.patch("/scenarios/{scenario_id}")
def admin_update_scenario(
    scenario_id: int,
    payload: ScenarioIn,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = db.get(ScenarioORM, scenario_id)
    if not row:
        raise HTTPException(status_code=404, detail="Skenario tidak ditemukan")
    row.title       = payload.title.strip()
    row.description = (payload.description or "").strip()
    db.commit(); db.refresh(row)
    return {"id": row.id, "title": row.title, "description": row.description}


@router.delete("/scenarios/{scenario_id}")
def admin_delete_scenario(
    scenario_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = db.get(ScenarioORM, scenario_id)
    if not row:
        raise HTTPException(status_code=404, detail="Skenario tidak ditemukan")
    db.delete(row); db.commit()
    return {"ok": True}


def _aggregate_by_date(sessions: list) -> list:
    """Aggregate sessions by date (DD/MM format)"""
    from collections import defaultdict
    by_date = defaultdict(list)
    for s in sessions:
        date_key = s.created_at.strftime("%d/%m")
        by_date[date_key].append(s)

    result = []
    for date_key in sorted(by_date.keys()):
        day_sessions = by_date[date_key]
        result.append({
            "date": date_key,
            "sessions_on_day": len(day_sessions),
            "overall": round(sum(s.score_overall for s in day_sessions) / len(day_sessions), 2),
            "range": round(sum(s.score_range for s in day_sessions) / len(day_sessions), 2),
            "accuracy": round(sum(s.score_accuracy for s in day_sessions) / len(day_sessions), 2),
            "fluency": round(sum(s.score_fluency for s in day_sessions) / len(day_sessions), 2),
            "coherence": round(sum(s.score_coherence for s in day_sessions) / len(day_sessions), 2),
            "interaction": round(sum(s.score_interaction for s in day_sessions) / len(day_sessions), 2),
            "total_min": round(sum(s.duration_min or 0 for s in day_sessions), 1),
            "scenarios": [s.scenario for s in day_sessions],
        })
    return result


@router.get("/analytics")
def admin_analytics(
    view: str = "session",  # 'session' or 'daily'
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.execute(
        sa_select(UserORM).where(UserORM.role == "user").order_by(asc(UserORM.id))
    ).scalars().all()

    result = []
    for u in users:
        prof_rows = db.execute(
            sa_select(ProfileORM).where(ProfileORM.user_id == u.id).order_by(asc(ProfileORM.id))
        ).scalars().all()
        prof = prof_rows[0] if prof_rows else None

        sessions = db.execute(
            sa_select(SessionRecordORM)
            .where(SessionRecordORM.user_id == u.id)
            .order_by(asc(SessionRecordORM.created_at))
            .limit(30)
        ).scalars().all()

        total_min = sum(s.duration_min or 0 for s in sessions)

        # Build score_trend based on view parameter
        if view == "daily":
            score_trend = _aggregate_by_date(sessions)
        else:  # default 'session'
            score_trend = [
                {
                    "session":  i + 1,
                    "overall":  round(s.score_overall, 2),
                    "range":    round(s.score_range, 2),
                    "accuracy": round(s.score_accuracy, 2),
                    "fluency":  round(s.score_fluency, 2),
                    "coherence":round(s.score_coherence, 2),
                    "interaction":round(s.score_interaction, 2),
                    "date":     s.created_at.strftime("%d/%m"),
                    "scenario": s.scenario,
                }
                for i, s in enumerate(sessions)
            ]

        result.append({
            "user_id":       u.id,
            "username":      u.username,
            "full_name":     u.full_name or u.username,
            "is_active":     u.is_active,
            "last_login":    u.last_login_at.isoformat() if u.last_login_at else None,
            "sessions_count": len(sessions),
            "total_min":     round(total_min, 1),
            "level":         prof.level if prof else 1,
            "target_cefr":   prof.target_cefr if prof else "B1",
            "view_mode":     view,
            "ma": {
                "range":     round(prof.ma_range, 2)     if prof else 3.0,
                "accuracy":  round(prof.ma_accuracy, 2)  if prof else 3.0,
                "fluency":   round(prof.ma_fluency, 2)   if prof else 3.0,
                "coherence": round(prof.ma_coherence, 2) if prof else 3.0,
                "interaction": round(prof.ma_interaction, 2) if prof else 3.0,
                "overall":   round(prof.ma_overall, 2)   if prof else 3.0,
            },
            "score_trend": score_trend,
        })

    result.sort(key=lambda x: x["ma"]["overall"], reverse=True)
    return result
