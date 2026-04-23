"""
Jalankan dari folder backend/app:
  cd backend/app
  python fix_db.py
"""
import sqlite3, os

DB_PATH = "speaking.db"
if not os.path.exists(DB_PATH):
    DB_PATH = os.path.join(os.path.dirname(__file__), "speaking.db")

print(f"[DB] Connecting to: {os.path.abspath(DB_PATH)}")
conn = sqlite3.connect(DB_PATH)
cur  = conn.cursor()

# Cek tabel yang ada
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print(f"[DB] Tables: {tables}")

# Hapus profiles_old kalau masih ada (sisa run sebelumnya)
if "profiles_old" in tables:
    cur.execute("DROP TABLE profiles_old")
    conn.commit()
    print("[DB] Hapus profiles_old lama ✅")

# Cek kolom profiles sekarang
cur.execute("PRAGMA table_info(profiles)")
cols = {row[1] for row in cur.fetchall()}
print(f"[DB] Kolom profiles: {sorted(cols)}")

# Cek apakah perlu rebuild (ada kolom lama ma_pron/ma_gram/ma_vocab/ma_flu)
old_cols = cols & {"ma_pron", "ma_gram", "ma_flu", "ma_vocab"}
new_cols_needed = {"ma_range", "ma_accuracy", "ma_fluency", "ma_coherence", "ma_phonology"}

if old_cols or not new_cols_needed.issubset(cols):
    print(f"[DB] Perlu rebuild — kolom lama: {old_cols}")

    cur.execute("ALTER TABLE profiles RENAME TO profiles_old")
    conn.commit()

    cur.execute("""
        CREATE TABLE profiles (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL,
            level           INTEGER NOT NULL DEFAULT 2,
            target_cefr     TEXT    NOT NULL DEFAULT 'B1',
            ma_range        REAL    NOT NULL DEFAULT 3.0,
            ma_accuracy     REAL    NOT NULL DEFAULT 3.0,
            ma_fluency      REAL    NOT NULL DEFAULT 3.0,
            ma_coherence    REAL    NOT NULL DEFAULT 3.0,
            ma_phonology    REAL    NOT NULL DEFAULT 3.0,
            ma_overall      REAL    NOT NULL DEFAULT 3.0,
            sessions_count  INTEGER NOT NULL DEFAULT 0,
            last_objectives TEXT
        )
    """)
    conn.commit()

    # Copy data — map kolom lama ke baru dengan COALESCE
    cur.execute("""
        INSERT INTO profiles (
            id, user_id, level, target_cefr,
            ma_range, ma_accuracy, ma_fluency,
            ma_coherence, ma_phonology, ma_overall,
            sessions_count, last_objectives
        )
        SELECT
            id, user_id,
            COALESCE(level, 2),
            COALESCE(target_cefr, 'B1'),
            COALESCE(ma_range,    COALESCE(ma_vocab, 3.0), 3.0),
            COALESCE(ma_accuracy, COALESCE(ma_gram,  3.0), 3.0),
            COALESCE(ma_fluency,  COALESCE(ma_flu,   3.0), 3.0),
            COALESCE(ma_coherence, 3.0),
            COALESCE(ma_phonology,COALESCE(ma_pron,  3.0), 3.0),
            COALESCE(ma_overall,  3.0),
            COALESCE(sessions_count, 0),
            last_objectives
        FROM profiles_old
    """)
    conn.commit()

    cur.execute("DROP TABLE profiles_old")
    conn.commit()
    print("[DB] Rebuild selesai ✅")
else:
    print("[DB] Schema sudah benar, tidak perlu rebuild ✅")

# Verifikasi final
cur.execute("PRAGMA table_info(profiles)")
final_cols = [row[1] for row in cur.fetchall()]
print(f"[DB] Kolom final: {final_cols}")
cur.execute("SELECT COUNT(*) FROM profiles")
print(f"[DB] Row count: {cur.fetchone()[0]}")

conn.close()
print("\n✅ Selesai! Sekarang jalankan backend dari folder backend/ (bukan app/):")
print("   cd ..")
print("   python -m uvicorn app.main:app --reload")