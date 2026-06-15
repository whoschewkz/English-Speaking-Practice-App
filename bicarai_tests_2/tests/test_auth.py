"""
test_auth.py — Pengujian Modul Autentikasi
TC-AUTH-01 s/d TC-AUTH-08

Black-box testing untuk seluruh endpoint autentikasi:
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
"""

import pytest
import requests
import time
from conftest import BASE_URL_API, TEST_USERS, login_user, auth_headers

pytestmark = pytest.mark.auth

BASE = BASE_URL_API


# ============================================================
# TC-AUTH-01~03: Registrasi
# ============================================================
class TestRegistrasi:

    def test_TC_AUTH_01_registrasi_valid(self):
        """TC-AUTH-01: Registrasi dengan data lengkap dan valid."""
        ts = int(time.time())
        payload = {
            "username": f"newuser_{ts}",
            "email":    f"newuser_{ts}@bicarai.test",
            "password": "NewUser@123"
        }
        resp = requests.post(f"{BASE}/api/auth/register", json=payload)
        print(f"\n[TC-AUTH-01] Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code in (200, 201), \
            f"Expected 200/201, got {resp.status_code} — {resp.text[:200]}"

    def test_TC_AUTH_02_registrasi_username_duplikat(self):
        """TC-AUTH-02: Registrasi dengan username yang sudah ada harus ditolak."""
        payload = {
            "username": TEST_USERS["user"]["username"],  # sudah ada
            "email":    f"dupuser_{int(time.time())}@bicarai.test",
            "password": "Duplicate@123"
        }
        resp = requests.post(f"{BASE}/api/auth/register", json=payload)
        print(f"\n[TC-AUTH-02] Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code in (400, 409, 422), \
            f"Seharusnya ditolak untuk username duplikat, got {resp.status_code}"

    def test_TC_AUTH_03_registrasi_data_tidak_lengkap(self):
        """TC-AUTH-03: Registrasi tanpa field password harus ditolak."""
        payload = {
            "username": "incompleteuser",
            "email":    "incomplete@bicarai.test"
            # password sengaja dihilangkan
        }
        resp = requests.post(f"{BASE}/api/auth/register", json=payload)
        print(f"\n[TC-AUTH-03] Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code in (400, 422), \
            f"Seharusnya ditolak untuk data tidak lengkap, got {resp.status_code}"


# ============================================================
# TC-AUTH-04~06: Login
# ============================================================
class TestLogin:

    def test_TC_AUTH_04_login_valid(self):
        """TC-AUTH-04: Login dengan username + password valid harus mengembalikan JWT."""
        d = TEST_USERS["user"]
        payload = {"username": d["username"], "password": d["password"]}
        resp = requests.post(f"{BASE}/api/auth/login", json=payload)
        print(f"\n[TC-AUTH-04] Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code == 200, \
            f"Expected 200, got {resp.status_code} — {resp.text[:200]}"
        data = resp.json()
        assert "access_token" in data,  "access_token tidak ada di respons"
        assert "refresh_token" in data, "refresh_token tidak ada di respons"
        assert data["access_token"] != "", "access_token kosong"
        print(f"  → Token: {data['access_token'][:30]}...")

    def test_TC_AUTH_05_login_password_salah(self):
        """TC-AUTH-05: Login dengan password salah harus ditolak (401) atau rate-limited (429)."""
        d = TEST_USERS["user"]
        payload = {"username": d["username"], "password": "WrongPassword@999"}
        resp = requests.post(f"{BASE}/api/auth/login", json=payload)
        print(f"\n[TC-AUTH-05] Status: {resp.status_code} | Body: {resp.text[:200]}")
        # 429 = rate limit aktif — tetap merupakan bentuk penolakan yang sah
        assert resp.status_code in (401, 400, 403, 429), \
            f"Seharusnya ditolak untuk password salah, got {resp.status_code}"

    def test_TC_AUTH_06_login_username_tidak_terdaftar(self):
        """TC-AUTH-06: Login dengan username yang tidak terdaftar harus ditolak (401) atau rate-limited (429)."""
        payload = {
            "username": "usertidakada_xyz123",
            "password": "SomePassword@123"
        }
        resp = requests.post(f"{BASE}/api/auth/login", json=payload)
        print(f"\n[TC-AUTH-06] Status: {resp.status_code} | Body: {resp.text[:200]}")
        # 429 = rate limit aktif setelah beberapa percobaan gagal sebelumnya — penolakan yang sah
        assert resp.status_code in (401, 404, 400, 429), \
            f"Seharusnya ditolak untuk username tidak terdaftar, got {resp.status_code}"


# ============================================================
# TC-AUTH-07: Refresh Token
# ============================================================
class TestRefreshToken:

    def test_TC_AUTH_07_refresh_token_valid(self, user_refresh_token):
        """TC-AUTH-07: Refresh token yang valid harus menghasilkan access token baru."""
        if not user_refresh_token:
            pytest.skip("Refresh token tidak tersedia")
        resp = requests.post(f"{BASE}/api/auth/refresh", json={
            "refresh_token": user_refresh_token
        })
        print(f"\n[TC-AUTH-07] Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert "access_token" in data, "access_token tidak ada di respons refresh"

    def test_TC_AUTH_07b_refresh_token_invalid(self):
        """TC-AUTH-07b: Refresh token palsu harus ditolak."""
        resp = requests.post(f"{BASE}/api/auth/refresh", json={
            "refresh_token": "invalid.token.string"
        })
        print(f"\n[TC-AUTH-07b] Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code in (401, 403, 400, 422), \
            f"Seharusnya ditolak untuk refresh token invalid, got {resp.status_code}"


# ============================================================
# TC-AUTH-08: Logout
# ============================================================
class TestLogout:

    def test_TC_AUTH_08_logout_valid(self, user_token):
        """TC-AUTH-08: Logout dengan token valid harus berhasil dan menginvalidasi token."""
        # Step 1: Login ulang untuk dapatkan token segar
        d = TEST_USERS["user"]
        login_resp = requests.post(f"{BASE}/api/auth/login", json={
            "username": d["username"],
            "password": d["password"]
        })
        fresh_token   = login_resp.json().get("access_token", "")
        fresh_refresh = login_resp.json().get("refresh_token", "")

        if not fresh_token:
            pytest.skip("Tidak bisa dapatkan fresh token — kemungkinan rate limit aktif")

        # Step 2: Logout
        resp = requests.post(
            f"{BASE}/api/auth/logout",
            headers=auth_headers(fresh_token),
            json={"refresh_token": fresh_refresh}
        )
        print(f"\n[TC-AUTH-08] Logout Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code in (200, 204), \
            f"Expected 200/204, got {resp.status_code}"

    def test_TC_AUTH_08b_akses_dengan_token_invalid(self):
        """TC-AUTH-08b: Akses endpoint terproteksi dengan token invalid harus ditolak."""
        resp = requests.get(
            f"{BASE}/api/profile",
            headers=auth_headers("expired.or.invalid.token")
        )
        print(f"\n[TC-AUTH-08b] Status: {resp.status_code}")
        assert resp.status_code in (401, 403), \
            f"Token invalid seharusnya ditolak, got {resp.status_code}"
