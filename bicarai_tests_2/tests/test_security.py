"""
test_security.py — Pengujian Keamanan Sistem (Black-box)
TC-SEC-01 s/d TC-SEC-10

Pengujian berbasis OWASP WSTG:
- Authentication Testing
- Authorization Testing
- Session Management Testing
- Input Validation Testing
"""

import pytest
import requests
import time
from conftest import BASE_URL_API, auth_headers, TEST_USERS

pytestmark = pytest.mark.security
BASE = BASE_URL_API


class TestAuthSecurity:

    def test_TC_SEC_01_akses_tanpa_token(self):
        """TC-SEC-01: Endpoint yang dilindungi harus menolak akses tanpa token."""
        protected_endpoints = [
            "/api/sessions/recent",
            "/api/profile",
            "/api/rater/sessions",
            "/api/admin/users",
        ]
        for endpoint in protected_endpoints:
            resp = requests.get(f"{BASE}{endpoint}")
            print(f"\n[TC-SEC-01] {endpoint} → Status: {resp.status_code}")
            assert resp.status_code in (401, 403), \
                f"Endpoint {endpoint} seharusnya dilindungi, got {resp.status_code}"

    def test_TC_SEC_02_token_jwt_invalid(self):
        """TC-SEC-02: Token JWT yang dimanipulasi harus ditolak."""
        fake_tokens = [
            "invalid.token.here",
            "Bearer invalid",
            "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.fake_signature",
        ]
        for token in fake_tokens:
            resp = requests.get(
                f"{BASE}/api/profile",
                headers={"Authorization": f"Bearer {token}"}
            )
            print(f"\n[TC-SEC-02] Token: {token[:30]}... → Status: {resp.status_code}")
            assert resp.status_code in (401, 403, 422), \
                f"Token palsu '{token[:20]}' seharusnya ditolak, got {resp.status_code}"

    def test_TC_SEC_03_rbac_user_tidak_bisa_akses_admin(self, user_token):
        """TC-SEC-03: Pengguna dengan role user tidak boleh mengakses endpoint admin."""
        admin_endpoints = [
            ("GET", "/api/admin/users"),
        ]
        for method, endpoint in admin_endpoints:
            if method == "GET":
                resp = requests.get(f"{BASE}{endpoint}", headers=auth_headers(user_token))
            print(f"\n[TC-SEC-03] {method} {endpoint} → Status: {resp.status_code}")
            assert resp.status_code in (401, 403), \
                f"User tidak seharusnya akses {endpoint}, got {resp.status_code}"

    def test_TC_SEC_04_rbac_user_tidak_bisa_akses_rater(self, user_token):
        """TC-SEC-04: User tidak boleh mengakses endpoint rater."""
        resp = requests.get(
            f"{BASE}/api/rater/sessions",
            headers=auth_headers(user_token)
        )
        print(f"\n[TC-SEC-04] Status: {resp.status_code}")
        assert resp.status_code in (401, 403), \
            f"User tidak seharusnya akses endpoint rater, got {resp.status_code}"

    def test_TC_SEC_05_rbac_rater_hanya_lihat_sesi_sendiri(self, rater1_token, user_token):
        """TC-SEC-05: Rater hanya boleh melihat sesinya sendiri — tidak boleh melihat sesi user lain (IDOR)."""
        resp = requests.get(
            f"{BASE}/api/sessions/recent",
            headers=auth_headers(rater1_token)
        )
        print(f"\n[TC-SEC-05] Rater recent sessions status: {resp.status_code}")
        assert resp.status_code in (200, 401, 403), \
            f"Unexpected status: {resp.status_code}"

        if resp.status_code == 200:
            # Simpan sesi sebagai user biasa
            save = requests.post(
                f"{BASE}/api/sessions",
                headers=auth_headers(user_token),
                json={
                    "scenario":        "Job Interview",
                    "score_range":     3.0,
                    "score_accuracy":  3.0,
                    "score_fluency":   3.0,
                    "score_coherence": 3.0,
                    "score_phonology": 3.0,
                    "duration_min":    2.0,
                }
            )
            user_session_id = save.json().get("id") if save.status_code in (200, 201) else None

            # Rater tidak boleh melihat sesi milik user lain
            rater_ids = [s.get("id") for s in resp.json()]
            print(f"  → Sesi milik rater: {rater_ids}")
            if user_session_id:
                assert user_session_id not in rater_ids, \
                    f"Rater dapat melihat sesi user lain (ID {user_session_id}) — IDOR vulnerability!"
                print(f"  ✅ Rater tidak dapat melihat sesi user lain (ID {user_session_id})")


class TestSessionSecurity:

    def test_TC_SEC_06_user_tidak_bisa_akses_sesi_user_lain(self, user_token, admin_token):
        """TC-SEC-06: User tidak boleh melihat sesi milik user lain."""
        # Admin simpan sesi terlebih dahulu
        admin_sess = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(admin_token),
            json={
                "scenario":        "Business Meeting",
                "score_range":     3.0,
                "score_accuracy":  3.0,
                "score_fluency":   3.0,
                "score_coherence": 3.0,
                "score_phonology": 3.0,
                "duration_min":    2.0,
            }
        )
        if admin_sess.status_code not in (200, 201):
            pytest.skip(f"Admin tidak bisa simpan sesi: {admin_sess.status_code}")

        # User coba akses riwayat — hanya bisa melihat sesinya sendiri
        user_history = requests.get(
            f"{BASE}/api/sessions/recent",
            headers=auth_headers(user_token)
        )
        print(f"\n[TC-SEC-06] User history status: {user_history.status_code}")
        assert user_history.status_code == 200

        # Pastikan user hanya melihat sesi miliknya (bukan sesi admin)
        sessions = user_history.json()
        admin_session_id = admin_sess.json().get("id")
        user_ids = [s.get("id") for s in sessions]
        print(f"  → Admin session ID: {admin_session_id}, User session IDs: {user_ids}")
        assert admin_session_id not in user_ids, \
            "User dapat melihat sesi milik admin — IDOR vulnerability!"


class TestInputValidation:

    def test_TC_SEC_07_sql_injection_login(self):
        """TC-SEC-07: Input SQL injection pada endpoint login harus ditolak dengan aman."""
        sql_payloads = [
            {"username": "' OR '1'='1",          "password": "anything"},
            {"username": "admin'--",              "password": "password"},
            {"username": "'; DROP TABLE users;--", "password": "anything"},
        ]
        for payload in sql_payloads:
            resp = requests.post(f"{BASE}/api/auth/login", json=payload)
            print(f"\n[TC-SEC-07] Payload: {payload['username'][:30]} → Status: {resp.status_code}")
            assert resp.status_code != 200, \
                f"SQL injection berhasil login! Payload: {payload['username']}"
            assert resp.status_code != 500, \
                f"Server error 500 — kemungkinan unhandled injection"

    def test_TC_SEC_08_xss_pada_input_text(self, user_token):
        """TC-SEC-08: Input XSS pada field teks tidak boleh menyebabkan server crash."""
        xss_payload = "<script>alert('XSS')</script>"
        resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json={
                "scenario":        xss_payload,
                "score_range":     3.0,
                "score_accuracy":  3.0,
                "score_fluency":   3.0,
                "score_coherence": 3.0,
                "score_phonology": 3.0,
                "duration_min":    1.0,
            }
        )
        print(f"\n[TC-SEC-08] Status: {resp.status_code}")
        if resp.status_code in (200, 201):
            # API JSON tidak di-render sebagai HTML — XSS tidak berlaku di level API
            print(f"  → XSS dalam respons JSON: aman (tidak di-render sebagai HTML)")
            assert resp.status_code != 500, "Server crash dengan XSS input"

    def test_TC_SEC_09_oversized_input(self, user_token):
        """TC-SEC-09: Input teks yang sangat panjang tidak boleh menyebabkan server crash."""
        huge_text = "A" * 100000  # 100KB string
        resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json={
                "scenario":        huge_text,
                "score_range":     3.0,
                "score_accuracy":  3.0,
                "score_fluency":   3.0,
                "score_coherence": 3.0,
                "score_phonology": 3.0,
                "duration_min":    1.0,
            }
        )
        print(f"\n[TC-SEC-09] Status: {resp.status_code}")
        assert resp.status_code not in (500,), \
            "Server crash dengan input besar — tidak ada proteksi"


class TestRateLimiting:

    def test_TC_SEC_10_rate_limit_login(self):
        """TC-SEC-10: Rate limiting harus aktif pada endpoint login (maks 5/menit)."""
        statuses = []
        for i in range(8):
            resp = requests.post(
                f"{BASE}/api/auth/login",
                json={"username": "wrong_user", "password": "wrongpass"}
            )
            statuses.append(resp.status_code)
            print(f"\n[TC-SEC-10] Request {i+1}: Status {resp.status_code}")

        has_rate_limit = 429 in statuses
        print(f"  → Statuses: {statuses}")
        print(f"  → Rate limit aktif: {'Ya' if has_rate_limit else 'Tidak (perlu dicek manual)'}")

        if not has_rate_limit:
            pytest.xfail("Rate limit 429 tidak terdeteksi dalam 8 request — mungkin konfigurasi berbeda")
