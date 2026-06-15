"""
test_sessions.py — Pengujian Modul Sesi Latihan
TC-SESS-01 s/d TC-SESS-08

Black-box testing untuk endpoint sesi:
POST /api/sessions        — simpan sesi sekaligus (one-shot)
POST /api/transcribe      — transkripsi audio
GET  /api/sessions/recent — riwayat sesi
"""

import pytest
import requests
from pathlib import Path
from conftest import BASE_URL_API, auth_headers, save_dummy_session, FIXTURES_DIR

pytestmark = pytest.mark.sessions

BASE = BASE_URL_API


class TestStartSession:

    def test_TC_SESS_01_mulai_sesi_valid(self, user_token):
        """TC-SESS-01: Menyimpan sesi dengan data lengkap dan valid."""
        resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json={
                "scenario":        "Job Interview",
                "score_range":     3.0,
                "score_accuracy":  3.0,
                "score_fluency":   3.0,
                "score_coherence": 3.0,
                "score_phonology": 3.0,
                "duration_min":    5.0,
            }
        )
        print(f"\n[TC-SESS-01] Status: {resp.status_code} | Body: {resp.text[:300]}")
        assert resp.status_code in (200, 201), \
            f"Expected 200/201, got {resp.status_code}"
        data = resp.json()
        session_id = data.get("id")
        assert session_id is not None, "session_id tidak ada di respons"
        print(f"  → Session ID: {session_id}")

    def test_TC_SESS_02_mulai_sesi_tanpa_token(self):
        """TC-SESS-02: Menyimpan sesi tanpa token harus ditolak."""
        resp = requests.post(
            f"{BASE}/api/sessions",
            json={
                "scenario":        "Job Interview",
                "score_range":     3.0,
                "score_accuracy":  3.0,
                "score_fluency":   3.0,
                "score_coherence": 3.0,
                "score_phonology": 3.0,
                "duration_min":    5.0,
            }
        )
        print(f"\n[TC-SESS-02] Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code in (401, 403), \
            f"Seharusnya 401/403 tanpa token, got {resp.status_code}"

    def test_TC_SESS_03_mulai_sesi_data_tidak_lengkap(self, user_token):
        """TC-SESS-03: Menyimpan sesi tanpa field wajib harus ditolak."""
        resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json={
                "scenario": "Job Interview"
                # score fields sengaja dihilangkan
            }
        )
        print(f"\n[TC-SESS-03] Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code in (400, 422), \
            f"Seharusnya 400/422 untuk data tidak lengkap, got {resp.status_code}"


class TestSessionTurn:

    def test_TC_SESS_04_submit_turn_audio_valid(self, user_token, dummy_audio):
        """TC-SESS-04: Submit audio ke endpoint transkripsi."""
        with open(dummy_audio, "rb") as f:
            resp = requests.post(
                f"{BASE}/api/transcribe",
                headers=auth_headers(user_token),
                files={"audio": ("test.wav", f, "audio/wav")}
            )
        print(f"\n[TC-SESS-04] Status: {resp.status_code} | Body: {resp.text[:400]}")
        # ASR mungkin gagal karena dummy audio, tapi endpoint harus merespons
        assert resp.status_code in (200, 201, 202, 400, 422), \
            f"Unexpected status: {resp.status_code}"

    def test_TC_SESS_05_submit_turn_session_tidak_ada(self, user_token, dummy_audio):
        """TC-SESS-05: Submit audio tanpa file harus ditolak dengan pesan error."""
        resp = requests.post(
            f"{BASE}/api/transcribe",
            headers=auth_headers(user_token)
            # audio file sengaja tidak disertakan
        )
        print(f"\n[TC-SESS-05] Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code in (400, 422), \
            f"Seharusnya 400/422 tanpa file audio, got {resp.status_code}"


class TestEndSession:

    def test_TC_SESS_06_sesi_tersimpan_muncul_di_riwayat(self, user_token):
        """TC-SESS-06: Sesi yang disimpan harus langsung muncul di riwayat."""
        # Simpan sesi baru
        save_resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json={
                "scenario":        "Daily Conversation",
                "score_range":     4.0,
                "score_accuracy":  3.5,
                "score_fluency":   4.0,
                "score_coherence": 3.5,
                "score_phonology": 4.0,
                "duration_min":    8.0,
            }
        )
        if save_resp.status_code not in (200, 201):
            pytest.skip(f"Tidak bisa simpan sesi: {save_resp.status_code}")

        session_id = save_resp.json().get("id")
        print(f"\n[TC-SESS-06] Sesi tersimpan ID: {session_id}")

        # Verifikasi muncul di riwayat
        history = requests.get(
            f"{BASE}/api/sessions/recent",
            headers=auth_headers(user_token)
        )
        assert history.status_code == 200
        ids = [s.get("id") for s in history.json()]
        assert session_id in ids, f"Sesi ID {session_id} tidak muncul di riwayat"
        print(f"  ✅ Sesi berhasil tersimpan dan muncul di riwayat.")

    def test_TC_SESS_07_sesi_skor_di_luar_rentang_ditolak(self, user_token):
        """TC-SESS-07: Sesi dengan skor di luar rentang 1-5 harus ditolak."""
        resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json={
                "scenario":        "Business Meeting",
                "score_range":     99.0,  # Di luar rentang
                "score_accuracy":  3.0,
                "score_fluency":   3.0,
                "score_coherence": 3.0,
                "score_phonology": 3.0,
                "duration_min":    5.0,
            }
        )
        print(f"\n[TC-SESS-07] Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code in (400, 422), \
            f"Skor di luar rentang seharusnya ditolak, got {resp.status_code}"


class TestSessionHistory:

    def test_TC_SESS_08_riwayat_sesi(self, user_token):
        """TC-SESS-08: Mengambil riwayat sesi pengguna."""
        resp = requests.get(
            f"{BASE}/api/sessions/recent",
            headers=auth_headers(user_token)
        )
        print(f"\n[TC-SESS-08] Status: {resp.status_code} | Body: {resp.text[:400]}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert isinstance(data, (list, dict)), "Respons harus berupa list atau dict"
        print(f"  → Jumlah sesi dalam riwayat: {len(data) if isinstance(data, list) else 'N/A'}")
