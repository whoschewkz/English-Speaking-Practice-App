import json
import re
from math import fsum

from sqlalchemy import select as sa_select, asc
from sqlalchemy.orm import Session

from .config import GROQ_API_KEY
from .models import ProfileORM


# ===== Profile =====

def ensure_profile(db: Session, user_id: int = 1) -> ProfileORM:
    rows = db.execute(
        sa_select(ProfileORM).where(ProfileORM.user_id == user_id).order_by(asc(ProfileORM.id))
    ).scalars().all()

    if len(rows) == 0:
        prof = ProfileORM(user_id=user_id, level=2, target_cefr="B1")
        db.add(prof); db.commit(); db.refresh(prof)
        return prof

    if len(rows) > 1:
        keep = rows[0]
        for duplicate in rows[1:]:
            db.delete(duplicate)
        db.commit(); db.refresh(keep)
        return keep

    return rows[0]


# ===== Scoring Helpers =====

def _clip1to5(x: float, lo=1.0, hi=5.0) -> float:
    try: x = float(x)
    except Exception: x = 3.0
    return max(lo, min(hi, x))


def _ma_update(prev: float, new: float, n_prev: int, alpha: float = 0.5) -> float:
    if n_prev <= 0 or (prev is None) or prev <= 0:
        return float(new)
    return float(alpha * new + (1 - alpha) * prev)


def _adjust_level(p: ProfileORM) -> None:
    if p.sessions_count >= 3 and p.ma_overall >= 4.0 and p.level < 5:
        p.level += 1
    elif p.sessions_count >= 2 and p.ma_overall <= 2.0 and p.level > 1:
        p.level -= 1


# ===== Feedback Helpers =====

def _normalize_scores_obj(obj: dict):
    s = obj.get("scores", {}) if "scores" in obj else obj
    r = _clip1to5(s.get("range",     3.0))
    a = _clip1to5(s.get("accuracy",  3.0))
    f = _clip1to5(s.get("fluency",   3.0))
    c = _clip1to5(s.get("coherence", 3.0))
    p = _clip1to5(s.get("phonology", 3.0))
    o = s.get("overall", None)
    o = _clip1to5(fsum([r, a, f, c, p]) / 5.0) if o is None else _clip1to5(o)
    return {"scores": {"range": r, "accuracy": a, "fluency": f, "coherence": c, "phonology": p, "overall": o},
            "comment": (obj.get("comment") or "").strip()}


def _extract_json_block(text: str) -> dict | None:
    if not text: return None
    m = re.search(r"```(?:[a-zA-Z]+)?\s*(\{.*?\})\s*```", text, re.S)
    if m:
        try: return json.loads(m.group(1))
        except Exception: pass
    start = text.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{": depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try: return json.loads(text[start:i+1])
                    except Exception: break
    return None


_FILLERS = {"um","uh","erm","ah","like","you know","actually","basically","literally","sort of","kind of","so"}


def _tokenize_words(text: str):
    return re.findall(r"[A-Za-z']+", text.lower())


def _split_sentences(text: str):
    return [p.strip() for p in re.split(r"[.!?]+", text) if p.strip()]


def _count_fillers(text: str):
    t = " " + text.lower() + " "
    return sum(
        t.count(" " + f + " ") if " " in f else len(re.findall(rf"\b{re.escape(f)}\b", t))
        for f in _FILLERS
    )


def _objective_from_messages(msgs: list, duration_min: float | None) -> dict:
    user_utts   = [m.get("content","") for m in msgs if m.get("role") == "user" and isinstance(m.get("content"), str)]
    user_text   = "\n".join(user_utts)
    words       = _tokenize_words(user_text)
    total_words  = len(words)
    unique_words = len(set(words))
    ttr         = (unique_words / total_words * 100.0) if total_words > 0 else 0.0
    sents       = _split_sentences(user_text)
    avg_sent    = (total_words / len(sents)) if sents else 0.0
    fillers     = _count_fillers(user_text)
    filler_per  = (fillers / total_words * 100.0) if total_words > 0 else 0.0
    mean_utt    = (total_words / len(user_utts)) if user_utts else 0.0
    wpm         = (total_words / duration_min) if (duration_min and duration_min > 0) else None
    r = lambda x, n=2: round(float(x), n) if x is not None else None
    return {
        "total_words":      int(total_words),
        "unique_words":     int(unique_words),
        "type_token_ratio": r(ttr, 1),
        "avg_sentence_len": r(avg_sent, 2),
        "filler_per_100w":  r(filler_per, 2),
        "mean_utterance_len": r(mean_utt, 2),
        "speech_rate_wpm":  r(wpm, 1) if wpm is not None else None,
    }


# ===== Agent Helpers =====

async def _groq_json_chat(messages: list, temperature: float = 0.2) -> dict:
    if not GROQ_API_KEY: return {}
    try:
        import httpx
    except Exception: return {}
    url     = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    body    = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=body)
        if r.status_code != 200: return {}
        content = (r.json().get("choices") or [{}])[0].get("message", {}).get("content", "") or "{}"
        try: return json.loads(content)
        except: return {}


def _weak_focus_from_profile(p: ProfileORM) -> str:
    buckets = {
        "range":     p.ma_range     or 3.0,
        "accuracy":  p.ma_accuracy  or 3.0,
        "fluency":   p.ma_fluency   or 3.0,
        "coherence": p.ma_coherence or 3.0,
        "phonology": p.ma_phonology or 3.0,
    }
    return min(buckets.items(), key=lambda x: x[1])[0]


def _suggest_scenario_for_focus(focus: str) -> str:
    return {
        "range":     "Job Interview",
        "accuracy":  "Business Meeting",
        "fluency":   "Daily Conversation",
        "coherence": "Travel Situations",
        "phonology": "Daily Conversation",
    }.get(focus, "Daily Conversation")


def _make_prompt(focus: str, level: int) -> str:
    level_text = {
        1: "Beginner (A1-A2)",
        2: "Pre-Intermediate (A2-B1)",
        3: "Intermediate (B1-B2)",
        4: "Upper-Intermediate (B2)",
        5: "Advanced (C1)",
    }.get(level, "Intermediate")
    tips = {
        "range":     "Use 2-3 new vocabulary items and 1 collocation.",
        "accuracy":  "Pay careful attention to verb forms, articles, and sentence structure.",
        "fluency":   "Keep talking without long pauses; use transition phrases.",
        "coherence": "Organize your thoughts with clear topic sentences.",
        "phonology": "Speak slowly and clearly. Focus on word stress and intonation.",
    }
    return (
        f"Level: {level_text}. Focus area: {focus}.\n"
        f"Start by asking the learner a question.\n"
        f"Guideline: {tips.get(focus, 'Speak clearly.')}"
    )
