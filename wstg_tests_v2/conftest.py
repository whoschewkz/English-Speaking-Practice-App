"""
conftest.py — WSTG + AITG Test Suite BicarAI
"""

import pytest
import requests
import wave
from pathlib import Path

BASE      = "http://localhost:8000"
FIXTURES  = Path(__file__).parent / "fixtures"
FIXTURES.mkdir(exist_ok=True)

USERS = {
    "admin":  {"username": "wstg_admin",  "email": "wstg_admin@bicarai.test",  "password": "WstgAdmin@123"},
    "user_a": {"username": "wstg_usera",  "email": "wstg_usera@bicarai.test",  "password": "WstgUserA@123"},
    "user_b": {"username": "wstg_userb",  "email": "wstg_userb@bicarai.test",  "password": "WstgUserB@123"},
    "rater":  {"username": "wstg_rater",  "email": "wstg_rater@bicarai.test",  "password": "WstgRater@123"},
}

# Kredensial seeded admin untuk assign roles
SEEDED_ADMIN = {"username": "admin", "password": "Admin123!"}

# Cache token agar tidak login ulang di tengah test (setelah ATHN-03 exhaust rate limit)
_TOKENS: dict = {}
_SESSION_IDS: dict = {}


def register(u):
    return requests.post(f"{BASE}/api/auth/register",
                         json={"username": u["username"], "email": u["email"], "password": u["password"]})

def login(username, password):
    r = requests.post(f"{BASE}/api/auth/login", json={"username": username, "password": password})
    return r.json() if r.status_code == 200 else {}

def hdr(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session", autouse=True)
def setup_users():
    """
    Register semua akun WSTG, assign role via seeded admin,
    lalu PRE-OBTAIN semua token sebelum test apapun dijalankan.
    Ini mencegah token fixture gagal karena rate limit yang
    dipicu oleh WSTG-ATHN-03 (yang sengaja exhaust login attempts).
    """
    # 1. Register semua user
    for u in USERS.values():
        register(u)

    # 2. Buat dummy audio
    wav = FIXTURES / "dummy.wav"
    if not wav.exists():
        with wave.open(str(wav), 'w') as f:
            f.setnchannels(1); f.setsampwidth(2); f.setframerate(16000)
            f.writeframes(b'\x00' * 32000)

    # 3. Login sebagai seeded admin untuk assign roles
    seeded = login(SEEDED_ADMIN["username"], SEEDED_ADMIN["password"])
    seeded_token = seeded.get("access_token", "")

    if seeded_token:
        users_resp = requests.get(f"{BASE}/api/admin/users", headers=hdr(seeded_token))
        if users_resp.status_code == 200:
            all_users = {u["username"]: u for u in users_resp.json()}
            role_map = {
                USERS["admin"]["username"]: "admin",
                USERS["rater"]["username"]: "rater1",
            }
            for uname, role in role_map.items():
                u = all_users.get(uname)
                if u:
                    requests.patch(
                        f"{BASE}/api/admin/users/{u['id']}",
                        headers=hdr(seeded_token),
                        json={"role": role}
                    )

    # 4. Pre-obtain semua token (SEBELUM test ATHN-03 exhaust rate limit)
    for key, u in USERS.items():
        result = login(u["username"], u["password"])
        _TOKENS[key] = result.get("access_token", "")

    # 5. Buat sesi user_b untuk dipakai di IDOR test
    user_b_tok = _TOKENS.get("user_b", "")
    if user_b_tok:
        r = requests.post(
            f"{BASE}/api/sessions",
            headers=hdr(user_b_tok),
            json={
                "scenario":        "Job Interview",
                "score_range":     3.0,
                "score_accuracy":  3.0,
                "score_fluency":   3.0,
                "score_coherence": 3.0,
                "score_phonology": 3.0,
                "duration_min":    5.0,
                "conversation_turns": [{"role": "user", "path": "dummy_test.wav"}],
            }
        )
        if r.status_code in (200, 201):
            _SESSION_IDS["user_b"] = r.json().get("id")

    yield


@pytest.fixture(scope="session")
def admin_token():
    t = _TOKENS.get("admin", "")
    assert t, "Gagal login admin — cek rate limit atau server"
    return t

@pytest.fixture(scope="session")
def user_a_token():
    t = _TOKENS.get("user_a", "")
    assert t, "Gagal login user_a — cek rate limit atau server"
    return t

@pytest.fixture(scope="session")
def user_b_token():
    t = _TOKENS.get("user_b", "")
    assert t, "Gagal login user_b — cek rate limit atau server"
    return t

@pytest.fixture(scope="session")
def rater_token():
    t = _TOKENS.get("rater", "")
    assert t, "Gagal login rater — cek rate limit atau server"
    return t

@pytest.fixture(scope="session")
def user_b_session_id():
    return _SESSION_IDS.get("user_b")

@pytest.fixture
def dummy_audio():
    return FIXTURES / "dummy.wav"
