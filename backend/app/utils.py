import asyncio
import json
import re
from math import fsum

from sqlalchemy import select as sa_select, asc
from sqlalchemy.orm import Session

from .config import GROQ_API_KEY
from .models import ProfileORM


# ===== Groq Retry Helper =====

async def groq_post_with_retry(
    client,
    url: str,
    *,
    max_retries: int = 3,
    **kwargs,
):
    """
    POST ke Groq API dengan retry otomatis saat kena rate limit (429).
    Pakai exponential backoff: 2s, 4s, 8s — user tidak sadar ada delay.
    """
    delay = 2.0
    for attempt in range(max_retries + 1):
        r = await client.post(url, **kwargs)
        if r.status_code != 429:
            return r
        if attempt == max_retries:
            break
        retry_after = float(r.headers.get("retry-after", delay))
        wait = max(retry_after, delay)
        print(f"[GROQ] Rate limit hit, retry {attempt+1}/{max_retries} in {wait:.1f}s", flush=True)
        await asyncio.sleep(wait)
        delay *= 2   # exponential backoff
    return r   # kembalikan response 429 terakhir kalau semua retry habis


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
    """System context untuk AI — TIDAK ditampilkan ke user."""
    level_text = {
        1: "Beginner (A1-A2)",
        2: "Pre-Intermediate (A2-B1)",
        3: "Intermediate (B1-B2)",
        4: "Upper-Intermediate (B2)",
        5: "Advanced (C1)",
    }.get(level, "Intermediate")
    tips = {
        "range":     "Challenge the learner to use 2-3 new vocabulary items and collocations.",
        "accuracy":  "Gently correct grammatical errors and encourage precise sentence structures.",
        "fluency":   "Encourage continuous speech; prompt the learner to elaborate without long pauses.",
        "coherence": "Guide the learner to organize ideas with clear topic sentences and connectors.",
        "phonology": "Pay attention to pronunciation; provide gentle corrections on word stress and intonation.",
    }
    return (
        f"Student level: {level_text}. Today's focus: {focus}.\n"
        f"{tips.get(focus, 'Encourage clear and natural speech.')}\n"
        f"Adjust your vocabulary and sentence complexity to match the student's level. "
        f"Keep your replies short (2-4 sentences) and always ask ONE follow-up question."
    )


# Opening messages yang natural dan sesuai level — DITAMPILKAN ke user sebagai pesan pertama AI
_AGENT_OPENINGS: dict[int, dict[str, str]] = {
    1: {  # A1-A2: sangat sederhana
        "range":     "Hi! Let's practice English today. Tell me — what do you do every day? Use simple words!",
        "accuracy":  "Hello! Let's talk in English. Can you tell me your name and where you live?",
        "fluency":   "Hi! Just speak freely — don't worry about mistakes. What do you usually do after school or work?",
        "coherence": "Hello! Tell me about yesterday. What did you do? Step by step.",
        "phonology": "Hi! Let's practice speaking clearly. Say this: 'I enjoy learning English.' Now tell me — what is your favorite food?",
    },
    2: {  # A2-B1: sederhana tapi berkembang
        "range":     "Hello! Let's build your vocabulary today. Can you describe your typical week using as many different words as you can?",
        "accuracy":  "Welcome! Let's practice speaking accurately. Tell me about your studies or work — use complete sentences.",
        "fluency":   "Hi! Keep talking without stopping. What do you enjoy doing on weekends, and why?",
        "coherence": "Hello! Let's organize our ideas. Can you explain what you did last week, step by step?",
        "phonology": "Welcome! Focus on speaking clearly. Can you describe your hometown — its streets, people, and atmosphere?",
    },
    3: {  # B1-B2: menengah
        "range":     "Hello! Today we'll work on expanding your vocabulary range. Could you describe a memorable experience using varied, precise words?",
        "accuracy":  "Welcome! Let's focus on grammatical accuracy. Can you explain your career goals or academic plans in detail?",
        "fluency":   "Hi! Aim for smooth, continuous speech today. Tell me about a recent challenge you faced — keep talking!",
        "coherence": "Hello! Let's practice structured ideas. What are the advantages and disadvantages of social media?",
        "phonology": "Welcome! Let's work on accurate pronunciation. What is your opinion on how technology affects daily life?",
    },
    4: {  # B2: lanjutan
        "range":     "Welcome! This session targets sophisticated vocabulary. How has your field of study or work changed in recent years?",
        "accuracy":  "Hello! Let's use complex grammatical structures. Could you analyze the causes and effects of a social issue you care about?",
        "fluency":   "Hi! Let's aim for spontaneous, natural speech. What are your views on balancing tradition with modern lifestyles?",
        "coherence": "Welcome! Let's practice well-argued discourse. Present a case for or against remote work in the modern economy.",
        "phonology": "Hello! Let's refine your pronunciation. Tell me about a cross-cultural experience that changed your perspective.",
    },
    5: {  # C1: mahir
        "range":     "Welcome! This advanced session focuses on lexical precision. How are emerging technologies reshaping professional communication?",
        "accuracy":  "Hello! Let's engage with complex language. What are the ethical implications of artificial intelligence in decision-making?",
        "fluency":   "Hi! Aim for natural, C1-level fluency. Share your analysis of globalization's impact on cultural identity.",
        "coherence": "Welcome! Let's construct sophisticated arguments. What is your nuanced perspective on the future of higher education?",
        "phonology": "Hello! Let's polish your pronunciation. Discuss sociolinguistic factors that influence how people acquire a second language.",
    },
}


def _make_agent_opening(focus: str, level: int, scenario: str) -> str:
    """Pesan pembuka percakapan yang natural, adaptif sesuai level dan fokus."""
    level_clamped = max(1, min(5, level))
    focus_key = focus if focus in ("range", "accuracy", "fluency", "coherence", "phonology") else "fluency"
    return _AGENT_OPENINGS.get(level_clamped, _AGENT_OPENINGS[3]).get(
        focus_key,
        f"Welcome to {scenario}! Let's start practicing. What topic would you like to explore today?"
    )
