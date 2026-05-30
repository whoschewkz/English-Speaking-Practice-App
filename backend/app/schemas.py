import re
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, validator

MsgRole = Literal["system", "user", "assistant"]


class Message(BaseModel):
    role: MsgRole
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    scenarioId:          Optional[str] = "custom"
    scenarioTitle:       Optional[str] = None
    scenarioDescription: Optional[str] = None
    agentSystemCtx:      Optional[str] = None   # system context dari agent /next (level + focus)
    messages:            List[Message] = Field(default_factory=list)

    @validator("scenarioId", pre=True)
    def _to_str(cls, v):
        return str(v) if v is not None else "custom"


class ChatOpenRequest(BaseModel):
    scenarioTitle:       str
    scenarioDescription: Optional[str] = ""


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


class RegisterIn(BaseModel):
    username:  str           = Field(..., min_length=3,  max_length=50)
    email:     str           = Field(..., min_length=5,  max_length=100)
    password:  str           = Field(..., min_length=8,  max_length=128)
    full_name: Optional[str] = Field(None, max_length=100)

    @validator("username")
    def username_alphanumeric(cls, v):
        v = v.strip()
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username hanya boleh huruf, angka, dan underscore")
        return v

    @validator("email")
    def email_format(cls, v):
        v = v.strip().lower()
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", v):
            raise ValueError("Format email tidak valid")
        return v

    @validator("password")
    def password_strength(cls, v):
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password harus mengandung minimal 1 huruf besar")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password harus mengandung minimal 1 huruf kecil")
        if not re.search(r"\d", v):
            raise ValueError("Password harus mengandung minimal 1 angka")
        return v


class LoginIn(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)

    @validator("username", "password", pre=True)
    def strip_input(cls, v):
        return v.strip() if isinstance(v, str) else v


class TokenOut(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    role:          str
    username:      str


class RefreshIn(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id:        int
    username:  str
    email:     str
    full_name: Optional[str]
    role:      str
    is_active: bool


class SaveSessionIn(BaseModel):
    scenario:           str
    score_range:        float = Field(..., ge=1, le=5)
    score_accuracy:     float = Field(..., ge=1, le=5)
    score_fluency:      float = Field(..., ge=1, le=5)
    score_coherence:    float = Field(..., ge=1, le=5)
    score_phonology:    float = Field(..., ge=1, le=5)
    comment:            Optional[str]        = None
    duration_min:       Optional[float]      = 0.0
    audio_path:         Optional[str]        = None   # backward compat (single)
    audio_paths:        Optional[List[str]]  = None   # semua user recording turn dalam sesi
    conversation_turns: Optional[List[dict]] = None   # [{role, path}] urutan lengkap user+AI
    user_id:            Optional[int]        = None   # diisi dari token, bukan dari body


class ScenarioIn(BaseModel):
    title:       str           = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)


class CompleteIn(BaseModel):
    item_id: int
    done: bool = True


class ReflectIn(BaseModel):
    messages:  List[Message]
    feedback:  dict
    user_id:   int = 1


class ReflectOut(BaseModel):
    summary:         str
    error_patterns:  List[dict]
    vocab_targets:   List[dict]
    objectives_next: List[str]


class PlanIn(BaseModel):
    user_id:         int            = 1
    profile:         Optional[dict] = None
    error_patterns:  List[dict]     = Field(default_factory=list)
    objectives_next: List[str]      = Field(default_factory=list)
    vocab_targets:   List[dict]     = Field(default_factory=list)


class PlanGenOut(BaseModel):
    scenario:        str
    level:           int
    objectives:      List[str]
    rubric:          List[str]
    starter_turns:   List[str]
    target_time_min: int


class RaterAssessmentIn(BaseModel):
    session_id:      int
    rater_id:        int = Field(..., ge=1, le=2)
    score_range:     Optional[float] = Field(None, ge=1, le=5)
    score_accuracy:  Optional[float] = Field(None, ge=1, le=5)
    score_fluency:   Optional[float] = Field(None, ge=1, le=5)
    score_coherence: Optional[float] = Field(None, ge=1, le=5)
    score_phonology: Optional[float] = Field(None, ge=1, le=5)
    notes:           Optional[str] = None


class SessionForRatingOut(BaseModel):
    id:              int
    user_id:         int
    scenario:        str
    audio_path:      Optional[str]
    duration_min:    float
    created_at:      str
    ai_scores:       dict  # scores from AI
    rater_scores:    dict  # scores from both raters (if exists)
