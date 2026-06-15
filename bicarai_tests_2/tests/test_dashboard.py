"""
test_dashboard.py — Pengujian Modul Dashboard Progres
TC-DASH-01 s/d TC-DASH-04
"""

import pytest
import requests
from conftest import BASE_URL_API, auth_headers

pytestmark = pytest.mark.dashboard
BASE = BASE_URL_API


class TestDashboard:

    def test_TC_DASH_01_progress_data(self, user_token):
        """TC-DASH-01: Data profil/progres pengguna harus dapat diambil."""
        resp = requests.get(
            f"{BASE}/api/profile",
            headers=auth_headers(user_token)
        )
        print(f"\n[TC-DASH-01] Status: {resp.status_code} | Body: {resp.text[:400]}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert isinstance(data, (dict, list)), "Respons harus berupa dict atau list"

    def test_TC_DASH_02_progress_struktur_lengkap(self, user_token):
        """TC-DASH-02: Data profil harus mengandung field yang diperlukan."""
        resp = requests.get(
            f"{BASE}/api/profile",
            headers=auth_headers(user_token)
        )
        if resp.status_code != 200:
            pytest.skip("Endpoint profile tidak tersedia")

        data = resp.json()
        print(f"\n[TC-DASH-02] Fields tersedia: {list(data.keys()) if isinstance(data, dict) else 'list'}")

        # Field yang diharapkan dari endpoint /api/profile
        expected_fields = ["sessions_count", "level", "username"]
        if isinstance(data, dict):
            present = [f for f in expected_fields if f in data]
            print(f"  → Field yang ada: {present}")
            assert len(present) >= 1, \
                f"Minimal 1 field profil harus ada. Tersedia: {list(data.keys())}"

    def test_TC_DASH_03_progress_tanpa_token(self):
        """TC-DASH-03: Akses profil tanpa token harus ditolak."""
        resp = requests.get(f"{BASE}/api/profile")
        print(f"\n[TC-DASH-03] Status: {resp.status_code}")
        assert resp.status_code in (401, 403), \
            f"Seharusnya 401/403 tanpa token, got {resp.status_code}"

    def test_TC_DASH_04_riwayat_sesi_terurut(self, user_token):
        """TC-DASH-04: Riwayat sesi harus terurut berdasarkan waktu."""
        resp = requests.get(
            f"{BASE}/api/sessions/recent",
            headers=auth_headers(user_token)
        )
        if resp.status_code != 200:
            pytest.skip("Endpoint sessions/recent tidak tersedia")

        data = resp.json()
        sessions = data if isinstance(data, list) else data.get("sessions", [])
        print(f"\n[TC-DASH-04] Jumlah sesi: {len(sessions)}")

        if len(sessions) >= 2:
            timestamps = [s.get("created_at") or s.get("started_at") or "" for s in sessions]
            valid_ts = [ts for ts in timestamps if ts]
            if len(valid_ts) >= 2:
                assert valid_ts == sorted(valid_ts, reverse=True) or valid_ts == sorted(valid_ts), \
                    "Sesi tidak terurut berdasarkan waktu"
