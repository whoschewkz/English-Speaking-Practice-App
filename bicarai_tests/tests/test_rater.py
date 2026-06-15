"""
test_rater.py — Pengujian Modul Penilaian Manual Rater
TC-RATE-01 s/d TC-RATE-06

Endpoint yang diuji:
GET  /api/rater/sessions       → daftar sesi untuk dinilai
POST /api/rater/assessments    → simpan penilaian manual rater

Schema RaterAssessmentIn:
  session_id, rater_id (1|2), score_range, score_accuracy, score_fluency,
  score_coherence, score_phonology (semua 1-5), notes (opsional)
"""

import pytest
import requests
from conftest import BASE_URL_API, auth_headers, TEST_USERS, save_dummy_session

pytestmark = pytest.mark.rater
BASE = BASE_URL_API


class TestRaterAccess:

    def test_TC_RATE_01_rater_akses_daftar_sesi(self, rater1_token):
        """TC-RATE-01: Rater dapat melihat daftar sesi yang perlu dinilai."""
        resp = requests.get(
            f"{BASE}/api/rater/sessions",
            headers=auth_headers(rater1_token)
        )
        print(f"\n[TC-RATE-01] Status: {resp.status_code} | Body: {resp.text[:400]}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert isinstance(data, list), "Respons daftar sesi rater harus berupa list"
        print(f"  → Jumlah sesi dalam antrian: {len(data)}")

    def test_TC_RATE_02_user_tidak_bisa_akses_rater(self, user_token):
        """TC-RATE-02: User biasa tidak boleh mengakses endpoint rater."""
        resp = requests.get(
            f"{BASE}/api/rater/sessions",
            headers=auth_headers(user_token)
        )
        print(f"\n[TC-RATE-02] Status: {resp.status_code}")
        assert resp.status_code in (401, 403), \
            f"User biasa tidak seharusnya bisa akses endpoint rater, got {resp.status_code}"

    def test_TC_RATE_03_antrian_tanpa_token(self):
        """TC-RATE-03: Akses daftar sesi rater tanpa token harus ditolak."""
        resp = requests.get(f"{BASE}/api/rater/sessions")
        print(f"\n[TC-RATE-03] Status: {resp.status_code}")
        assert resp.status_code in (401, 403), \
            f"Seharusnya 401/403 tanpa token, got {resp.status_code}"


class TestRaterAssessment:

    @pytest.fixture(scope="class")
    def session_to_rate(self, user_token):
        """Buat sesi dengan conversation_turns agar muncul di antrian rater."""
        session_id = save_dummy_session(user_token, "Job Interview")
        if session_id is None:
            pytest.skip("Tidak bisa membuat sesi untuk dinilai")
        print(f"\n[RATE-FIXTURE] Sesi untuk dinilai ID: {session_id}")
        return session_id

    def test_TC_RATE_04_submit_penilaian_valid(self, rater1_token, session_to_rate):
        """TC-RATE-04: Rater dapat mensubmit penilaian manual yang valid."""
        payload = {
            "session_id":      session_to_rate,
            "rater_id":        1,
            "score_range":     3,
            "score_accuracy":  3,
            "score_fluency":   2,
            "score_coherence": 3,
            "score_phonology": 2,
            "notes":           "Pengucapan cukup jelas namun tata bahasa masih perlu diperbaiki."
        }
        resp = requests.post(
            f"{BASE}/api/rater/assessments",
            headers=auth_headers(rater1_token),
            json=payload
        )
        print(f"\n[TC-RATE-04] Status: {resp.status_code} | Body: {resp.text[:400]}")
        assert resp.status_code in (200, 201), \
            f"Expected 200/201, got {resp.status_code}"
        data = resp.json()
        assert data.get("ok") is True, f"Respons tidak menunjukkan sukses: {data}"

    def test_TC_RATE_05_penilaian_skor_di_luar_rentang(self, rater1_token, session_to_rate):
        """TC-RATE-05: Penilaian dengan skor di luar 1-5 harus ditolak (Pydantic validation)."""
        payload = {
            "session_id":      session_to_rate,
            "rater_id":        1,
            "score_range":     10,   # Di atas batas 5
            "score_accuracy":  3,
            "score_fluency":   2,
            "score_coherence": 3,
            "score_phonology": 2,
        }
        resp = requests.post(
            f"{BASE}/api/rater/assessments",
            headers=auth_headers(rater1_token),
            json=payload
        )
        print(f"\n[TC-RATE-05] Status: {resp.status_code} | Body: {resp.text[:200]}")
        assert resp.status_code in (400, 422), \
            f"Skor di luar rentang seharusnya ditolak, got {resp.status_code}"

    def test_TC_RATE_06_independensi_rater(self, rater1_token, rater2_token, session_to_rate):
        """TC-RATE-06: Rater 1 dan Rater 2 dapat menilai sesi yang sama secara independen."""
        # Rater 1 submit penilaian (update jika sudah ada dari TC-RATE-04)
        payload_r1 = {
            "session_id":      session_to_rate,
            "rater_id":        1,
            "score_range":     3,
            "score_accuracy":  3,
            "score_fluency":   2,
            "score_coherence": 3,
            "score_phonology": 2,
            "notes":           "Penilaian rater 1."
        }
        resp_r1 = requests.post(
            f"{BASE}/api/rater/assessments",
            headers=auth_headers(rater1_token),
            json=payload_r1
        )
        print(f"\n[TC-RATE-06] Rater1 Status: {resp_r1.status_code}")
        assert resp_r1.status_code in (200, 201), \
            f"Rater1 gagal submit: {resp_r1.status_code}"

        # Rater 2 submit penilaian independen
        payload_r2 = {
            "session_id":      session_to_rate,
            "rater_id":        2,
            "score_range":     2,
            "score_accuracy":  2,
            "score_fluency":   3,
            "score_coherence": 2,
            "score_phonology": 3,
            "notes":           "Kelancaran baik namun kosakata terbatas."
        }
        resp_r2 = requests.post(
            f"{BASE}/api/rater/assessments",
            headers=auth_headers(rater2_token),
            json=payload_r2
        )
        print(f"  → Rater2 Status: {resp_r2.status_code} | Body: {resp_r2.text[:300]}")
        assert resp_r2.status_code in (200, 201), \
            f"Rater2 gagal submit independen: {resp_r2.status_code}"
        print(f"  ✅ Kedua rater berhasil menilai sesi yang sama secara independen")
