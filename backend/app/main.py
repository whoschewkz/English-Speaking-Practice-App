import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .config import API_PREFIX, ALLOWED_ORIGINS, GROQ_API_KEY
from .limiter import limiter
from .database import engine, SessionLocal, sqlite_add_column_if_missing
from .models import Base
from .seed import seed_scenarios, seed_admin
from .routers import auth, admin, scenarios, sessions, chat, feedback, agent, profile, validation, rater

# Create tables
Base.metadata.create_all(bind=engine)

# Auto migrations (SQLite only)
sqlite_add_column_if_missing("profiles",       "ma_range REAL NOT NULL DEFAULT 3.0")
sqlite_add_column_if_missing("profiles",       "ma_accuracy REAL NOT NULL DEFAULT 3.0")
sqlite_add_column_if_missing("profiles",       "ma_fluency REAL NOT NULL DEFAULT 3.0")
sqlite_add_column_if_missing("profiles",       "ma_coherence REAL NOT NULL DEFAULT 3.0")
sqlite_add_column_if_missing("profiles",       "ma_phonology REAL NOT NULL DEFAULT 3.0")
sqlite_add_column_if_missing("profiles",       "ma_overall REAL NOT NULL DEFAULT 3.0")
sqlite_add_column_if_missing("profiles",       "last_objectives TEXT")
sqlite_add_column_if_missing("sessions",       "score_range REAL NOT NULL DEFAULT 3.0")
sqlite_add_column_if_missing("sessions",       "score_accuracy REAL NOT NULL DEFAULT 3.0")
sqlite_add_column_if_missing("sessions",       "score_fluency REAL NOT NULL DEFAULT 3.0")
sqlite_add_column_if_missing("sessions",       "score_coherence REAL NOT NULL DEFAULT 3.0")
sqlite_add_column_if_missing("sessions",       "score_phonology REAL NOT NULL DEFAULT 3.0")
sqlite_add_column_if_missing("sessions",       "user_id INTEGER NOT NULL DEFAULT 1")
sqlite_add_column_if_missing("sessions",       "audio_path TEXT")
sqlite_add_column_if_missing("error_patterns", "weight REAL NOT NULL DEFAULT 1.0")

# Seed
with SessionLocal() as db:
    seed_scenarios(db)
    seed_admin(db)

# ===== App =====
app = FastAPI(
    title="Speaking Practice API",
    description="API for the Speaking Practice Platform",
    version="1.0.0",
    docs_url=f"{API_PREFIX}/docs",
    redoc_url=f"{API_PREFIX}/redoc",
    openapi_url=f"{API_PREFIX}/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Welcome to the Speaking Practice API"}


health_router = APIRouter(prefix=API_PREFIX)

@health_router.get("/health")
async def health_check():
    return {"status": "healthy", "origins": ALLOWED_ORIGINS, "groq_ready": bool(GROQ_API_KEY)}


app.include_router(health_router)
app.include_router(auth.router,      prefix=API_PREFIX)
app.include_router(admin.router,     prefix=API_PREFIX)
app.include_router(scenarios.router, prefix=API_PREFIX)
app.include_router(sessions.router,  prefix=API_PREFIX)
app.include_router(chat.router,      prefix=API_PREFIX)
app.include_router(feedback.router,  prefix=API_PREFIX)
app.include_router(agent.router,     prefix=API_PREFIX)
app.include_router(profile.router,   prefix=API_PREFIX)
app.include_router(validation.router, prefix=API_PREFIX)
app.include_router(rater.router,     prefix=API_PREFIX)


# Serve static audio files
uploads_dir = Path(__file__).parent.parent / "uploads"
if uploads_dir.exists():
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", reload=True, port=int(os.getenv("PORT", "8000")))