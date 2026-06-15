"""
test_evaluation.py — Pengujian Modul Penilaian Otomatis CEFR
TC-EVAL-01 s/d TC-EVAL-06

Memverifikasi bahwa sistem menghasilkan skor dengan 5 dimensi CEFR:
range, accuracy, fluency, coherence, phonology

Endpoint utama:
POST /api/feedback  → kirim riwayat percakapan, terima skor AI 5 dimensi
POST /api/sessions  → skor tersimpan dan bisa dikembalikan via riwayat
"""

import pytest
import requests
from conftest import BASE_URL_API, auth_headers

pytestmark = pytest.mark.evaluation

BASE = BASE_URL_API

CEFR_DIMENSIONS   = ["range", "accuracy", "fluency", "coherence", "phonology"]
VALID_CEFR_LEVELS = ["A2", "B1", "B2", "C1", "C2"]

# Contoh percakapan minimal untuk trigger AI scoring
SAMPLE_MESSAGES = [
    {"role": "assistant", "content": "Hello! Let's practice English. Can you describe your typical workday?"},
    {"role": "user",      "content": "I wake up at seven and go to office. I work with computer and talk with colleague. "
                                     "Sometimes I have meeting in the afternoon. After work I take bus home."},
    {"role": "assistant", "content": "That's great! What do you enjoy most about your job?"},
    {"role": "user",      "content": "I enjoy when I finish the project and my boss say good job. "
                                     "Also I like to learn new things from my teammate. The office have nice environment."},
]


@pytest.fixture(scope="module")
def feedback_result(user_token):
    """
    Panggil POST /api/feedback sekali untuk seluruh test dalam module ini.
    Jika Groq API tidak tersedia, skip semua TC-EVAL.
    """
    resp = requests.post(
        f"{BASE}/api/feedback",
        headers=auth_headers(user_token),
        json={"messages": SAMPLE_MESSAGES, "duration_min": 3.0},
        timeout=60
    )
    print(f"\n[EVAL-FIXTURE] Feedback status: {resp.status_code}")
    if resp.status_code != 200:
        pytest.skip(f"Endpoint /api/feedback tidak tersedia atau Groq API gagal: {resp.status_code} — {resp.text[:200]}")
    return resp.json()


class TestEvaluationStructure:

    def test_TC_EVAL_01_struktur_skor_ada(self, feedback_result):
        """TC-EVAL-01: Respons feedback harus memiliki field 'scores'."""
        print(f"\n[TC-EVAL-01] Keys tersedia: {list(feedback_result.keys())}")
        assert "scores" in feedback_result, \
            f"Field 'scores' tidak ada dalam respons. Keys: {list(feedback_result.keys())}"
        scores = feedback_result["scores"]
        assert isinstance(scores, dict), "Field 'scores' harus berupa dict"
        print(f"  → Scores: {scores}")

    def test_TC_EVAL_02_lima_dimensi_cefr(self, feedback_result):
        """TC-EVAL-02: Hasil evaluasi harus mencakup semua 5 dimensi CEFR."""
        scores = feedback_result.get("scores", {})
        print(f"\n[TC-EVAL-02] Dimensi tersedia: {list(scores.keys())}")
        missing = [d for d in CEFR_DIMENSIONS if d not in scores]
        assert len(missing) == 0, \
            f"Dimensi CEFR berikut tidak ada: {missing}. Tersedia: {list(scores.keys())}"

    def test_TC_EVAL_03_rentang_nilai_valid(self, feedback_result):
        """TC-EVAL-03: Nilai setiap dimensi harus dalam rentang 1.0 – 5.0."""
        scores = feedback_result.get("scores", {})
        for dim in CEFR_DIMENSIONS:
            if dim in scores:
                score = scores[dim]
                print(f"\n[TC-EVAL-03] {dim}: {score}")
                assert isinstance(score, (int, float)), f"Skor {dim} bukan angka: {score}"
                assert 1.0 <= float(score) <= 5.0, \
                    f"Skor {dim} = {score} di luar rentang 1–5"

    def test_TC_EVAL_04_overall_mendekati_rata_rata(self, feedback_result):
        """TC-EVAL-04: Skor overall harus mendekati rata-rata 5 dimensi (±0.5)."""
        scores = feedback_result.get("scores", {})
        dim_scores = [float(scores[d]) for d in CEFR_DIMENSIONS if d in scores and scores[d] is not None]

        if len(dim_scores) < 5:
            pytest.skip(f"Tidak cukup dimensi ({len(dim_scores)}/5)")

        expected = sum(dim_scores) / len(dim_scores)
        actual   = float(scores.get("overall", 0))
        print(f"\n[TC-EVAL-04] Rata-rata dimensi: {expected:.2f} | Overall dari API: {actual:.2f}")
        assert actual > 0, "Overall score adalah 0"
        assert abs(actual - expected) <= 0.5, \
            f"Overall {actual:.2f} terlalu jauh dari rata-rata {expected:.2f}"

    def test_TC_EVAL_05_komentar_tersedia(self, feedback_result):
        """TC-EVAL-05: Respons harus menyertakan komentar/narasi evaluasi."""
        comment = feedback_result.get("comment", "")
        print(f"\n[TC-EVAL-05] Comment (50 chars): {comment[:50]}")
        assert isinstance(comment, str), "Field 'comment' harus string"
        assert len(comment) > 10, \
            f"Komentar terlalu pendek atau kosong: '{comment}'"

    def test_TC_EVAL_06_skor_tersimpan_di_sesi(self, user_token, feedback_result):
        """TC-EVAL-06: Skor dari feedback dapat disimpan ke sesi dan muncul di riwayat."""
        scores = feedback_result.get("scores", {})
        if not all(d in scores for d in CEFR_DIMENSIONS):
            pytest.skip("Scores tidak lengkap, skip simpan sesi")

        # Simpan sesi dengan skor dari AI
        save_resp = requests.post(
            f"{BASE}/api/sessions",
            headers=auth_headers(user_token),
            json={
                "scenario":        "Job Interview",
                "score_range":     scores.get("range",     3.0),
                "score_accuracy":  scores.get("accuracy",  3.0),
                "score_fluency":   scores.get("fluency",   3.0),
                "score_coherence": scores.get("coherence", 3.0),
                "score_phonology": scores.get("phonology", 3.0),
                "comment":         feedback_result.get("comment", ""),
                "duration_min":    3.0,
            }
        )
        print(f"\n[TC-EVAL-06] Save sesi: {save_resp.status_code} | Body: {save_resp.text[:300]}")
        assert save_resp.status_code in (200, 201), \
            f"Gagal simpan sesi dengan skor AI: {save_resp.status_code}"

        saved_id = save_resp.json().get("id")
        assert saved_id is not None, "Session ID tidak ada dalam respons simpan"

        # Verifikasi muncul di riwayat
        history_resp = requests.get(
            f"{BASE}/api/sessions/recent",
            headers=auth_headers(user_token)
        )
        assert history_resp.status_code == 200
        ids = [s.get("id") for s in history_resp.json()]
        assert saved_id in ids, f"Sesi ID {saved_id} tidak ditemukan dalam riwayat"
        print(f"  ✅ Sesi ID {saved_id} tersimpan dan muncul di riwayat")
