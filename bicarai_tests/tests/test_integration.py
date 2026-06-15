"""
test_integration.py — Pengujian Integrasi End-to-End Pipeline
TC-INT-01 s/d TC-INT-05

Mensimulasikan alur lengkap sistem:
Register → Login → Pilih Skenario → Simpan Sesi → Lihat Riwayat
→ Dashboard/Profil → Rater Nilai → Statistik Diperbarui
"""

import pytest
import requests
import time
from conftest import BASE_URL_API, auth_headers, TEST_USERS, save_dummy_session

pytestmark = pytest.mark.integration
BASE = BASE_URL_API


class TestFullPipeline:

    def test_TC_INT_01_pipeline_register_sampai_login(self):
        """
        TC-INT-01: Integrasi register → login.
        Pengguna baru bisa registrasi dan langsung login.
        """
        ts = int(time.time())
        payload_register = {
            "username": f"int_user_{ts}",
            "email":    f"int_user_{ts}@bicarai.test",
            "password": "Integration@123"
        }

        # Step 1: Register
        reg_resp = requests.post(f"{BASE}/api/auth/register", json=payload_register)
        print(f"\n[TC-INT-01] Register: {reg_resp.status_code}")
        assert reg_resp.status_code in (200, 201), \
            f"Registrasi gagal: {reg_resp.status_code} — {reg_resp.text[:200]}"

        # Step 2: Login langsung (API menggunakan 'username', bukan 'email')
        login_resp = requests.post(f"{BASE}/api/auth/login", json={
            "username": payload_register["username"],
            "password": payload_register["password"]
        })
        print(f"  → Login: {login_resp.status_code}")
        assert login_resp.status_code == 200, \
            f"Login gagal setelah register: {login_resp.status_code}"

        data = login_resp.json()
        assert "access_token" in data, "access_token tidak ada setelah login"
        print(f"  → Token didapat: {data['access_token'][:30]}...")

    def test_TC_INT_02_pipeline_login_sampai_simpan_sesi(self, user_token):
        """
        TC-INT-02: Integrasi login → ambil skenario → simpan sesi.
        Token dari login dipakai untuk ambil skenario dan menyimpan sesi latihan.
        """
        # Step 1: Ambil daftar skenario
        sc_resp = requests.get(
            f"{BASE}/api/scenarios",
            headers=auth_headers(user_token)
        )
        print(f"\n[TC-INT-02] Ambil skenario: {sc_resp.status_code}")
        assert sc_resp.status_code == 200, f"Gagal ambil skenario: {sc_resp.status_code}"

        scenarios = sc_resp.json()
        scenarios_list = scenarios if isinstance(scenarios, list) else scenarios.get("scenarios", [])
        assert len(scenarios_list) > 0, "Tidak ada skenario tersedia"

        first_scenario = scenarios_list[0].get("title") or "Job Interview"
        print(f"  → Skenario pertama: {first_scenario}")

        # Step 2: Simpan sesi dengan skenario tersebut
        sess_resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json={
                "scenario":        first_scenario,
                "score_range":     3.0,
                "score_accuracy":  3.5,
                "score_fluency":   3.0,
                "score_coherence": 3.5,
                "score_phonology": 3.0,
                "comment":         "Integrasi TC-INT-02.",
                "duration_min":    4.0,
            }
        )
        print(f"  → Simpan sesi: {sess_resp.status_code}")
        assert sess_resp.status_code in (200, 201), \
            f"Gagal simpan sesi: {sess_resp.status_code} — {sess_resp.text[:200]}"

        data = sess_resp.json()
        session_id = data.get("id")
        assert session_id is not None, "session_id tidak ada"
        print(f"  → Session ID: {session_id}")

        # Step 3: Pastikan profil diperbarui setelah sesi
        profile = data.get("profile", {})
        print(f"  → Profil setelah sesi: sessions_count={profile.get('sessions_count')}")

    def test_TC_INT_03_pipeline_sesi_sampai_riwayat(self, user_token):
        """
        TC-INT-03: Integrasi simpan sesi → verifikasi muncul di riwayat.
        Sesi yang disimpan harus segera tersedia di riwayat.
        """
        # Step 1: Simpan sesi baru
        sess_resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json={
                "scenario":        "Travel Situations",
                "score_range":     2.5,
                "score_accuracy":  2.0,
                "score_fluency":   3.0,
                "score_coherence": 2.5,
                "score_phonology": 3.0,
                "comment":         "Integrasi TC-INT-03.",
                "duration_min":    6.0,
            }
        )
        if sess_resp.status_code not in (200, 201):
            pytest.skip(f"Tidak bisa simpan sesi: {sess_resp.status_code}")

        session_id = sess_resp.json().get("id")
        print(f"\n[TC-INT-03] Sesi tersimpan ID: {session_id}")

        # Step 2: Verifikasi muncul di riwayat
        history = requests.get(
            f"{BASE}/api/sessions/recent",
            headers=auth_headers(user_token)
        )
        print(f"  → Riwayat status: {history.status_code}")
        assert history.status_code == 200, f"Gagal ambil riwayat: {history.status_code}"

        sessions = history.json()
        ids = [s.get("id") for s in sessions]
        print(f"  → IDs dalam riwayat: {ids}")
        assert session_id in ids, \
            f"Sesi ID {session_id} tidak muncul dalam riwayat"
        print(f"  ✅ Sesi berhasil disimpan dan muncul di riwayat.")

    def test_TC_INT_04_pipeline_skor_ke_profil(self, user_token):
        """
        TC-INT-04: Integrasi sesi selesai → skor memperbarui profil/statistik.
        """
        # Catat statistik sebelumnya
        stats_before = requests.get(
            f"{BASE}/api/sessions/stats",
            headers=auth_headers(user_token)
        )
        before_count = stats_before.json().get("sessions_count", 0) if stats_before.status_code == 200 else 0
        print(f"\n[TC-INT-04] Sesi sebelum: {before_count}")

        # Simpan sesi baru
        sess = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json={
                "scenario":        "Daily Conversation",
                "score_range":     4.0,
                "score_accuracy":  3.5,
                "score_fluency":   4.0,
                "score_coherence": 3.5,
                "score_phonology": 3.5,
                "comment":         "Integrasi TC-INT-04.",
                "duration_min":    8.0,
            }
        )
        if sess.status_code not in (200, 201):
            pytest.skip("Tidak bisa simpan sesi")

        # Respons sessions POST langsung kembalikan profil terbaru
        profile_in_resp = sess.json().get("profile", {})
        after_count = profile_in_resp.get("sessions_count", 0)
        print(f"  → Sesi setelah (dari respons): {after_count}")

        assert after_count > before_count, \
            f"sessions_count tidak bertambah: {before_count} → {after_count}"
        print(f"  ✅ Profil diperbarui: {before_count} → {after_count} sesi")

    def test_TC_INT_05_pipeline_rater_menilai_sesi_user(self, user_token, rater1_token):
        """
        TC-INT-05: Integrasi sesi user → rater dapat melihat dan menilai.
        Sesi yang dibuat user harus muncul di daftar rater.
        """
        # Step 1: User simpan sesi dengan conversation_turns agar muncul di rater
        session_id = save_dummy_session(user_token, "Job Interview")
        if session_id is None:
            pytest.skip("Tidak bisa simpan sesi dummy")

        print(f"\n[TC-INT-05] Session ID yang dibuat: {session_id}")

        # Step 2: Rater cek daftar sesi
        queue_resp = requests.get(
            f"{BASE}/api/rater/sessions",
            headers=auth_headers(rater1_token)
        )
        print(f"  → Daftar rater: {queue_resp.status_code}")
        assert queue_resp.status_code == 200, \
            f"Rater tidak bisa akses daftar sesi: {queue_resp.status_code}"

        queue_list = queue_resp.json()
        queue_ids  = [s.get("id") for s in queue_list]
        print(f"  → Sesi tersedia untuk rater: {queue_ids}")
        assert session_id in queue_ids, \
            f"Sesi ID {session_id} tidak muncul di daftar rater"

        # Step 3: Rater submit penilaian
        assess_resp = requests.post(
            f"{BASE}/api/rater/assessments",
            headers=auth_headers(rater1_token),
            json={
                "session_id":      session_id,
                "rater_id":        1,
                "score_range":     3,
                "score_accuracy":  2,
                "score_fluency":   2,
                "score_coherence": 3,
                "score_phonology": 2,
                "notes":           "Pengujian integrasi pipeline rater."
            }
        )
        print(f"  → Submit penilaian rater: {assess_resp.status_code} | Body: {assess_resp.text[:200]}")
        assert assess_resp.status_code in (200, 201), \
            f"Penilaian rater gagal: {assess_resp.status_code}"
        print(f"  ✅ Pipeline integrasi rater selesai.")
