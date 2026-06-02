from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, Text, Boolean

from .database import Base


class UserORM(Base):
    __tablename__ = "users"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    username         = Column(String(50),  unique=True, nullable=False, index=True)
    email            = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password  = Column(String(200), nullable=False)
    full_name        = Column(String(100), nullable=True)
    role             = Column(String(20),  nullable=False, default="user")
    is_active        = Column(Boolean, default=True, nullable=False)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at    = Column(DateTime, nullable=True)


class RefreshTokenORM(Base):
    __tablename__ = "refresh_tokens"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, index=True, nullable=False)
    token_hash = Column(String(200), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked    = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ScenarioORM(Base):
    __tablename__ = "scenarios"
    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title       = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)


class SessionRecordORM(Base):
    __tablename__ = "sessions"
    id              = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id         = Column(Integer, nullable=False, default=1, index=True)
    scenario        = Column(String(200), nullable=False)
    score_range     = Column(Float, nullable=False, default=3.0)
    score_accuracy  = Column(Float, nullable=False, default=3.0)
    score_fluency   = Column(Float, nullable=False, default=3.0)
    score_coherence = Column(Float, nullable=False, default=3.0)
    score_interaction = Column(Float, nullable=False, default=3.0, name="score_phonology")
    score_overall     = Column(Float, nullable=False, default=3.0)
    comment         = Column(Text, nullable=True)
    duration_min    = Column(Float, nullable=False, default=0.0)
    audio_path      = Column(String(500), nullable=True)
    full_audio_json = Column(Text, nullable=True)
    full_text_json  = Column(Text, nullable=True)
    rater_visible   = Column(Boolean, nullable=False, default=True)  # admin bisa nonaktifkan dari antrian rater
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)


class ProfileORM(Base):
    __tablename__ = "profiles"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    user_id         = Column(Integer, nullable=False, index=True, default=1)
    level           = Column(Integer, nullable=False, default=2)
    target_cefr     = Column(String(8), nullable=False, default="B1")
    ma_range        = Column(Float, nullable=False, default=3.0)
    ma_accuracy     = Column(Float, nullable=False, default=3.0)
    ma_fluency      = Column(Float, nullable=False, default=3.0)
    ma_coherence    = Column(Float, nullable=False, default=3.0)
    ma_interaction  = Column(Float, nullable=False, default=3.0, name="ma_phonology")
    ma_overall      = Column(Float, nullable=False, default=3.0)
    sessions_count  = Column(Integer, nullable=False, default=0)
    last_objectives = Column(Text, nullable=True)


class PlanORM(Base):
    __tablename__ = "plans"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, index=True, nullable=False, default=1)
    title      = Column(String(200), nullable=False)
    goal_text  = Column(Text, nullable=False)
    start_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_date   = Column(DateTime, nullable=True)
    active     = Column(Boolean, default=True)


class PlanItemORM(Base):
    __tablename__ = "plan_items"
    id        = Column(Integer, primary_key=True, autoincrement=True)
    plan_id   = Column(Integer, index=True, nullable=False)
    order_idx = Column(Integer, nullable=False, default=0)
    scenario  = Column(String(200), nullable=False)
    focus     = Column(String(50), nullable=False)
    level     = Column(Integer, nullable=False, default=2)
    prompt    = Column(Text, nullable=False)
    done      = Column(Boolean, default=False)


class ErrorPatternORM(Base):
    __tablename__ = "error_patterns"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, index=True, nullable=False, default=1)
    tag          = Column(String(64), index=True, nullable=False)
    description  = Column(Text, nullable=False)
    examples     = Column(Text, nullable=True)
    weight       = Column(Float, nullable=False, default=1.0)
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class VocabTargetORM(Base):
    __tablename__ = "vocab_targets"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, index=True, nullable=False, default=1)
    topic      = Column(String(128), nullable=False)
    items      = Column(Text, nullable=False)
    due_next   = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SessionSummaryORM(Base):
    __tablename__ = "session_summaries"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    session_id      = Column(Integer, index=True, nullable=False)
    user_id         = Column(Integer, index=True, nullable=False, default=1)
    summary         = Column(Text, nullable=False)
    objectives_next = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)


class RaterAssessmentORM(Base):
    __tablename__ = "rater_assessments"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    session_id      = Column(Integer, index=True, nullable=False)
    rater_id        = Column(Integer, nullable=False, default=1)  # 1 or 2
    score_range     = Column(Float, nullable=True)
    score_accuracy  = Column(Float, nullable=True)
    score_fluency   = Column(Float, nullable=True)
    score_coherence = Column(Float, nullable=True)
    score_interaction = Column(Float, nullable=True, name="score_phonology")
    notes             = Column(Text, nullable=True)
    rated_at        = Column(DateTime, default=datetime.utcnow, nullable=False)
