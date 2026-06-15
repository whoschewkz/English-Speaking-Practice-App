"""
test_evaluation.py — Pengujian Modul Penilaian Otomatis CEFR
TC-EVAL-01 s/d TC-EVAL-06

Memverifikasi bahwa sistem menghasilkan skor dengan 5 dimensi CEFR:
range (kosakata), accuracy (tata bahasa), fluency (kelancaran),
coherence (koherensi), phonology (pelafalan)

Struktur respons /api/feedback:
{
  "scores":  {"range":int, "accuracy":int, "fluency":int, "coherence":int, "phonology":int, "overall":float},
  "descriptors": {...},
  "comment": "...",
  "standards": {...},
  "objective_metrics": {...}
}
"""

import pytest
import requests
from conftest import BASE_URL_API, auth_headers

pytestmark = pytest.mark.evaluation

BASE = BASE_URL_API

CEFR_DIMENSIONS = ["range", "accuracy", "fluency", "coherence", "phonology"]
VALID_CEFR_LEVELS = ["A2", "B1", "B2", "C1", "C2"]

SAMPLE_MESSAGES = [
    {"role": "assistant", "content": "Tell me about your daily routine."},
    {"role": "user",      "content": "I wake up at seven o'clock and have breakfast."},
    {"role": "assistant", "content": "What do you usually eat for breakfast?"},
    {"role": "user",      "content": "I eat bread and drink coffee every morning."},
    {"role": "assistant", "content": "Do you exercise in the morning?"},
    {"role": "user",      "content": "Yes, I run for thirty minutes before going to work."},
]


@pytest.fixture(scope="module")
def feedback_result(user_token):
    """Panggil /api/feedback sekali, hasilnya di-share ke seluruh test dalam modul ini."""
    resp = requests.post(
        f"{BASE}/api/feedback",
        headers=auth_headers(user_token),
        json={"messages": SAMPLE_MESSAGES}
    )
    return resp


class TestEvaluationStructure:

    def test_TC_EVAL_01_struktur_skor_ada(self, feedback_result):
        """TC-EVAL-01: Hasil feedback harus memiliki key 'scores' dengan sub-skor 5 dimensi."""
        print(f"\n[TC-EVAL-01] Status: {feedback_result.status_code}")
        assert feedback_result.status_code in (200, 201), \
            f"Expected 200/201, got {feedback_result.status_code}"

        data = feedback_result.json()
        print(f"  → Top-level keys: {list(data.keys())}")

        # Skor berada di nested key "scores"
        assert "scores" in data, \
            f"Key 'scores' tidak ada dalam respons. Keys: {list(data.keys())}"

        scores = data["scores"]
        print(f"  → Scores: {scores}")
        assert isinstance(scores, dict), "'scores' harus berupa dict"
        assert len(scores) > 0, "'scores' tidak boleh kosong"

    def test_TC_EVAL_02_lima_dimensi_cefr(self, feedback_result):
        """TC-EVAL-02: Hasil evaluasi harus mencakup 5 dimensi CEFR dalam key 'scores'."""
        if feedback_result.status_code not in (200, 201):
            pytest.skip("Feedback API tidak tersedia")

        data  = feedback_result.json()
        scores = data.get("scores", {})
        print(f"\n[TC-EVAL-02] Scores keys: {list(scores.keys())}")

        missing = [d for d in CEFR_DIMENSIONS if d not in scores]
        print(f"  → Dimensi ditemukan: {[d for d in CEFR_DIMENSIONS if d in scores]}")
        assert len(missing) == 0, \
            f"Dimensi CEFR berikut tidak ada di 'scores': {missing}. Tersedia: {list(scores.keys())}"

    def test_TC_EVAL_03_rentang_nilai_valid(self, feedback_result):
        """TC-EVAL-03: Nilai setiap dimensi harus dalam rentang 1-5."""
        if feedback_result.status_code not in (200, 201):
            pytest.skip("Feedback API tidak tersedia")

        scores = feedback_result.json().get("scores", {})
        for dim in CEFR_DIMENSIONS:
            if dim in scores and isinstance(scores[dim], (int, float)):
                score = float(scores[dim])
                print(f"\n[TC-EVAL-03] {dim}: {score}")
                assert 1.0 <= score <= 5.0, \
                    f"Skor {dim} = {score} di luar rentang 1-5"

    def test_TC_EVAL_04_total_score_adalah_rata_rata(self, feedback_result):
        """TC-EVAL-04: Overall score harus mendekati rata-rata 5 dimensi (compensatory model)."""
        if feedback_result.status_code not in (200, 201):
            pytest.skip("Feedback API tidak tersedia")

        scores = feedback_result.json().get("scores", {})
        dim_scores = [float(scores[d]) for d in CEFR_DIMENSIONS if d in scores and isinstance(scores[d], (int, float))]

        if len(dim_scores) < 5:
            pytest.skip(f"Tidak cukup dimensi tersedia ({len(dim_scores)}/5)")

        expected_avg = sum(dim_scores) / len(dim_scores)
        actual_overall = float(scores.get("overall", 0))

        print(f"\n[TC-EVAL-04] Dimensi scores: {dim_scores}")
        print(f"  → Expected rata-rata: {expected_avg:.2f}")
        print(f"  → Actual overall dari API: {actual_overall:.2f}")

        if actual_overall > 0:
            assert abs(actual_overall - expected_avg) < 0.6, \
                f"Overall score {actual_overall} jauh dari rata-rata {expected_avg:.2f}"

    def test_TC_EVAL_05_cefr_level_dari_overall(self, feedback_result):
        """TC-EVAL-05: Overall score harus jatuh dalam rentang valid A2-C2 (1.0-5.0)."""
        if feedback_result.status_code not in (200, 201):
            pytest.skip("Feedback API tidak tersedia")

        scores = feedback_result.json().get("scores", {})
        overall = scores.get("overall")
        print(f"\n[TC-EVAL-05] Overall score: {overall}")

        if overall is not None:
            assert 1.0 <= float(overall) <= 5.0, \
                f"Overall score {overall} di luar rentang CEFR 1.0-5.0"
            # Validasi peta CEFR
            cefr_from_score = (
                "A2" if float(overall) < 2.0 else
                "B1" if float(overall) < 3.0 else
                "B2" if float(overall) < 4.0 else
                "C1" if float(overall) < 5.0 else "C2"
            )
            print(f"  → CEFR level dari overall: {cefr_from_score}")
            assert cefr_from_score in VALID_CEFR_LEVELS

    def test_TC_EVAL_06_ada_komentar_feedback(self, feedback_result):
        """TC-EVAL-06: Respons evaluasi harus menyertakan komentar teks berbasis CEFR."""
        if feedback_result.status_code not in (200, 201):
            pytest.skip("Feedback API tidak tersedia")

        data = feedback_result.json()
        comment = data.get("comment", "")
        print(f"\n[TC-EVAL-06] Comment: {comment[:200]}")

        assert isinstance(comment, str), "Field 'comment' harus berupa string"
        assert len(comment) > 10, \
            f"Komentar terlalu pendek atau kosong: '{comment}'"
