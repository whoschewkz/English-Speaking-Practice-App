from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import DATABASE_URL_CFG


def make_engine(url: str):
    if url.startswith("sqlite"):
        return create_engine(url, pool_pre_ping=True, future=True, connect_args={"check_same_thread": False})
    return create_engine(url, pool_pre_ping=True, future=True)


DATABASE_URL = DATABASE_URL_CFG
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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def sqlite_add_column_if_missing(table_name: str, column_def_sql: str):
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        info = conn.exec_driver_sql(f"PRAGMA table_info({table_name})").fetchall()
        cols = {row[1] for row in info}
        col_name = column_def_sql.strip().split()[0]
        if col_name not in cols:
            conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN {column_def_sql}")
