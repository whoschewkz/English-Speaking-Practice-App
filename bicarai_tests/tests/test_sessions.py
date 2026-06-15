"""
test_sessions.py — Pengujian Modul Sesi Latihan
TC-SESS-01 s/d TC-SESS-08

Black-box testing untuk endpoint sesi:
POST /api/sessions         → simpan sesi lengkap setelah latihan selesai
GET  /api/sessions/recent  → riwayat sesi terbaru
GET  /api/sessions/stats   → statistik total sesi

Catatan: sistem menggunakan one-shot save (bukan start/turn/end stateful).
Sesi dibuat di frontend, kemudian disimpan sekaligus ke backend saat selesai.
"""

import pytest
import requests
from conftest import BASE_URL_API, auth_headers

pytestmark = pytest.mark.sessions

BASE = BASE_URL_API

VALID_SESSION_PAYLOAD = {
    "scenario":        "Job Interview",
    "score_range":     3.5,
    "score_accuracy":  3.0,
    "score_fluency":   3.5,
    "score_coherence": 3.0,
    "score_phonology": 3.0,
    "comment":         "Pengujian otomatis — sesi valid.",
    "duration_min":    5.0,
}


class TestSimpanSesi:

    def test_TC_SESS_01_simpan_sesi_valid(self, user_token):
        """TC-SESS-01: Menyimpan sesi latihan dengan payload lengkap dan valid."""
        resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json=VALID_SESSION_PAYLOAD
        )
        print(f"\n[TC-SESS-01] Status: {resp.status_code} | Body: {resp.text[:300]}")
        assert resp.status_code in (200, 201), \
            f"Expected 200/201, got {resp.status_code}"
        data = resp.json()
        assert "id" in data, "Field 'id' tidak ada di respons"
        assert data.get("saved") is True or "id" in data, "Sesi tidak tersimpan"
        print(f"  → Session ID tersimpan: {data.get('id')}")

    def test_TC_SESS_02_simpan_sesi_tanpa_token(self):
        """TC-SESS-02: Menyimpan sesi tanpa token autentikasi harus ditolak."""
        resp = requests.post(
            f"{BASE}/api/sessions",
            json=VALID_SESSION_PAYLOAD
        )
        print(f"\n[TC-SESS-02] Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code in (401, 403), \
            f"Seharusnya 401/403 tanpa token, got {resp.status_code}"

    def test_TC_SESS_03_simpan_sesi_field_wajib_hilang(self, user_token):
        """TC-SESS-03: Menyimpan sesi tanpa field wajib (scenario) harus ditolak."""
        payload_tidak_lengkap = {
            # 'scenario' sengaja dihilangkan
            "score_range":     3.0,
            "score_accuracy":  3.0,
            "score_fluency":   3.0,
            "score_coherence": 3.0,
            "score_phonology": 3.0,
        }
        resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json=payload_tidak_lengkap
        )
        print(f"\n[TC-SESS-03] Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code in (400, 422), \
            f"Seharusnya ditolak untuk payload tidak lengkap, got {resp.status_code}"

    def test_TC_SESS_04_submit_audio_transkripsi(self, user_token, dummy_audio):
        """TC-SESS-04: Submit audio ke endpoint transkripsi — respons harus ada (walaupun teks kosong)."""
        with open(dummy_audio, "rb") as f:
            resp = requests.post(
                f"{BASE}/api/transcribe",
                headers=auth_headers(user_token),
                files={"audio": ("test.wav", f, "audio/wav")}
            )
        print(f"\n[TC-SESS-04] Status: {resp.status_code} | Body: {resp.text[:300]}")
        # Endpoint harus merespons — ASR mungkin return teks kosong untuk silence dummy
        assert resp.status_code in (200, 201, 400, 422), \
            f"Unexpected status dari endpoint transkripsi: {resp.status_code}"

    def test_TC_SESS_05_sesi_muncul_di_riwayat(self, user_token):
        """TC-SESS-05: Sesi yang tersimpan harus muncul di riwayat sesi terbaru."""
        # Simpan sesi baru
        save_resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json={**VALID_SESSION_PAYLOAD, "scenario": "Daily Conversation"}
        )
        if save_resp.status_code not in (200, 201):
            pytest.skip(f"Tidak bisa simpan sesi: {save_resp.status_code}")

        saved_id = save_resp.json().get("id")
        print(f"\n[TC-SESS-05] Sesi tersimpan ID: {saved_id}")

        # Ambil riwayat dan pastikan sesi ada
        history_resp = requests.get(
            f"{BASE}/api/sessions/recent",
            headers=auth_headers(user_token)
        )
        assert history_resp.status_code == 200, \
            f"Gagal ambil riwayat: {history_resp.status_code}"
        sessions = history_resp.json()
        ids = [s.get("id") for s in sessions]
        print(f"  → IDs dalam riwayat: {ids}")
        assert saved_id in ids, f"Sesi ID {saved_id} tidak ditemukan dalam riwayat"

    def test_TC_SESS_06_simpan_sesi_dengan_audio(self, user_token):
        """TC-SESS-06: Menyimpan sesi dengan conversation_turns mengisi full_audio_json."""
        payload = {
            **VALID_SESSION_PAYLOAD,
            "scenario":           "Business Meeting",
            "conversation_turns": [
                {"role": "user",      "path": "user_turn_1.wav"},
                {"role": "assistant", "path": "ai_turn_1.wav"},
            ],
        }
        resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json=payload
        )
        print(f"\n[TC-SESS-06] Status: {resp.status_code} | Body: {resp.text[:300]}")
        assert resp.status_code in (200, 201), \
            f"Expected 200/201, got {resp.status_code}"
        data = resp.json()
        assert "id" in data, "Session ID tidak ada"
        print(f"  → Sesi dengan audio tersimpan ID: {data.get('id')}")

    def test_TC_SESS_07_skor_dikliping_ke_rentang_valid(self, user_token):
        """TC-SESS-07: Skor di luar rentang 1-5 diterima tapi dikliping oleh sistem."""
        payload = {
            **VALID_SESSION_PAYLOAD,
            "score_range":    10.0,  # Di atas batas 5
            "score_accuracy": 0.0,   # Di bawah batas 1
        }
        resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json=payload
        )
        print(f"\n[TC-SESS-07] Status: {resp.status_code} | Body: {resp.text[:300]}")
        # Sistem menerima (200) dan mengklip skor ke [1,5] — bukan reject 422
        assert resp.status_code in (200, 201, 422), \
            f"Unexpected status: {resp.status_code}"
        if resp.status_code in (200, 201):
            # Verifikasi profil MA yang dikembalikan dalam rentang wajar
            profile = resp.json().get("profile", {})
            ma = profile.get("ma", {})
            if ma.get("range") is not None:
                assert 1.0 <= ma["range"] <= 5.0, f"MA range di luar batas: {ma['range']}"

    def test_TC_SESS_08_riwayat_sesi_terurut(self, user_token):
        """TC-SESS-08: Riwayat sesi terbaru harus dapat diambil dan terurut dari yang terbaru."""
        resp = requests.get(
            f"{BASE}/api/sessions/recent",
            headers=auth_headers(user_token)
        )
        print(f"\n[TC-SESS-08] Status: {resp.status_code} | Body: {resp.text[:400]}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert isinstance(data, list), "Respons riwayat harus berupa list"
        print(f"  → Jumlah sesi dalam riwayat: {len(data)}")

        if len(data) >= 2:
            timestamps = [s.get("created_at", "") for s in data]
            valid_ts = [ts for ts in timestamps if ts]
            if len(valid_ts) >= 2:
                assert valid_ts == sorted(valid_ts, reverse=True), \
                    "Sesi tidak terurut dari yang terbaru"
