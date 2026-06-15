"""
test_admin.py — Pengujian Modul Manajemen Admin
TC-ADMIN-01 s/d TC-ADMIN-06
"""

import pytest
import requests
from conftest import BASE_URL_API, auth_headers, TEST_USERS

pytestmark = pytest.mark.admin
BASE = BASE_URL_API


class TestAdminUserManagement:

    def test_TC_ADMIN_01_admin_lihat_semua_user(self, admin_token):
        """TC-ADMIN-01: Admin dapat melihat daftar semua pengguna."""
        resp = requests.get(
            f"{BASE}/api/admin/users",
            headers=auth_headers(admin_token)
        )
        print(f"\n[TC-ADMIN-01] Status: {resp.status_code} | Body: {resp.text[:400]}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        users = data if isinstance(data, list) else data.get("users", [])
        print(f"  → Jumlah pengguna: {len(users)}")
        assert len(users) >= 1, "Daftar pengguna tidak boleh kosong"

    def test_TC_ADMIN_02_user_biasa_tidak_bisa_lihat_users(self, user_token):
        """TC-ADMIN-02: User biasa tidak boleh mengakses daftar pengguna."""
        resp = requests.get(
            f"{BASE}/api/admin/users",
            headers=auth_headers(user_token)
        )
        print(f"\n[TC-ADMIN-02] Status: {resp.status_code}")
        assert resp.status_code in (401, 403), \
            f"User biasa tidak seharusnya akses admin endpoint, got {resp.status_code}"

    def test_TC_ADMIN_03_rater_tidak_bisa_akses_admin(self, rater1_token):
        """TC-ADMIN-03: Rater tidak boleh mengakses endpoint admin."""
        resp = requests.get(
            f"{BASE}/api/admin/users",
            headers=auth_headers(rater1_token)
        )
        print(f"\n[TC-ADMIN-03] Status: {resp.status_code}")
        assert resp.status_code in (401, 403), \
            f"Rater tidak seharusnya akses admin endpoint, got {resp.status_code}"

    def test_TC_ADMIN_04_admin_edit_user(self, admin_token):
        """TC-ADMIN-04: Admin dapat mengedit data pengguna."""
        # Ambil daftar user dulu untuk dapat ID
        users_resp = requests.get(
            f"{BASE}/api/admin/users",
            headers=auth_headers(admin_token)
        )
        if users_resp.status_code != 200:
            pytest.skip("Tidak bisa ambil daftar user")

        data = users_resp.json()
        users = data if isinstance(data, list) else data.get("users", [])

        # Cari user biasa (bukan admin yang sedang login)
        target = next(
            (u for u in users if u.get("role") == "user" or u.get("username") == "test_user"),
            None
        )
        if not target:
            pytest.skip("Tidak ada user target untuk diedit")

        user_id = target.get("id") or target.get("user_id")
        resp = requests.patch(
            f"{BASE}/api/admin/users/{user_id}",
            headers=auth_headers(admin_token),
            json={"username": target.get("username", "test_user")}
        )
        print(f"\n[TC-ADMIN-04] Status: {resp.status_code} | Body: {resp.text[:300]}")
        assert resp.status_code in (200, 201, 204), \
            f"Expected 200/204, got {resp.status_code}"


class TestAdminScenarioManagement:

    def test_TC_ADMIN_05_lihat_semua_skenario(self, admin_token):
        """TC-ADMIN-05: Admin dapat melihat daftar skenario."""
        resp = requests.get(
            f"{BASE}/api/scenarios",
            headers=auth_headers(admin_token)
        )
        print(f"\n[TC-ADMIN-05] Status: {resp.status_code} | Body: {resp.text[:400]}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        scenarios = data if isinstance(data, list) else data.get("scenarios", [])
        print(f"  → Jumlah skenario: {len(scenarios)}")
        assert len(scenarios) >= 1, "Harus ada minimal 1 skenario"

    def test_TC_ADMIN_06_user_juga_bisa_lihat_skenario(self, user_token):
        """TC-ADMIN-06: User juga bisa melihat daftar skenario (public endpoint)."""
        resp = requests.get(
            f"{BASE}/api/scenarios",
            headers=auth_headers(user_token)
        )
        print(f"\n[TC-ADMIN-06] Status: {resp.status_code}")
        assert resp.status_code == 200, \
            f"User seharusnya bisa lihat skenario, got {resp.status_code}"
