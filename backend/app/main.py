# backend/app/main.py
import os, json, re
from math import fsum
from typing import List, Literal, Optional

from fastapi import FastAPI, UploadFile, File, Form, Body, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter
from pydantic import BaseModel, Field, validator

# --- load .env (optional) ---
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# ===== ENV =====
API_PREFIX = os.getenv("API_PREFIX", "/api")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
if _raw_origins.strip().startswith("["):
    try:
        ALLOWED_ORIGINS = json.loads(_raw_origins)
        if not isinstance(ALLOWED_ORIGINS, list):
            ALLOWED_ORIGINS = ["http://localhost:3000"]
    except Exception:
        ALLOWED_ORIGINS = [s.strip() for s in _raw_origins.split(",") if s.strip()]
else:
    ALLOWED_ORIGINS = [s.strip() for s in _raw_origins.split(",") if s.strip()]

# ===== Pydantic models =====
Role = Literal["system", "user", "assistant"]

class Message(BaseModel):
    role: Role
    content: str = Field(..., min_length=1)

class ChatRequest(BaseModel):
    scenarioId: Optional[str] = "custom"
    messages: List[Message] = Field(default_factory=list)

    @validator("scenarioId", pre=True)
    def _to_str(cls, v):
        return str(v) if v is not None else "custom"

# NEW: feedback input (tambahan duration_min)
class FeedbackIn(BaseModel):
    messages: List[Message] = Field(default_factory=list)
    duration_min: Optional[float] = 0.0

class PlanItemOut(BaseModel):
    id: int
    scenario: str
    focus: str
    level: int
    prompt: str
    order_idx: int
    done: bool
    class Config:
        from_attributes = True

class PlanOut(BaseModel):
    id: int
    title: str
    goal_text: str
    active: bool
    items: List[PlanItemOut]

class NextTaskOut(BaseModel):
    item_id: int
    scenario: str
    level: int
    prompt: str

# ==== DATABASE (SQLite-first) ====
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, Float, String, DateTime, Text, Boolean,
    text, select, desc, asc, func
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

DATABASE_URL = os.getenv("DATABASE_URL", "").strip() or "sqlite:///./speaking.db"

def make_engine(url: str):
    if url.startswith("sqlite"):
        return create_engine(
            url,
            pool_pre_ping=True,
            future=True,
            connect_args={"check_same_thread": False},
        )
    return create_engine(url, pool_pre_ping=True, future=True)

engine = make_engine(DATABASE_URL)
try:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
except Exception as e:
    print(f"[DB] Connection failed for {DATABASE_URL}. Falling back to SQLite. Detail: {e}")
    DATABASE_URL = "sqlite:///./speaking.db"
    engine = make_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()

# --- Tables ---
class ScenarioORM(Base):
    __tablename__ = "scenarios"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

class SessionRecordORM(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    scenario = Column(String(200), nullable=False)
    score_overall = Column(Float, nullable=False, default=0.0)
    score_pronunciation = Column(Float, nullable=True)
    score_grammar = Column(Float, nullable=True)
    score_fluency = Column(Float, nullable=True)
    score_vocabulary = Column(Float, nullable=True)
    comment = Column(Text, nullable=True)
    duration_min = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class ProfileORM(Base):
    __tablename__ = "profiles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True, default=1)
    level = Column(Integer, nullable=False, default=2)      # 1..5
    target_cefr = Column(String(8), nullable=False, default="B1")
    ma_pron = Column(Float, nullable=False, default=0.0)
    ma_gram = Column(Float, nullable=False, default=0.0)
    ma_flu  = Column(Float, nullable=False, default=0.0)
    ma_vocab= Column(Float, nullable=False, default=0.0)
    ma_overall = Column(Float, nullable=False, default=0.0)
    sessions_count = Column(Integer, nullable=False, default=0)
    # NEW (optional trace)
    last_objectives = Column(Text, nullable=True)

class PlanORM(Base):
    __tablename__ = "plans"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False, default=1)
    title = Column(String(200), nullable=False)
    goal_text = Column(Text, nullable=False)
    start_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_date = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True)

class PlanItemORM(Base):
    __tablename__ = "plan_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_id = Column(Integer, index=True, nullable=False)
    order_idx = Column(Integer, nullable=False, default=0)
    scenario = Column(String(200), nullable=False)
    focus = Column(String(50), nullable=False)
    level = Column(Integer, nullable=False, default=2)     # 1..5
    prompt = Column(Text, nullable=False)
    done = Column(Boolean, default=False)

# --- NEW: Agentic memory tables ---
class ErrorPatternORM(Base):
    __tablename__ = "error_patterns"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False, default=1)
    tag = Column(String(64), index=True, nullable=False)          # e.g. 'articles', 'tense', 'word_stress'
    description = Column(Text, nullable=False)                    # short explanation
    examples = Column(Text, nullable=True)                        # lines: "wrong -> better"
    weight = Column(Float, nullable=False, default=1.0)           # 0..3
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class VocabTargetORM(Base):
    __tablename__ = "vocab_targets"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False, default=1)
    topic = Column(String(128), nullable=False)                   # e.g. 'job_interview'
    items = Column(Text, nullable=False)                          # words/phrases separated by \n
    due_next = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class SessionSummaryORM(Base):
    __tablename__ = "session_summaries"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, index=True, nullable=False)
    user_id = Column(Integer, index=True, nullable=False, default=1)
    summary = Column(Text, nullable=False)                        # concise recap for memory
    objectives_next = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

# -- create tables --
Base.metadata.create_all(bind=engine)

# ---- lightweight auto migrations (SQLite only) ----
def sqlite_add_column_if_missing(engine, table_name: str, column_def_sql: str):
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        info = conn.exec_driver_sql(f"PRAGMA table_info({table_name})").fetchall()
        cols = {row[1] for row in info}  # row[1] = column name
        col_name = column_def_sql.strip().split()[0]
        if col_name not in cols:
            conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN {column_def_sql}")

sqlite_add_column_if_missing(engine, "profiles", "ma_overall REAL NOT NULL DEFAULT 0.0")
sqlite_add_column_if_missing(engine, "sessions", "duration_min REAL NOT NULL DEFAULT 0.0")
sqlite_add_column_if_missing(engine, "profiles", "last_objectives TEXT")
sqlite_add_column_if_missing(engine, "error_patterns", "weight REAL NOT NULL DEFAULT 1.0")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- seed scenarios if empty ---
from sqlalchemy import select as sa_select
def seed_scenarios(db: Session):
    count = db.scalar(select(text("COUNT(1) FROM scenarios")))
    if not count:
        items = [
            ScenarioORM(id=1, title="Job Interview", description="Practice answering common job interview questions"),
            ScenarioORM(id=2, title="Daily Conversation", description="Practice everyday conversations in English"),
            ScenarioORM(id=3, title="Business Meeting", description="Practice participating in business meetings"),
            ScenarioORM(id=4, title="Travel Situations", description="Practice conversations you might have while traveling"),
        ]
        for it in items:
            try:
                db.add(it)
                db.commit()
            except Exception:
                db.rollback()

with SessionLocal() as db:
    seed_scenarios(db)

# ===== App & Router =====
app = FastAPI(
    title="Speaking Practice API",
    description="API for the Speaking Practice Platform",
    version="0.8.0",
    docs_url=f"{API_PREFIX}/docs",
    redoc_url=f"{API_PREFIX}/redoc",
    openapi_url=f"{API_PREFIX}/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix=API_PREFIX)

# ===== Basic =====
@app.get("/")
async def root():
    return {"message": "Welcome to the Speaking Practice API (root)"}

@router.get("/health")
async def health_check():
    return {"status": "healthy", "origins": ALLOWED_ORIGINS, "groq_ready": bool(GROQ_API_KEY)}

# ===== Utility: ensure profile =====
def ensure_profile(db: Session, user_id: int = 1) -> ProfileORM:
    prof = db.execute(sa_select(ProfileORM).where(ProfileORM.user_id == user_id)).scalar_one_or_none()
    if not prof:
        prof = ProfileORM(user_id=user_id, level=2, target_cefr="B1")
        db.add(prof)
        db.commit()
        db.refresh(prof)
    return prof

# ===== Scenarios & Sessions endpoints =====
@router.get("/scenarios")
def get_scenarios(db: Session = Depends(get_db)):
    rows = db.execute(sa_select(ScenarioORM).order_by(asc(ScenarioORM.id))).scalars().all()
    return [{"id": r.id, "title": r.title, "description": r.description} for r in rows]

@router.get("/sessions/recent")
def get_recent_sessions(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    rows = db.execute(
        sa_select(SessionRecordORM).order_by(desc(SessionRecordORM.created_at)).limit(limit)
    ).scalars().all()
    return [
        {
            "id": r.id,
            "scenario": r.scenario,
            "score_overall": r.score_overall or 0.0,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]

class SaveSessionIn(BaseModel):
    scenario: str
    score_overall: float
    score_pronunciation: Optional[float] = None
    score_grammar: Optional[float] = None
    score_fluency: Optional[float] = None
    score_vocabulary: Optional[float] = None
    comment: Optional[str] = None
    duration_min: Optional[float] = 0.0
    user_id: Optional[int] = 1

# moving average helper
def _ma_update(prev: float, new: float, n_prev: int, alpha: float = 0.5) -> float:
    if n_prev <= 0 or (prev is None) or prev <= 0:
        return float(new)
    return float(alpha * new + (1 - alpha) * prev)

def _adjust_level(p: ProfileORM) -> None:
    # Naik: MA overall >= 7.5 dan sessions_count >= 3
    # Turun: MA overall <= 4.0 dan sessions_count >= 2
    if p.sessions_count >= 3 and p.ma_overall >= 7.5 and p.level < 5:
        p.level += 1
    elif p.sessions_count >= 2 and p.ma_overall <= 4.0 and p.level > 1:
        p.level -= 1

@router.post("/sessions")
def save_session(payload: SaveSessionIn, db: Session = Depends(get_db)):
    # 1) save session
    row = SessionRecordORM(
        scenario=payload.scenario,
        score_overall=float(payload.score_overall or 0),
        score_pronunciation=float(payload.score_pronunciation or 0),
        score_grammar=float(payload.score_grammar or 0),
        score_fluency=float(payload.score_fluency or 0),
        score_vocabulary=float(payload.score_vocabulary or 0),
        comment=(payload.comment or ""),
        duration_min=float(payload.duration_min or 0.0),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    # 2) update profile MA + level
    prof = ensure_profile(db, user_id=payload.user_id or 1)
    old_count = prof.sessions_count
    prof.ma_pron = _ma_update(prof.ma_pron, row.score_pronunciation or 0, old_count)
    prof.ma_gram = _ma_update(prof.ma_gram, row.score_grammar or 0, old_count)
    prof.ma_flu  = _ma_update(prof.ma_flu,  row.score_fluency or 0, old_count)
    prof.ma_vocab= _ma_update(prof.ma_vocab,row.score_vocabulary or 0, old_count)
    prof.ma_overall = _ma_update(prof.ma_overall, row.score_overall or 0, old_count)
    prof.sessions_count = old_count + 1

    _adjust_level(prof)

    db.add(prof)
    db.commit()
    db.refresh(prof)

    return {
        "id": row.id,
        "saved": True,
        "profile": {
            "level": prof.level,
            "ma": {
                "pronunciation": prof.ma_pron,
                "grammar": prof.ma_gram,
                "fluency": prof.ma_flu,
                "vocabulary": prof.ma_vocab,
                "overall": prof.ma_overall,
            },
            "sessions_count": prof.sessions_count,
        },
    }

@router.get("/sessions/stats")
def sessions_stats(db: Session = Depends(get_db)):
    total_min = db.execute(sa_select(func.coalesce(func.sum(SessionRecordORM.duration_min), 0.0))).scalar_one()
    total_sessions = db.execute(sa_select(func.count(SessionRecordORM.id))).scalar_one()
    total_hours = float(total_min or 0.0) / 60.0
    return {
        "total_minutes": float(total_min or 0.0),
        "total_hours": round(total_hours, 2),
        "sessions_count": int(total_sessions or 0),
    }

# ===== Transcribe (Groq Whisper) =====
@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form("en"),
):
    if not GROQ_API_KEY:
        return JSONResponse({"error": "Missing GROQ_API_KEY"}, status_code=500)
    try:
        import httpx
    except Exception as e:
        return JSONResponse({"error": "Missing dependency 'httpx'", "detail": str(e)}, status_code=500)

    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}

    file_bytes = await audio.read()
    filename = audio.filename or "speech.webm"
    content_type = audio.content_type or "audio/webm"
    files = {"file": (filename, file_bytes, content_type)}
    data = {"model": "whisper-large-v3", "language": language}

    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(url, headers=headers, files=files, data=data)
        if r.status_code != 200:
            return JSONResponse(
                {"error": "groq_transcribe_failed", "detail": r.text, "status_code": r.status_code},
                status_code=500
            )
        return r.json()

# ===== Chat (Groq Chat Completions) =====
@router.post("/chat")
async def chat(req: ChatRequest = Body(...)):
    if not GROQ_API_KEY:
        return JSONResponse({"error": "Missing GROQ_API_KEY"}, status_code=500)
    try:
        import httpx
    except Exception as e:
        return JSONResponse({"error": "Missing dependency 'httpx'", "detail": str(e)}, status_code=500)

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}

    scenario = (
        "Job Interview" if req.scenarioId == "1" else
        "Daily Conversation" if req.scenarioId == "2" else
        "Business Meeting" if req.scenarioId == "3" else
        "Travel Situations" if req.scenarioId == "4" else
        "Agent" if req.scenarioId == "agent" else
        "Custom"
    )

    system_prompt = {
        "role": "system",
        "content": (
            "You are an English speaking practice assistant for TOEFL/IELTS. "
            "Keep replies 2–5 sentences. Ask one question at a time. "
            "Add one short improvement tip at the end. "
            f"Scenario: {scenario}"
        ),
    }

    msgs = [m.dict() for m in req.messages]
    final_messages = msgs if (msgs and msgs[0].get("role") == "system") else [system_prompt, *msgs]

    body_req = {
        "model": "llama3-8b-8192",
        "messages": final_messages,
        "temperature": 0.3,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=body_req)
        if r.status_code != 200:
            return JSONResponse(
                {"error": "groq_chat_failed", "detail": r.text, "status_code": r.status_code},
                status_code=500
            )
        data = r.json()

    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return {"content": content}

# ===== Feedback helpers =====
def _clip01(x: float, lo=0.0, hi=10.0) -> float:
    try: x = float(x)
    except Exception: x = 0.0
    return max(lo, min(hi, x))

def _normalize_scores_obj(obj: dict):
    s = obj.get("scores", {}) if "scores" in obj else obj
    p = _clip01(s.get("pronunciation", 0))
    g = _clip01(s.get("grammar", 0))
    f = _clip01(s.get("fluency", 0))
    v = _clip01(s.get("vocabulary", 0))
    # optional coherence (0-10) if provided
    coh = _clip01(s.get("coherence", 0)) if "coherence" in s else 0.0
    o = s.get("overall", None)
    if o is None: o = _clip01(fsum([p, g, f, v]) / 4)
    else: o = _clip01(o)
    c = (obj.get("comment") or "").strip()
    out = {
        "scores": {
            "pronunciation": p, "grammar": g, "fluency": f, "vocabulary": v, "overall": o
        },
        "comment": c
    }
    if "coherence" in s:
        out["scores"]["coherence"] = coh
    return out

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
            ch = text[i]
            if ch == "{": depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start:i+1]
                    try: return json.loads(candidate)
                    except Exception: break
    def grab(label: str):
        m = re.search(rf"{label}\s*:\s*([0-9]+(?:\.[0-9]+)?)(?:\s*/\s*10)?", text, re.I)
        return float(m.group(1)) if m else None
    p, g, f, v, o = grab("Pronunciation"), grab("Grammar"), grab("Fluency"), grab("Vocabulary"), grab("Overall")
    if any(x is not None for x in (p, g, f, v)):
        obj = {"scores": {"pronunciation": p or 0, "grammar": g or 0, "fluency": f or 0, "vocabulary": v or 0, "overall": o}}
        obj["comment"] = text.strip()[:900]
        return obj
    return None

# ===== Objective metrics helpers =====
_FILLERS = {
    "um", "uh", "erm", "ah", "like", "you know", "actually", "basically", "literally", "sort of", "kind of", "so"
}

def _tokenize_words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z']+", text.lower())

def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"[.!?]+", text)
    return [p.strip() for p in parts if p.strip()]

def _count_fillers(text: str) -> int:
    t = " " + text.lower() + " "
    count = 0
    for f in _FILLERS:
        if " " in f:
            count += t.count(" " + f + " ")
        else:
            count += len(re.findall(rf"\b{re.escape(f)}\b", t))
    return count

def _objective_from_messages(msgs: list[dict], duration_min: float | None) -> dict:
    user_utts = [m.get("content","") for m in msgs if (m.get("role") == "user" and isinstance(m.get("content"), str))]
    user_text = "\n".join(user_utts)
    words = _tokenize_words(user_text)
    total_words = len(words)
    unique_words = len(set(words))
    ttr = (unique_words / total_words * 100.0) if total_words > 0 else 0.0

    sents = _split_sentences(user_text)
    avg_sent = (total_words / len(sents)) if sents else 0.0

    fillers = _count_fillers(user_text)
    filler_per_100w = (fillers / total_words * 100.0) if total_words > 0 else 0.0

    mean_utt_len = (total_words / len(user_utts)) if user_utts else 0.0
    wpm = (total_words / duration_min) if (duration_min and duration_min > 0) else None

    def r(x, n=2):
        return round(float(x), n) if x is not None else None

    return {
        "total_words": int(total_words),
        "unique_words": int(unique_words),
        "type_token_ratio": r(ttr, 1),
        "avg_sentence_len": r(avg_sent, 2),
        "filler_per_100w": r(filler_per_100w, 2),
        "mean_utterance_len": r(mean_utt_len, 2),
        "speech_rate_wpm": r(wpm, 1) if wpm is not None else None,
    }

# ===== Feedback (final assessment JSON + descriptors + objective metrics) =====
@router.post("/feedback")
async def feedback(req: FeedbackIn = Body(...)):
    if not GROQ_API_KEY:
        return JSONResponse({"error": "Missing GROQ_API_KEY"}, status_code=500)
    try:
        import httpx
    except Exception as e:
        return JSONResponse({"error": "Missing dependency 'httpx'", "detail": str(e)}, status_code=500)

    # CEFR-aligned + descriptors + strict JSON
    system_prompt = {
        "role": "system",
        "content": (
            "You are an impartial English speaking examiner.\n"
            "Evaluate ONLY the USER's performance across this session.\n"
            "Return STRICT JSON with EXACT keys (no prose, no code fences):\n"
            "{\n"
            "  \"scores\": {\n"
            "    \"pronunciation\": number 0-10,\n"
            "    \"grammar\": number 0-10,\n"
            "    \"fluency\": number 0-10,\n"
            "    \"vocabulary\": number 0-10,\n"
            "    \"coherence\": number 0-10,\n"
            "    \"overall\": number 0-10\n"
            "  },\n"
            "  \"descriptors\": {\n"
            "    \"pronunciation\": \"1-2 sentences (segmentals/suprasegmentals/intelligibility)\",\n"
            "    \"grammar\": \"1-2 sentences (range & accuracy; common errors)\",\n"
            "    \"fluency\": \"1-2 sentences (rate, pauses, self-correction)\",\n"
            "    \"vocabulary\": \"1-2 sentences (range/precision/collocations)\",\n"
            "    \"coherence\": \"1-2 sentences (organization, cohesion, discourse markers)\"\n"
            "  },\n"
            "  \"comment\": \"One concise paragraph with strengths + 2-3 specific improvements\",\n"
            "  \"standards\": {\"rubric\": \"CEFR-aligned v1\", \"notes\": \"Descriptors adapted/operationalized for automated rating\"}\n"
            "}\n"
            "Do NOT add any text outside JSON."
        ),
    }

    msgs = [m.dict() for m in req.messages][-40:]
    final_messages = [system_prompt, *msgs]

    body_req = {
        "model": "llama3-8b-8192",
        "messages": final_messages,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=body_req)
        if r.status_code != 200:
            return JSONResponse({"error": "groq_feedback_failed", "detail": r.text, "status_code": r.status_code}, status_code=500)
        data = r.json()

    content = data.get("choices", [{}])[0].get("message", {}).get("content", "") or ""
    try:
        parsed = json.loads(content)
    except Exception:
        parsed = _extract_json_block(content)

    # default/fallback
    base_resp = {
        "scores": {"pronunciation": 0, "grammar": 0, "fluency": 0, "vocabulary": 0, "coherence": 0, "overall": 0},
        "descriptors": {"pronunciation": "", "grammar": "", "fluency": "", "vocabulary": "", "coherence": ""},
        "comment": content or "No structured feedback could be parsed.",
        "standards": {"rubric": "CEFR-aligned v1", "notes": ""},
    }

    obj_metrics = _objective_from_messages(msgs, float(req.duration_min or 0.0))

    if not parsed:
        base_resp["objective_metrics"] = obj_metrics
        return base_resp

    # normalize + inject coherence if present
    norm = _normalize_scores_obj(parsed)  # scores & comment
    scores = norm.get("scores", {})
    if "scores" in parsed and isinstance(parsed["scores"], dict) and "coherence" in parsed["scores"]:
        try:
            scores["coherence"] = _clip01(parsed["scores"]["coherence"])
        except Exception:
            scores["coherence"] = 0.0

    descriptors = parsed.get("descriptors", {
        "pronunciation": "", "grammar": "", "fluency": "", "vocabulary": "", "coherence": ""
    })
    standards = parsed.get("standards", {"rubric": "CEFR-aligned v1", "notes": ""})

    return {
        "scores": scores,
        "descriptors": descriptors,
        "comment": norm.get("comment", ""),
        "standards": standards,
        "objective_metrics": obj_metrics,
    }

# ===== Helper: Groq JSON chat (critic/planner) =====
async def _groq_json_chat(messages: list, temperature: float = 0.2) -> dict:
    if not GROQ_API_KEY:
        return {}
    try:
        import httpx
    except Exception:
        return {}
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    body = {
        "model": "llama3-8b-8192",
        "messages": messages,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=body)
        if r.status_code != 200:
            return {}
        content = (r.json().get("choices") or [{}])[0].get("message", {}).get("content", "") or "{}"
        try:
            return json.loads(content)
        except Exception:
            return {}

# ===== Agent endpoints =====
def _weak_focus_from_profile(p: ProfileORM) -> str:
    buckets = {
        "pron": p.ma_pron or 0.0,
        "gram": p.ma_gram or 0.0,
        "fluency": p.ma_flu or 0.0,
        "vocab": p.ma_vocab or 0.0,
    }
    weakest = min(buckets.items(), key=lambda x: x[1])[0]
    return weakest  # 'pron'|'gram'|'fluency'|'vocab'

def _suggest_scenario_for_focus(focus: str) -> str:
    return {
        "pron": "Daily Conversation",
        "gram": "Business Meeting",
        "fluency": "Travel Situations",
        "vocab": "Job Interview",
    }.get(focus, "Daily Conversation")

def _make_prompt(focus: str, level: int) -> str:
    level_text = {
        1:"Beginner (A1-A2)",2:"Pre-Intermediate (A2-B1)",3:"Intermediate (B1-B2)",4:"Upper-Intermediate (B2)",5:"Advanced (C1)"
    }.get(level, "Intermediate")
    tips = {
        "pron": "Focus on clear vowel/consonant sounds and word stress. Keep sentences short.",
        "gram": "Use correct tense and articles. Try to self-correct one mistake.",
        "fluency":"Keep talking without long pauses; use fillers like 'well', 'let me think'.",
        "vocab":"Use 2-3 specific terms and 1 collocation appropriate to the topic.",
    }
    return (
        f"Level: {level_text}. Focus: {focus}.\n"
        f"Start by asking the learner a question.\n"
        f"Guideline: {tips.get(focus,'Do your best and speak clearly.')}"
    )

@router.get("/agent/next")
def agent_next(db: Session = Depends(get_db)):
    prof = ensure_profile(db)
    focus = _weak_focus_from_profile(prof)
    scenario = _suggest_scenario_for_focus(focus)
    prompt = _make_prompt(focus, prof.level)

    plan = db.execute(
        sa_select(PlanORM).where(PlanORM.user_id==1, PlanORM.active==True).order_by(desc(PlanORM.start_date))
    ).scalar_one_or_none()
    if not plan:
        plan = PlanORM(user_id=1, title="Auto Plan", goal_text="Improve speaking skills adaptively.")
        db.add(plan); db.commit(); db.refresh(plan)

    item = db.execute(
        sa_select(PlanItemORM).where(PlanItemORM.plan_id==plan.id, PlanItemORM.done==False).order_by(asc(PlanItemORM.order_idx))
    ).scalar_one_or_none()

    if not item:
        last_idx = db.execute(
            sa_select(text("COALESCE(MAX(order_idx),-1)")).select_from(PlanItemORM).where(PlanItemORM.plan_id==plan.id)
        ).scalar_one()
        item = PlanItemORM(
            plan_id=plan.id,
            order_idx=(last_idx + 1),
            scenario=scenario,
            focus=focus,
            level=prof.level,
            prompt=prompt
        )
        db.add(item); db.commit(); db.refresh(item)

    return {
        "item_id": item.id,
        "scenario": item.scenario,
        "level": item.level,
        "prompt": item.prompt,
    }

class CompleteIn(BaseModel):
    item_id: int
    done: bool = True

@router.post("/agent/complete")
def agent_complete(payload: CompleteIn, db: Session = Depends(get_db)):
    item = db.get(PlanItemORM, payload.item_id)
    if not item:
        return JSONResponse({"error": "item_not_found"}, status_code=404)
    item.done = bool(payload.done)
    db.add(item); db.commit(); db.refresh(item)
    return {"ok": True, "item": {"id": item.id, "done": item.done}}

# --- NEW: Critic / reflection ---
class ReflectIn(BaseModel):
    messages: List[Message]
    feedback: dict
    user_id: int = 1

class ReflectOut(BaseModel):
    summary: str
    error_patterns: List[dict]
    vocab_targets: List[dict]
    objectives_next: List[str]

@router.post("/agent/reflect", response_model=ReflectOut)
async def agent_reflect(payload: ReflectIn, db: Session = Depends(get_db)):
    system = {
        "role": "system",
        "content": (
            "You are an English speaking coach (critic). Return STRICT JSON only:\n"
            "{\n"
            "  \"summary\": \"3-5 sentences recap\",\n"
            "  \"error_patterns\": [\n"
            "    {\"tag\":\"articles|tense|word_stress|prepositions|run_on|filler\",\n"
            "     \"description\":\"short explanation\",\n"
            "     \"examples\":[\"wrong -> better\",\"...\"],\n"
            "     \"weight\": 0..3}\n"
            "  ],\n"
            "  \"vocab_targets\": [{\"topic\":\"job_interview\",\"items\":[\"term1\",\"term2\",\"term3\"]}],\n"
            "  \"objectives_next\": [\"objective1\",\"objective2\"]\n"
            "}\n"
            "No extra text."
        ),
    }
    msgs = [m.dict() for m in payload.messages][-60:]
    user = {"role": "user", "content": json.dumps({"dialogue": msgs, "feedback": payload.feedback}, ensure_ascii=False)}
    data = await _groq_json_chat([system, user], temperature=0.2)

    out = {
        "summary": (data.get("summary") or "")[:2000],
        "error_patterns": data.get("error_patterns", [])[:5],
        "vocab_targets": data.get("vocab_targets", [])[:2],
        "objectives_next": data.get("objectives_next", [])[:5],
    }

    # persist memory
    for ep in out["error_patterns"]:
        tag = (ep.get("tag") or "misc").strip()[:64]
        row = db.execute(sa_select(ErrorPatternORM).where(ErrorPatternORM.user_id==payload.user_id, ErrorPatternORM.tag==tag)).scalar_one_or_none()
        if not row:
            row = ErrorPatternORM(
                user_id=payload.user_id,
                tag=tag,
                description=(ep.get("description") or "")[:2000],
                examples="\n".join(ep.get("examples", [])[:5]),
                weight=float(ep.get("weight") or 1.0),
            )
        else:
            row.description = (ep.get("description") or row.description)[:2000]
            if ep.get("examples"):
                row.examples = "\n".join(ep.get("examples", [])[:5])
            try:
                row.weight = float(ep.get("weight") or row.weight)
            except Exception:
                pass
            row.last_seen_at = datetime.utcnow()
        db.add(row)

    for vt in out["vocab_targets"]:
        topic = (vt.get("topic") or "general")[:128]
        items = "\n".join(vt.get("items", [])[:10])
        db.add(VocabTargetORM(user_id=payload.user_id, topic=topic, items=items, due_next=True))

    db.commit()
    return out

# --- NEW: Planner endpoint (generate next plan) ---
class PlanIn(BaseModel):
    user_id: int = 1
    profile: Optional[dict] = None
    error_patterns: List[dict] = Field(default_factory=list)
    objectives_next: List[str] = Field(default_factory=list)
    vocab_targets: List[dict] = Field(default_factory=list)

class PlanGenOut(BaseModel):
    scenario: str
    level: int
    objectives: List[str]
    rubric: List[str]
    starter_turns: List[str]
    target_time_min: int

@router.post("/agent/plan", response_model=PlanGenOut)
async def agent_plan(payload: PlanIn, db: Session = Depends(get_db)):
    prof = ensure_profile(db, user_id=payload.user_id)
    profile = payload.profile or {
        "level": prof.level,
        "ma": {
            "pron": prof.ma_pron, "gram": prof.ma_gram, "flu": prof.ma_flu, "vocab": prof.ma_vocab, "overall": prof.ma_overall
        },
    }
    context = {
        "profile": profile,
        "error_patterns": payload.error_patterns,
        "objectives_next": payload.objectives_next,
        "vocab_targets": payload.vocab_targets,
    }
    system = {
        "role": "system",
        "content": (
            "You are a session planner. Produce JSON only:\n"
            "{\n"
            "  \"scenario\":\"Job Interview|Daily Conversation|Business Meeting|Travel Situations|...\",\n"
            "  \"level\": 1..5,\n"
            "  \"objectives\": [\"...\"],\n"
            "  \"rubric\": [\"...\"],\n"
            "  \"starter_turns\": [\"...\"],\n"
            "  \"target_time_min\": 5|7|10\n"
            "}\n"
            "Prioritize weakest skills & recent error patterns; weave 2-3 vocab targets.\n"
            "No extra text."
        ),
    }
    user = {"role": "user", "content": json.dumps(context, ensure_ascii=False)}
    plan = await _groq_json_chat([system, user], temperature=0.3)

    # persist a tiny trace (optional)
    prof.last_objectives = "\n".join((plan.get("objectives") or [])[:6])
    db.add(prof); db.commit()

    return {
        "scenario": plan.get("scenario", "Daily Conversation"),
        "level": int(plan.get("level", profile.get("level", 2))),
        "objectives": (plan.get("objectives") or [])[:6],
        "rubric": (plan.get("rubric") or ["Speak clearly","Use correct tense","Use 2 specific terms"])[:6],
        "starter_turns": (plan.get("starter_turns") or ["Tell me about your day."])[:3],
        "target_time_min": int(plan.get("target_time_min", 7)),
    }

# --- GET profile (untuk dashboard) ---
@router.get("/profile")
def get_profile(db: Session = Depends(get_db)):
    prof = ensure_profile(db)
    return {
        "user_id": prof.user_id,
        "level": prof.level,
        "target_cefr": prof.target_cefr,
        "sessions_count": prof.sessions_count,
        "ma": {
            "pronunciation": prof.ma_pron,
            "grammar": prof.ma_gram,
            "fluency": prof.ma_flu,
            "vocabulary": prof.ma_vocab,
            "overall": prof.ma_overall,
        },
    }

# ===== Register router =====
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", reload=True, port=int(os.getenv("PORT", "8000")))
