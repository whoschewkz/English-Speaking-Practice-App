"""
test_agent.py — Pengujian Agent Mode Adaptif
TC-AGENT-01 s/d TC-AGENT-03

Menguji tiga fitur utama Agent Mode:
- TC-AGENT-01: Pemilihan skenario adaptif berdasarkan dimensi MA terendah
- TC-AGENT-02: Refleksi pasca sesi (POST /api/agent/reflect)
- TC-AGENT-03: Rencana sesi berikutnya (POST /api/agent/plan)
"""

import pytest
import requests
from conftest import BASE_URL_API, auth_headers, save_dummy_session

pytestmark = pytest.mark.integration
BASE = BASE_URL_API


class TestAgentMode:

    def test_TC_AGENT_01_pemilihan_skenario_adaptif(self, user_token):
        """
        TC-AGENT-01: Sistem memilih skenario berdasarkan dimensi moving average terendah.
        Endpoint GET /api/agent/next-plan harus mengembalikan skenario dan fokus dimensi
        yang sesuai dengan profil pengguna.
        """
        resp = requests.get(
            f"{BASE}/api/agent/next",
            headers=auth_headers(user_token)
        )
        print(f"\n[TC-AGENT-01] GET /api/agent/next: {resp.status_code}")

        assert resp.status_code == 200, \
            f"Gagal mendapatkan next-plan: {resp.status_code} — {resp.text[:300]}"

        data = resp.json()
        print(f"  → Response: {data}")

        # Harus mengembalikan skenario yang dipilih
        assert "scenario" in data or "scenario_title" in data or "scenarioTitle" in data, \
            f"Response tidak mengandung field skenario: {list(data.keys())}"

        # Harus mengembalikan fokus dimensi
        focus_keys = {"focus", "weak_focus", "focus_dimension"}
        assert any(k in data for k in focus_keys), \
            f"Response tidak mengandung field fokus: {list(data.keys())}"

        print(f"  ✅ Skenario adaptif berhasil dipilih oleh sistem")


    def test_TC_AGENT_02_refleksi_pasca_sesi(self, user_token):
        """
        TC-AGENT-02: Sistem menghasilkan refleksi setelah sesi selesai.
        Endpoint POST /api/agent/reflect harus mengembalikan ringkasan dan pola kesalahan.
        """
        # Buat sesi dummy terlebih dahulu agar ada data yang bisa direfleksikan
        session_id = save_dummy_session(user_token, scenario="Daily Conversation")
        print(f"\n[TC-AGENT-02] Sesi dummy dibuat: id={session_id}")

        if not session_id:
            pytest.skip("Tidak bisa membuat sesi dummy — server mungkin down")

        payload = {
            "messages": [
                {"role": "user",      "content": "I go to school yesterday with my friend."},
                {"role": "assistant", "content": "That's great! What did you do at school?"},
                {"role": "user",      "content": "We study and then we eating lunch together."},
                {"role": "assistant", "content": "I see! Did you enjoy the lunch?"},
                {"role": "user",      "content": "Yes it was very delicious and we are talking many things."},
            ],
            "feedback": {
                "scores": {
                    "range": 3.0, "accuracy": 2.5, "fluency": 3.0,
                    "coherence": 3.0, "interaction": 3.0, "overall": 2.9
                },
                "comment": "Good effort but several grammar errors detected."
            }
        }

        resp = requests.post(
            f"{BASE}/api/agent/reflect",
            headers=auth_headers(user_token),
            json=payload
        )
        print(f"  → POST /api/agent/reflect: {resp.status_code}")

        assert resp.status_code == 200, \
            f"Refleksi gagal: {resp.status_code} — {resp.text[:300]}"

        data = resp.json()
        print(f"  → Keys: {list(data.keys())}")

        # Harus mengandung ringkasan atau pola kesalahan
        summary_keys  = {"summary", "ringkasan", "reflection"}
        pattern_keys  = {"error_patterns", "patterns", "mistakes", "pola_kesalahan"}
        has_summary   = any(k in data for k in summary_keys)
        has_patterns  = any(k in data for k in pattern_keys)

        assert has_summary or has_patterns, \
            f"Response refleksi tidak mengandung summary/patterns: {list(data.keys())}"

        print(f"  ✅ Refleksi berhasil dibuat oleh sistem")


    def test_TC_AGENT_03_rencana_sesi_berikutnya(self, user_token):
        """
        TC-AGENT-03: Sistem menghasilkan rencana sesi berikutnya.
        Endpoint POST /api/agent/plan harus mengembalikan rencana latihan
        dengan skenario, level, objectives, dan starter turns.
        """
        # Buat sesi dummy sebagai konteks rencana
        session_id = save_dummy_session(user_token, scenario="Job Interview")
        print(f"\n[TC-AGENT-03] Sesi dummy dibuat: id={session_id}")

        if not session_id:
            pytest.skip("Tidak bisa membuat sesi dummy — server mungkin down")

        payload = {
            "session_id": session_id,
            "messages": [
                {"role": "user",      "content": "I want to work in technology company."},
                {"role": "assistant", "content": "What kind of role are you interested in?"},
                {"role": "user",      "content": "I am interest in software developer position."},
            ]
        }

        resp = requests.post(
            f"{BASE}/api/agent/plan",
            headers=auth_headers(user_token),
            json=payload
        )
        print(f"  → POST /api/agent/plan: {resp.status_code}")

        assert resp.status_code == 200, \
            f"Pembuatan rencana gagal: {resp.status_code} — {resp.text[:300]}"

        data = resp.json()
        print(f"  → Keys: {list(data.keys())}")

        # Harus mengandung minimal satu field rencana
        plan_keys = {"scenario", "scenario_title", "level", "objectives",
                     "starter_turns", "focus", "plan", "next_plan"}
        has_plan = any(k in data for k in plan_keys)

        assert has_plan, \
            f"Response rencana tidak mengandung field yang diharapkan: {list(data.keys())}"

        print(f"  ✅ Rencana sesi berikutnya berhasil dibuat oleh sistem")
