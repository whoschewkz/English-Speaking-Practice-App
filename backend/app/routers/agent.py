import json
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select as sa_select, asc, desc, text
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import PlanORM, PlanItemORM, ErrorPatternORM, VocabTargetORM
from ..schemas import CompleteIn, ReflectIn, ReflectOut, PlanIn, PlanGenOut
from ..auth import require_user
from ..utils import (
    ensure_profile,
    _weak_focus_from_profile,
    _suggest_scenario_for_focus,
    _make_prompt,
    _make_agent_opening,
    _groq_json_chat,
)

router = APIRouter(prefix="/agent")


@router.get("/next")
def agent_next(
    current_user: dict = Depends(require_user),
    db: Session = Depends(get_db),
):
    user_id      = int(current_user["sub"])
    prof         = ensure_profile(db, user_id=user_id)
    focus        = _weak_focus_from_profile(prof)
    scenario     = _suggest_scenario_for_focus(focus)
    system_ctx   = _make_prompt(focus, prof.level)          # instruksi internal AI
    opening      = _make_agent_opening(focus, prof.level, scenario)  # pesan percakapan user

    plan = db.execute(
        sa_select(PlanORM)
        .where(PlanORM.user_id == user_id, PlanORM.active == True)
        .order_by(desc(PlanORM.start_date))
    ).scalar_one_or_none()
    if not plan:
        plan = PlanORM(user_id=user_id, title="Auto Plan", goal_text="Improve speaking skills adaptively.")
        db.add(plan); db.commit(); db.refresh(plan)

    item = db.execute(
        sa_select(PlanItemORM)
        .where(PlanItemORM.plan_id == plan.id, PlanItemORM.done == False)
        .order_by(asc(PlanItemORM.order_idx))
    ).scalar_one_or_none()

    if not item:
        last_idx = db.execute(
            sa_select(text("COALESCE(MAX(order_idx),-1)"))
            .select_from(PlanItemORM)
            .where(PlanItemORM.plan_id == plan.id)
        ).scalar_one()
        item = PlanItemORM(
            plan_id=plan.id, order_idx=(last_idx + 1),
            scenario=scenario, focus=focus, level=prof.level,
            prompt=opening,  # simpan opening (bukan instruksi)
        )
        db.add(item); db.commit(); db.refresh(item)

    return {
        "item_id":      item.id,
        "scenario":     item.scenario,
        "level":        item.level,
        "focus":        focus,
        "prompt":       opening,      # pesan pertama yang ditampilkan ke user
        "system_ctx":   system_ctx,   # instruksi internal untuk AI
    }


@router.post("/complete")
def agent_complete(
    payload: CompleteIn,
    current_user: dict = Depends(require_user),
    db: Session = Depends(get_db),
):
    item = db.get(PlanItemORM, payload.item_id)
    if not item:
        return JSONResponse({"error": "item_not_found"}, status_code=404)
    item.done = bool(payload.done)
    db.add(item); db.commit(); db.refresh(item)
    return {"ok": True, "item": {"id": item.id, "done": item.done}}


@router.post("/reflect", response_model=ReflectOut)
async def agent_reflect(
    payload: ReflectIn,
    current_user: dict = Depends(require_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["sub"])
    system  = {
        "role": "system",
        "content": (
            "You are an English speaking coach (critic). Return STRICT JSON only:\n"
            '{"summary":"3-5 sentences","error_patterns":[{"tag":"...","description":"...","examples":["..."],"weight":0}],'
            '"vocab_targets":[{"topic":"...","items":["..."]}],"objectives_next":["..."]}\nNo extra text.'
        ),
    }
    msgs     = [m.dict() for m in payload.messages][-60:]
    user_msg = {"role": "user", "content": json.dumps({"dialogue": msgs, "feedback": payload.feedback}, ensure_ascii=False)}
    data     = await _groq_json_chat([system, user_msg], temperature=0.2)
    out      = {
        "summary":         (data.get("summary") or "")[:2000],
        "error_patterns":  data.get("error_patterns", [])[:5],
        "vocab_targets":   data.get("vocab_targets", [])[:2],
        "objectives_next": data.get("objectives_next", [])[:5],
    }

    for ep in out["error_patterns"]:
        tag = (ep.get("tag") or "misc").strip()[:64]
        row = db.execute(
            sa_select(ErrorPatternORM).where(ErrorPatternORM.user_id == user_id, ErrorPatternORM.tag == tag)
        ).scalar_one_or_none()
        if not row:
            row = ErrorPatternORM(
                user_id=user_id, tag=tag,
                description=(ep.get("description") or "")[:2000],
                examples="\n".join(ep.get("examples", [])[:5]),
                weight=float(ep.get("weight") or 1.0),
            )
        else:
            row.description = (ep.get("description") or row.description)[:2000]
            if ep.get("examples"): row.examples = "\n".join(ep.get("examples", [])[:5])
            try: row.weight = float(ep.get("weight") or row.weight)
            except: pass
            row.last_seen_at = datetime.utcnow()
        db.add(row)

    for vt in out["vocab_targets"]:
        db.add(VocabTargetORM(
            user_id=user_id,
            topic=(vt.get("topic") or "general")[:128],
            items="\n".join(vt.get("items", [])[:10]),
            due_next=True,
        ))
    db.commit()
    return out


@router.post("/plan", response_model=PlanGenOut)
async def agent_plan(
    payload: PlanIn,
    current_user: dict = Depends(require_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["sub"])
    prof    = ensure_profile(db, user_id=user_id)
    profile = payload.profile or {
        "level": prof.level,
        "ma": {
            "range":     prof.ma_range,
            "accuracy":  prof.ma_accuracy,
            "fluency":   prof.ma_fluency,
            "coherence": prof.ma_coherence,
            "interaction": prof.ma_interaction,
            "overall":   prof.ma_overall,
        },
    }
    context = {
        "profile":         profile,
        "error_patterns":  payload.error_patterns,
        "objectives_next": payload.objectives_next,
        "vocab_targets":   payload.vocab_targets,
    }
    system = {
        "role": "system",
        "content": (
            "You are a session planner. Produce JSON only:\n"
            '{"scenario":"...","level":1..5,"objectives":["..."],"rubric":["..."],"starter_turns":["..."],"target_time_min":5}\n'
            "No extra text."
        ),
    }
    plan = await _groq_json_chat(
        [system, {"role": "user", "content": json.dumps(context, ensure_ascii=False)}],
        temperature=0.3,
    )
    prof.last_objectives = "\n".join((plan.get("objectives") or [])[:6])
    db.add(prof); db.commit()
    return {
        "scenario":        plan.get("scenario", "Daily Conversation"),
        "level":           int(plan.get("level", profile.get("level", 2))),
        "objectives":      (plan.get("objectives") or [])[:6],
        "rubric":          (plan.get("rubric") or ["Speak clearly", "Use correct tense"])[:6],
        "starter_turns":   (plan.get("starter_turns") or ["Tell me about your day."])[:3],
        "target_time_min": int(plan.get("target_time_min", 7)),
    }
