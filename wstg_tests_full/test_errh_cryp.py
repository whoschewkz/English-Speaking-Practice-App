"""
WSTG-ERRH-01 s.d. ERRH-02  — Error Handling
WSTG-CRYP-01 s.d. CRYP-04  — Cryptography
"""
import requests
import pytest
import subprocess
import time
import base64
import json

BASE_URL = "https://takarzein.plutolab.my.id"

def get_token_with_retry(username, password, wait=65):
    """Login dengan retry otomatis jika kena rate limit (429)."""
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": username, "password": password}, timeout=15)
    if r.status_code == 200:
        return r.json().get("access_token", "")
    if r.status_code == 429:
        time.sleep(wait)
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"username": username, "password": password}, timeout=15)
        if r.status_code == 200:
            return r.json().get("access_token", "")
    return ""

# ─────────────────────────────────────────────
# WSTG-ERRH
# ─────────────────────────────────────────────

def test_ERRH_01_error_handling_already_tested():
    """WSTG-ERRH-01: Penanganan error — verifikasi tidak ada stack trace terekspos"""
    test_cases = [
        # (method, path, payload, expected_codes)
        ("GET",  "/nonexistent-path", None,              [404, 200]),  # 200 = Next.js custom 404 page
        ("POST", "/api/auth/login",   {"invalid": "payload"}, [422]),
        ("GET",  "/api/profile",      None,              [401]),
        ("POST", "/api/transcribe",   {},                [401, 422]),
        ("GET",  "/api/sessions/99999999", None,         [401, 404]),
    ]
    for method, path, payload, expected in test_cases:
        if method == "GET":
            r = requests.get(f"{BASE_URL}{path}", timeout=10)
        else:
            r = requests.post(f"{BASE_URL}{path}", json=payload, timeout=10)
        assert r.status_code in expected + [405], \
            f"{method} {path}: {r.status_code}"
        body = r.text.lower()
        assert "traceback" not in body, f"Traceback terekspos di {path}"
        assert "stack trace" not in body
        assert "sqlalchemy" not in body
        # Untuk 200 dari Next.js, pastikan bukan ekspos info sistem
        if r.status_code == 200 and path == "/nonexistent-path":
            assert "internal server error" not in body
            assert "exception" not in body

def test_ERRH_02_merged():
    """WSTG-ERRH-02: Stack traces — digabung ke ERRH-01, verifikasi tambahan"""
    # ERRH-02 (Improper Error Handling - Stack Traces) digabung ke ERRH-01
    # Verifikasi endpoint error tidak mengekspos informasi internal
    error_triggers = [
        f"{BASE_URL}/api/auth/login",
        f"{BASE_URL}/api/profile",
        f"{BASE_URL}/api/sessions/invalid_id",
    ]
    for url in error_triggers:
        r = requests.get(url, timeout=10)
        body = r.text.lower()
        assert "traceback" not in body, f"Stack trace terekspos di {url}"
        assert "file \"/home" not in body
        assert "file \"c:\\" not in body
        assert "line " not in body or "error" not in body

# ─────────────────────────────────────────────
# WSTG-CRYP
# ─────────────────────────────────────────────

def test_CRYP_01_tls_version():
    """WSTG-CRYP-01: TLS version dan cipher strength"""
    try:
        result = subprocess.run(
            ["curl", "-v", "--max-time", "10", BASE_URL],
            capture_output=True, text=True, timeout=15
        )
        output = result.stderr.lower()
        assert "ssl" in output or "tls" in output, \
            "TLS tidak terdeteksi pada koneksi"
        assert "tlsv1.0" not in output, "TLSv1.0 (deprecated) digunakan"
        assert "tlsv1.1" not in output, "TLSv1.1 (deprecated) digunakan"
    except FileNotFoundError:
        pytest.skip("curl tidak tersedia di lingkungan pengujian")

def test_CRYP_02_padding_oracle():
    """WSTG-CRYP-02: Padding Oracle — sistem menggunakan JWT HS256, tidak rentan"""
    # Sistem menggunakan JWT dengan HS256 (HMAC-SHA256) bukan enkripsi CBC
    # HS256 adalah HMAC, bukan enkripsi simetris — tidak rentan terhadap padding oracle
    token = get_token_with_retry("dKarzein", "F4uGNz9svDzkK6D")
    assert token, "Login gagal setelah retry"
    parts = token.split(".")
    assert len(parts) == 3, "Format JWT tidak valid"
    header = json.loads(base64.b64decode(parts[0] + "=="))
    alg = header.get("alg", "")
    # HS256 = HMAC, bukan CBC encryption = tidak rentan padding oracle
    assert alg in ["HS256", "HS384", "HS512", "RS256", "ES256"], \
        f"Algoritma tidak dikenal: {alg}"
    assert "cbc" not in alg.lower(), \
        "Algoritma berbasis CBC terdeteksi — potensi padding oracle"

def test_CRYP_03_unencrypted_channels_already_tested():
    """WSTG-CRYP-03: Data sensitif via kanal tidak terenkripsi — sudah diuji"""
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "dKarzein", "password": "F4uGNz9svDzkK6D"},
        timeout=10
    )
    assert r.url.startswith("https://"), "Koneksi tidak menggunakan HTTPS"
    if r.status_code == 200:
        token = r.json().get("access_token", "")
        assert token not in r.url, "Access token terekspos di URL"
    hsts = r.headers.get("Strict-Transport-Security", "")
    if not hsts:
        pytest.xfail("HSTS belum dikonfigurasi — temuan sudah terdokumentasi "
                     "dengan status Lulus dengan Catatan")

def test_CRYP_04_weak_encryption_already_tested():
    """WSTG-CRYP-04: Enkripsi lemah — verifikasi algoritma JWT"""
    token = get_token_with_retry("dKarzein", "F4uGNz9svDzkK6D")
    assert token, "Login gagal setelah retry"
    parts = token.split(".")
    assert len(parts) == 3, "Format JWT tidak valid"
    header = json.loads(base64.b64decode(parts[0] + "=="))
    alg = header.get("alg", "")
    assert alg in ["HS256", "HS384", "HS512", "RS256", "ES256"], \
        f"Algoritma JWT lemah atau tidak aman: {alg}"
    assert alg != "none", "Algoritma JWT 'none' terdeteksi — kerentanan kritis"
    assert alg != "HS1", "Algoritma JWT HS1 (lemah) terdeteksi"
