"""
conftest.py — BicarAI Test Suite
Fixtures, setup, dan teardown untuk seluruh test.
"""

import pytest
import requests
import time
import os
from pathlib import Path
from playwright.sync_api import Page, Browser, BrowserContext

# ============================================================
# KONFIGURASI
# ============================================================
BASE_URL_API  = "http://localhost:8000"
BASE_URL_UI   = "http://localhost:3000"
FIXTURES_DIR  = Path(__file__).parent / "fixtures"
REPORTS_DIR   = Path(__file__).parent.parent / "reports" / "screenshots"

REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Akun test yang akan di-create otomatis
TEST_USERS = {
    "admin": {
        "username": "test_admin",
        "email":    "test_admin@bicarai.test",
        "password": "TestAdmin@123",
        "role":     "admin"
    },
    "user": {
        "username": "test_user",
        "email":    "test_user@bicarai.test",
        "password": "TestUser@123",
        "role":     "user"
    },
    "rater1": {
        "username": "test_rater1",
        "email":    "test_rater1@bicarai.test",
        "password": "TestRater@123",
        "role":     "rater1"
    },
    "rater2": {
        "username": "test_rater2",
        "email":    "test_rater2@bicarai.test",
        "password": "TestRater2@123",
        "role":     "rater2"
    }
}

# Kredensial admin yang di-seed otomatis oleh sistem (seed_admin di backend)
SEEDED_ADMIN = {"username": "admin", "password": "Admin123!"}

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def register_user(data: dict) -> requests.Response:
    return requests.post(f"{BASE_URL_API}/api/auth/register", json={
        "username": data["username"],
        "email":    data["email"],
        "password": data["password"]
    })

def login_user(username: str, password: str) -> dict:
    """Login dengan username (bukan email) sesuai API LoginIn schema."""
    resp = requests.post(f"{BASE_URL_API}/api/auth/login", json={
        "username": username,
        "password": password
    })
    if resp.status_code == 200:
        return resp.json()
    return {}

def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

def screenshot(page: Page, name: str):
    path = REPORTS_DIR / f"{name}_{int(time.time())}.png"
    page.screenshot(path=str(path), full_page=True)
    return str(path)

# ============================================================
# SESSION-SCOPED FIXTURES (setup sekali, shared semua test)
# ============================================================

@pytest.fixture(scope="session", autouse=True)
def setup_test_users():
    """
    Auto-create semua akun test sebelum test suite dijalankan.
    Setelah create, gunakan seeded admin untuk set role test_admin, rater1, rater2.
    """
    print("\n[SETUP] Membuat akun test...")
    for role, data in TEST_USERS.items():
        resp = register_user(data)
        if resp.status_code in (200, 201):
            print(f"  ✅ Akun {role} berhasil dibuat: {data['username']}")
        elif resp.status_code == 400:
            print(f"  ℹ️  Akun {role} sudah ada: {data['username']}")
        else:
            print(f"  ⚠️  Gagal buat akun {role}: {resp.status_code} - {resp.text}")

    # Login sebagai seeded admin untuk set role test accounts
    seeded = login_user(SEEDED_ADMIN["username"], SEEDED_ADMIN["password"])
    seeded_token = seeded.get("access_token", "")
    if not seeded_token:
        print("  ⚠️  Tidak bisa login sebagai seeded admin — role assignment dilewati")
        yield
        return

    # Ambil semua user untuk cari ID-nya
    users_resp = requests.get(
        f"{BASE_URL_API}/api/admin/users",
        headers=auth_headers(seeded_token)
    )
    if users_resp.status_code != 200:
        print(f"  ⚠️  Tidak bisa ambil daftar user: {users_resp.status_code}")
        yield
        return

    all_users = {u["username"]: u for u in users_resp.json()}

    # Assign role untuk test_admin, test_rater1, test_rater2
    role_map = {
        TEST_USERS["admin"]["username"]:  "admin",
        TEST_USERS["rater1"]["username"]: "rater1",
        TEST_USERS["rater2"]["username"]: "rater2",
    }
    for username, target_role in role_map.items():
        user = all_users.get(username)
        if not user:
            print(f"  ⚠️  User {username} tidak ditemukan di daftar admin")
            continue
        patch = requests.patch(
            f"{BASE_URL_API}/api/admin/users/{user['id']}",
            headers=auth_headers(seeded_token),
            json={"role": target_role}
        )
        if patch.status_code == 200:
            print(f"  ✅ Role {username} → {target_role}")
        else:
            print(f"  ⚠️  Gagal set role {username}: {patch.status_code} - {patch.text}")

    yield


@pytest.fixture(scope="session")
def admin_token():
    d = TEST_USERS["admin"]
    result = login_user(d["username"], d["password"])
    token = result.get("access_token", "")
    assert token, "❌ Gagal login sebagai admin — pastikan server berjalan dan role sudah di-set"
    return token


@pytest.fixture(scope="session")
def user_token():
    d = TEST_USERS["user"]
    result = login_user(d["username"], d["password"])
    token = result.get("access_token", "")
    assert token, "❌ Gagal login sebagai user"
    return token


@pytest.fixture(scope="session")
def rater1_token():
    d = TEST_USERS["rater1"]
    result = login_user(d["username"], d["password"])
    token = result.get("access_token", "")
    assert token, "❌ Gagal login sebagai rater1"
    return token


@pytest.fixture(scope="session")
def rater2_token():
    d = TEST_USERS["rater2"]
    result = login_user(d["username"], d["password"])
    token = result.get("access_token", "")
    assert token, "❌ Gagal login sebagai rater2"
    return token


@pytest.fixture(scope="session")
def user_refresh_token():
    """
    Ambil refresh_token dari user_token fixture yang sudah di-cache (scope="session").
    Tidak melakukan login ulang agar tidak memicu rate limit.
    """
    d = TEST_USERS["user"]
    result = login_user(d["username"], d["password"])
    rt = result.get("refresh_token", "")
    if not rt:
        # Rate limit aktif — coba sekali lagi setelah jeda singkat
        import time as _time
        _time.sleep(65)
        result = login_user(d["username"], d["password"])
        rt = result.get("refresh_token", "")
    return rt


# ============================================================
# FUNCTION-SCOPED FIXTURES (reset tiap test)
# ============================================================

@pytest.fixture
def api():
    """Helper object untuk request API."""
    class API:
        def __init__(self):
            self.base = BASE_URL_API

        def get(self, path, token=None, **kwargs):
            headers = auth_headers(token) if token else {}
            return requests.get(f"{self.base}{path}", headers=headers, **kwargs)

        def post(self, path, token=None, **kwargs):
            headers = auth_headers(token) if token else {}
            return requests.post(f"{self.base}{path}", headers=headers, **kwargs)

        def put(self, path, token=None, **kwargs):
            headers = auth_headers(token) if token else {}
            return requests.put(f"{self.base}{path}", headers=headers, **kwargs)

        def delete(self, path, token=None, **kwargs):
            headers = auth_headers(token) if token else {}
            return requests.delete(f"{self.base}{path}", headers=headers, **kwargs)

    return API()


@pytest.fixture
def dummy_audio():
    path = FIXTURES_DIR / "dummy_audio.wav"
    assert path.exists(), f"Dummy audio tidak ditemukan: {path}"
    return path


def save_dummy_session(user_token: str, scenario: str = "Job Interview") -> int | None:
    """Helper: simpan sesi dummy dengan scores 3.0 dan conversation_turns."""
    resp = requests.post(
        f"{BASE_URL_API}/api/sessions",
        headers=auth_headers(user_token),
        json={
            "scenario":           scenario,
            "score_range":        3.0,
            "score_accuracy":     3.0,
            "score_fluency":      3.0,
            "score_coherence":    3.0,
            "score_phonology":    3.0,
            "comment":            "Sesi dummy untuk pengujian",
            "duration_min":       5.0,
            # conversation_turns agar full_audio_json terisi → sesi muncul di antrian rater
            "conversation_turns": [{"role": "user", "path": "dummy_test.wav"}],
        }
    )
    if resp.status_code in (200, 201):
        return resp.json().get("id")
    return None


@pytest.fixture(scope="session")
def active_session_id(user_token):
    """Buat sesi aktif untuk digunakan di beberapa test."""
    return save_dummy_session(user_token)


# ============================================================
# PLAYWRIGHT FIXTURES
# ============================================================

@pytest.fixture(scope="session")
def browser_context_args():
    return {
        "viewport": {"width": 1280, "height": 800},
        "record_video_dir": str(REPORTS_DIR / "videos"),
    }


@pytest.fixture
def ui_page(page: Page):
    """Wrapper page dengan screenshot otomatis on failure."""
    yield page


@pytest.fixture
def logged_in_page(page: Page, user_token, user_refresh_token):
    """
    Page yang sudah login sebagai user — inject token via sessionStorage.
    Reuse user_token/user_refresh_token (session-scoped) agar tidak memicu rate limit.
    """
    if not user_token:
        pytest.skip("Tidak bisa dapatkan token untuk logged_in_page — server down")

    d = TEST_USERS["user"]

    # Buka halaman terlebih dahulu agar sessionStorage tersedia di origin yang benar
    page.goto(BASE_URL_UI)
    page.wait_for_load_state("domcontentloaded")

    # Inject token langsung ke sessionStorage (sama persis dengan TokenStore.set())
    page.evaluate(f"""() => {{
        sessionStorage.setItem('access_token',  '{user_token}');
        sessionStorage.setItem('refresh_token', '{user_refresh_token or ""}');
        sessionStorage.setItem('role',          'user');
        sessionStorage.setItem('username',      '{d["username"]}');
    }}""")

    # Navigate ke /practice (halaman utama setelah login)
    page.goto(f"{BASE_URL_UI}/practice")
    page.wait_for_load_state("networkidle", timeout=10000)
    screenshot(page, "logged_in_page_setup")
    yield page
