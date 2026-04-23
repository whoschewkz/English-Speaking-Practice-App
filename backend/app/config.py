import os, json

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

API_PREFIX   = os.getenv("API_PREFIX", "/api")
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

SECRET_KEY        = os.getenv("SECRET_KEY", "GANTI_INI_DENGAN_SECRET_PANJANG_DAN_ACAK_DI_PRODUCTION")
ALGORITHM         = "HS256"
ACCESS_TOKEN_EXP  = int(os.getenv("ACCESS_TOKEN_EXP_MINUTES", "30"))
REFRESH_TOKEN_EXP = int(os.getenv("REFRESH_TOKEN_EXP_DAYS", "7"))
DATABASE_URL_CFG  = os.getenv("DATABASE_URL", "").strip() or "sqlite:///./speaking.db"
