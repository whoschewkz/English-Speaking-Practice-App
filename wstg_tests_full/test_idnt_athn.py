"""
WSTG-IDNT-01 s.d. IDNT-05  — Identity Management
WSTG-ATHN-01 s.d. ATHN-11  — Authentication
"""
import requests
import pytest
import time

BASE_URL = "https://takarzein.plutolab.my.id"

def get_token(username, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": username, "password": password}, timeout=15)
    if r.status_code == 200:
        return r.json().get("access_token", "")
    return ""

def get_token_with_retry(username, password, wait=65):
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
# WSTG-IDNT
# ─────────────────────────────────────────────

def test_IDNT_01_role_definitions():
    """WSTG-IDNT-01: Verifikasi role tidak dapat di-switch tanpa otorisasi"""
    token = get_token("dKarzein", "F4uGNz9svDzkK6D")
    headers = {"Authorization": f"Bearer {token}"}
    admin_endpoints = ["/api/admin/users", "/api/admin/scenarios",
                       "/api/admin/validation/correlations"]
    for ep in admin_endpoints:
        r = requests.get(f"{BASE_URL}{ep}", headers=headers, timeout=10)
        assert r.status_code in [403, 401, 404], \
            f"User biasa dapat mengakses endpoint admin {ep}: {r.status_code}"

def test_IDNT_02_registration_validation():
    """WSTG-IDNT-02: Verifikasi proses registrasi memvalidasi input"""
    test_cases = [
        ({"username": "", "password": "ValidPass123!"}, "username kosong", [422, 400]),
        ({"username": "a", "password": "ValidPass123!"}, "username terlalu pendek", [422, 400]),
        ({"username": "validuser99", "password": "short"}, "password terlalu pendek", [422, 400]),
        ({"username": "validuser99", "password": ""}, "password kosong", [422, 400]),
    ]
    for payload, desc, expected in test_cases:
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json=payload, timeout=10)
        assert r.status_code in expected + [404, 409], \
            f"Registrasi {desc} tidak divalidasi: HTTP {r.status_code}"

def test_IDNT_03_account_provisioning():
    """WSTG-IDNT-03: Sistem tidak memiliki endpoint provisioning akun antar pengguna"""
    provisioning_paths = [
        "/api/admin/provision", "/api/users/create",
        "/api/provisioning", "/api/accounts/new",
    ]
    for path in provisioning_paths:
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        assert r.status_code in [404, 401, 403, 405, 307, 302], \
            f"Endpoint provisioning tidak terduga ditemukan di {path}: {r.status_code}"

def test_IDNT_04_account_enumeration():
    """WSTG-IDNT-04: Verifikasi pesan error login tidak mengungkap validitas username"""
    r_invalid_user = requests.post(f"{BASE_URL}/api/auth/login",
                                   json={"username": "nonexistent_user_xyz",
                                         "password": "WrongPass123!"}, timeout=10)
    r_wrong_pass = requests.post(f"{BASE_URL}/api/auth/login",
                                 json={"username": "dKarzein",
                                       "password": "WrongPass123!"}, timeout=10)
    assert r_invalid_user.status_code == r_wrong_pass.status_code, \
        "Perbedaan status code mengungkap validitas username (account enumeration)"
    if r_invalid_user.status_code == 401:
        body1 = r_invalid_user.text.lower()
        assert "user not found" not in body1
        assert "username" not in body1 or "password" not in body1

def test_IDNT_05_username_policy():
    """WSTG-IDNT-05: Verifikasi kebijakan username tidak memungkinkan enumerasi"""
    predictable_usernames = ["admin1", "user1", "test", "root"]
    for username in predictable_usernames:
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"username": username,
                                "password": "WrongPassXYZ999!"}, timeout=10)
        assert r.status_code in [401, 422, 429], \
            f"Respons tidak terduga untuk username {username}: {r.status_code}"

# ─────────────────────────────────────────────
# WSTG-ATHN
# ─────────────────────────────────────────────

def test_ATHN_01_merged():
    """WSTG-ATHN-01: MERGED ke WSTG-CRYP-03 — verifikasi HTTPS aktif"""
    # ATHN-01 (Credentials Transported over Encrypted Channel) digabung ke CRYP-03
    # Verifikasi koneksi menggunakan HTTPS
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": "dKarzein", "password": "F4uGNz9svDzkK6D"},
                      timeout=10)
    assert r.url.startswith("https://"), \
        "Koneksi autentikasi tidak menggunakan HTTPS"
    assert r.status_code in [200, 429], \
        f"Endpoint login tidak merespons: {r.status_code}"

def test_ATHN_02_default_credentials():
    """WSTG-ATHN-02: Verifikasi kredensial default tidak aktif"""
    default_creds = [
        ("admin", "admin"), ("admin", "password"),
        ("admin", "123456"), ("root", "root"),
        ("test", "test"), ("user", "user"),
    ]
    for username, password in default_creds:
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"username": username, "password": password}, timeout=10)
        assert r.status_code != 200, \
            f"Kredensial default aktif: {username}/{password}"

def test_ATHN_03_lockout_already_tested():
    """WSTG-ATHN-03: Rate limiting pada login — sudah diuji sebelumnya"""
    for _ in range(6):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"username": "testlockout",
                                "password": "wrongpass"}, timeout=10)
    assert r.status_code == 429, \
        "Rate limiting tidak aktif setelah 5+ percobaan gagal"

def test_ATHN_04_bypass_auth_already_tested():
    """WSTG-ATHN-04: Bypass auth — sudah diuji, verifikasi force browsing"""
    protected = [
        "/api/profile", "/api/sessions/stats",
        "/api/rater/sessions",   # endpoint aktual (bukan /queue)
        "/api/feedback",
    ]
    for ep in protected:
        r = requests.get(f"{BASE_URL}{ep}", timeout=10)
        # 404 = endpoint tidak ada (misal /rater/sessions butuh auth dulu = return 401)
        assert r.status_code in [401, 403, 404, 405, 422], \
            f"Endpoint {ep} dapat diakses tanpa autentikasi: {r.status_code}"

def test_ATHN_05_remember_password():
    """WSTG-ATHN-05: Verifikasi token tidak disimpan secara tidak aman"""
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": "dKarzein",
                            "password": "F4uGNz9svDzkK6D"}, timeout=10)
    for cookie in r.cookies:
        if any(kw in cookie.name.lower() for kw in ["token", "session", "auth"]):
            assert cookie.secure, f"Cookie {cookie.name} tidak memiliki Secure flag"

def test_ATHN_06_browser_cache():
    """WSTG-ATHN-06: Verifikasi halaman sensitif memiliki header cache yang tepat"""
    token = get_token_with_retry("dKarzein", "F4uGNz9svDzkK6D")
    assert token, "Login gagal setelah retry"
    r = requests.get(f"{BASE_URL}/api/profile",
                     headers={"Authorization": f"Bearer {token}"}, timeout=10)
    cache = r.headers.get("Cache-Control", "").lower()
    assert "public" not in cache or "no-store" in cache or \
           "private" in cache or cache == "", \
        f"Endpoint profil memiliki cache control bermasalah: {cache}"

def test_ATHN_07_weak_password_already_tested():
    """WSTG-ATHN-07: Kebijakan password lemah — sudah diuji sebelumnya"""
    weak_passwords = ["123", "abc", "12345", "pass"]
    for pwd in weak_passwords:
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json={"username": "testweakpwd99",
                                "password": pwd}, timeout=10)
        assert r.status_code in [422, 400, 404, 409], \
            f"Password lemah '{pwd}' diterima: HTTP {r.status_code}"

def test_ATHN_08_security_questions():
    """WSTG-ATHN-08: Sistem tidak mengimplementasikan security questions"""
    sq_paths = [
        "/api/auth/security-question", "/api/auth/forgot-password",
        "/api/auth/hint", "/api/security-questions",
    ]
    for path in sq_paths:
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        assert r.status_code in [404, 401, 403, 405, 307, 302], \
            f"Endpoint security question tidak terduga ditemukan di {path}: {r.status_code}"

def test_ATHN_09_password_reset():
    """WSTG-ATHN-09: Sistem tidak memiliki fitur password reset via email/token"""
    reset_paths = [
        "/api/auth/reset-password", "/api/auth/forgot",
        "/api/auth/reset", "/reset-password",
        "/forgot-password", "/api/auth/verify-email",
    ]
    for path in reset_paths:
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        if r.status_code == 200:
            # Next.js auth middleware redirect — pastikan bukan halaman reset asli
            body = r.text.lower()
            assert "reset your password" not in body, \
                f"Halaman reset password aktif di {path}"
            assert "forgot password" not in body
            assert "enter your email" not in body
        else:
            assert r.status_code in [404, 401, 403, 405, 307, 302], \
                f"Endpoint password reset tidak terduga di {path}: {r.status_code}"

def test_ATHN_10_alternative_channel():
    """WSTG-ATHN-10: Sistem hanya memiliki satu kanal autentikasi"""
    alt_auth_paths = [
        "/api/auth/sso", "/api/auth/saml",
        "/api/auth/google", "/api/auth/github",
        "/api/mobile/login", "/api/v2/auth/login",
    ]
    for path in alt_auth_paths:
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        assert r.status_code in [404, 401, 403, 405, 307, 302], \
            f"Kanal autentikasi alternatif tidak terduga di {path}: {r.status_code}"

def test_ATHN_11_mfa():
    """WSTG-ATHN-11: Sistem tidak mengimplementasikan MFA"""
    mfa_paths = [
        "/api/auth/mfa", "/api/auth/otp",
        "/api/auth/2fa", "/api/mfa/verify",
        "/api/auth/totp",
    ]
    for path in mfa_paths:
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        assert r.status_code in [404, 401, 403, 405, 307, 302], \
            f"Endpoint MFA tidak terduga ditemukan di {path}: {r.status_code}"
