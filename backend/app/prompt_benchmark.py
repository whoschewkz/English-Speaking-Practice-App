# backend/app/prompt_benchmark.py
"""
Benchmarking 3 varian prompt engineering untuk penilaian CEFR speaking.
Setiap varian diuji terhadap transkrip yang sama untuk mengukur:
  - Konsistensi skor antar prompt
  - Kepatuhan terhadap rubrik CEFR 1-5
  - Kualitas reasoning/justifikasi

CARA PAKAI:
  python prompt_benchmark.py

Hasil disimpan di: benchmark_results.json
"""

import os, json, asyncio, statistics
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

import httpx

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
MODEL        = "llama-3.3-70b-versatile"

# ─────────────────────────────────────────────────────────────────────────────
# RUBRIK CEFR — tabel dari TA (sumber kebenaran / ground truth referensi)
# ─────────────────────────────────────────────────────────────────────────────
CEFR_RUBRIC = """
RUBRIK PENILAIAN CEFR (Skala 1–5) — Digunakan sebagai satu-satunya standar penilaian.

RANGE (Jangkauan Kosakata):
  5 = Fleksibilitas sangat tinggi, mampu merumuskan ulang ide dengan berbagai bentuk linguistik, menggunakan idiom dan ekspresi sehari-hari secara presisi.
  4 = Rentang bahasa luas, mampu mengekspresikan diri pada berbagai topik umum, akademik, dan profesional.
  3 = Rentang cukup luas, mampu mendeskripsikan dan menyampaikan opini berbagai topik umum dengan beberapa struktur kompleks.
  2 = Kosakata cukup untuk topik familiar (keluarga, pekerjaan, perjalanan), kadang menggunakan penjelasan tidak langsung.
  1 = Pola kalimat dasar dan frasa hafalan untuk menyampaikan informasi terbatas.

ACCURACY (Akurasi Tata Bahasa):
  5 = Kontrol tata bahasa konsisten pada struktur kompleks bahkan saat merencanakan atau memantau reaksi lawan bicara.
  4 = Akurasi tinggi, kesalahan jarang dan langsung diperbaiki.
  3 = Kontrol relatif tinggi, jarang membuat kesalahan yang menyebabkan kesalahpahaman.
  2 = Pola tata bahasa umum dengan akurasi cukup baik dalam situasi terprediksi.
  1 = Beberapa struktur sederhana benar, namun sering membuat kesalahan dasar.

FLUENCY (Kelancaran):
  5 = Berbicara panjang spontan, alur alami, mengatasi kesulitan secara halus tanpa disadari lawan bicara.
  4 = Lancar dan spontan hampir tanpa usaha kecuali topik sangat kompleks.
  3 = Tempo relatif stabil, sedikit jeda saat mencari kata atau pola kalimat.
  2 = Dapat dipahami tetapi sering jeda untuk merencanakan struktur bahasa.
  1 = Ujaran sangat pendek, banyak jeda, perbaikan, dan pengulangan.

COHERENCE (Koherensi):
  5 = Wacana sangat koheren dan kohesif, berbagai pola organisasi, konektor beragam.
  4 = Ujaran jelas, terstruktur, mengalir, penggunaan konektor tepat.
  3 = Menghubungkan ide dengan beberapa perangkat kohesi, terkadang kurang mulus pada ujaran panjang.
  2 = Ide sederhana dalam urutan cukup jelas dan linear.
  1 = Kata/frasa dihubungkan dengan konektor sederhana (and, but, because).

PHONOLOGY (Fonologi/Pelafalan):
  5 = Kontrol penuh fitur fonologis (stress, rhythm, intonation), pesan tersampaikan sangat jelas.
  4 = Kontrol cukup, keterpahaman terjaga meskipun ada sedikit aksen.
  3 = Intonasi dan pengucapan umumnya jelas meskipun dipengaruhi aksen bahasa lain.
  2 = Umumnya dapat dipahami meskipun aksen bahasa pertama masih terlihat jelas.
  1 = Cukup jelas dipahami meskipun kadang perlu pengulangan.

SKOR TOTAL = (Range + Accuracy + Fluency + Coherence + Phonology) / 5

PEMETAAN KE CEFR:
  Skor 5.0       → C2
  Skor 4.0–4.9   → C1
  Skor 3.0–3.9   → B2
  Skor 2.0–2.9   → B1
  Skor 1.0–1.9   → A2
"""

# ─────────────────────────────────────────────────────────────────────────────
# 3 VARIAN PROMPT — untuk benchmarking
# ─────────────────────────────────────────────────────────────────────────────

PROMPT_VARIANTS = {

    # ── VARIANT A: Direct Scoring ─────────────────────────────────────────────
    # Pendekatan langsung — model langsung memberi skor tanpa diminta reasoning
    # Hipotesis: cepat tapi mungkin kurang konsisten
    "variant_A_direct": {
        "description": "Direct Scoring — model langsung memberi skor tanpa chain-of-thought",
        "system": f"""You are a certified CEFR speaking examiner evaluating a learner's spoken English.
Assess ONLY the USER's utterances using this rubric:

{CEFR_RUBRIC}

Return ONLY valid JSON, no extra text:
{{
  "scores": {{
    "range": <integer 1-5>,
    "accuracy": <integer 1-5>,
    "fluency": <integer 1-5>,
    "coherence": <integer 1-5>,
    "phonology": <integer 1-5>,
    "overall": <float, average of above>
  }},
  "descriptors": {{
    "range": "<brief evidence from transcript>",
    "accuracy": "<brief evidence from transcript>",
    "fluency": "<brief evidence from transcript>",
    "coherence": "<brief evidence from transcript>",
    "phonology": "<brief evidence from transcript>"
  }},
  "comment": "<2-3 sentences overall assessment>",
  "standards": {{"rubric": "CEFR-aligned 1-5", "model": "analytic compensatory"}}
}}""",
    },

    # ── VARIANT B: Chain-of-Thought (CoT) ────────────────────────────────────
    # Model diminta reasoning dulu per dimensi, baru memberi skor
    # Hipotesis: lebih akurat karena memaksa model anchor ke bukti transkrip
    "variant_B_cot": {
        "description": "Chain-of-Thought — model reasoning per dimensi sebelum memberi skor",
        "system": f"""You are a certified CEFR speaking examiner. Your task is to evaluate a learner's spoken English performance.

{CEFR_RUBRIC}

EVALUATION PROCEDURE — follow this exact sequence:
For EACH dimension (Range, Accuracy, Fluency, Coherence, Phonology):
  Step 1: Quote 1-2 specific examples from the USER's utterances as evidence.
  Step 2: Compare those examples against the rubric descriptors above.
  Step 3: Assign an integer score (1-5).

After scoring all 5 dimensions:
  Step 4: Calculate overall = (range + accuracy + fluency + coherence + phonology) / 5
  Step 5: Cross-check — if any score seems inconsistent with the evidence, revise it.

Return ONLY valid JSON:
{{
  "reasoning": {{
    "range":     "<evidence + comparison to rubric>",
    "accuracy":  "<evidence + comparison to rubric>",
    "fluency":   "<evidence + comparison to rubric>",
    "coherence": "<evidence + comparison to rubric>",
    "phonology": "<evidence + comparison to rubric>"
  }},
  "scores": {{
    "range": <integer 1-5>,
    "accuracy": <integer 1-5>,
    "fluency": <integer 1-5>,
    "coherence": <integer 1-5>,
    "phonology": <integer 1-5>,
    "overall": <float>
  }},
  "descriptors": {{
    "range": "<1-2 sentence rubric-anchored descriptor>",
    "accuracy": "<1-2 sentence rubric-anchored descriptor>",
    "fluency": "<1-2 sentence rubric-anchored descriptor>",
    "coherence": "<1-2 sentence rubric-anchored descriptor>",
    "phonology": "<1-2 sentence rubric-anchored descriptor>"
  }},
  "comment": "<2-3 sentences: overall impression + 2 specific action items for improvement>",
  "standards": {{"rubric": "CEFR-aligned 1-5", "model": "analytic compensatory", "method": "chain-of-thought"}}
}}""",
    },

    # ── VARIANT C: Anchored + Self-Consistency Check ──────────────────────────
    # Model diberi contoh anchor scoring, lalu diminta self-check konsistensi
    # Hipotesis: paling akurat tapi lebih lambat — cocok untuk evaluasi akhir
    "variant_C_anchored": {
        "description": "Anchored + Self-Consistency — few-shot anchor examples + internal consistency check",
        "system": f"""You are a certified CEFR speaking examiner conducting an analytic assessment.

{CEFR_RUBRIC}

ANCHOR EXAMPLES (calibration reference — use these to calibrate your scoring):

Example A — Score 2 (B1 level):
  Utterance: "I am... uh... working in the, uh, company. It is good place. I like my job because... because the people are nice."
  Range=2 (limited vocabulary, familiar topics only), Accuracy=2 (basic errors), Fluency=2 (frequent hesitations),
  Coherence=2 (simple linear connection), Phonology=2 (understandable with L1 accent)

Example B — Score 3 (B2 level):
  Utterance: "I've been working in marketing for about three years now. The role involves coordinating campaigns and analyzing customer data, which I find quite challenging but rewarding."
  Range=3 (adequate for professional topic), Accuracy=3 (mostly accurate), Fluency=3 (stable tempo),
  Coherence=3 (logical flow with some connectors), Phonology=3 (clear with minor accent influence)

Example C — Score 4 (C1 level):
  Utterance: "The most compelling aspect of this position is undoubtedly the opportunity to work cross-functionally. I've consistently found that collaboration between departments yields more innovative outcomes than siloed approaches."
  Range=4 (varied vocabulary, academic/professional), Accuracy=4 (high accuracy, self-corrects), Fluency=4 (spontaneous),
  Coherence=4 (well-structured, appropriate connectors), Phonology=4 (clear, minor accent)

EVALUATION STEPS:
1. Read ALL user utterances carefully.
2. For each dimension, compare user performance to anchor examples above.
3. Assign integer score (1-5) with rubric justification.
4. SELF-CHECK: Ask yourself — "Does this score align with the rubric descriptor AND the anchor examples?"
   If not, revise before outputting.
5. Calculate overall = average of 5 dimensions.

Return ONLY valid JSON:
{{
  "anchor_comparison": {{
    "closest_example": "<A/B/C>",
    "rationale": "<why this example best matches overall performance>"
  }},
  "scores": {{
    "range": <integer 1-5>,
    "accuracy": <integer 1-5>,
    "fluency": <integer 1-5>,
    "coherence": <integer 1-5>,
    "phonology": <integer 1-5>,
    "overall": <float>
  }},
  "descriptors": {{
    "range": "<rubric-anchored, cite specific evidence>",
    "accuracy": "<rubric-anchored, cite specific evidence>",
    "fluency": "<rubric-anchored, cite specific evidence>",
    "coherence": "<rubric-anchored, cite specific evidence>",
    "phonology": "<rubric-anchored, cite specific evidence>"
  }},
  "self_check": {{
    "range_consistent":     <true/false>,
    "accuracy_consistent":  <true/false>,
    "fluency_consistent":   <true/false>,
    "coherence_consistent": <true/false>,
    "phonology_consistent": <true/false>,
    "revisions_made": "<describe any score revisions, or 'none'>"
  }},
  "comment": "<2-3 sentences: CEFR level estimate, strengths, specific improvement areas>",
  "standards": {{"rubric": "CEFR-aligned 1-5", "model": "analytic compensatory", "method": "anchored-few-shot+self-consistency"}}
}}""",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# TRANSKRIP UJI — 3 level berbeda untuk testing
# ─────────────────────────────────────────────────────────────────────────────
TEST_TRANSCRIPTS = {

    "transcript_A2_B1": [
        {"role": "assistant", "content": "Hello! What position are you interviewing for today?"},
        {"role": "user",      "content": "I am, uh, apply for the, um, marketing job. I like marketing because, uh, it is interesting."},
        {"role": "assistant", "content": "Can you tell me about your experience in marketing?"},
        {"role": "user",      "content": "I study marketing in university. I make, uh, some project. And I, uh, I work before in small company. But, uh, not too long. Only six month."},
        {"role": "assistant", "content": "What are your strengths that make you suitable for this role?"},
        {"role": "user",      "content": "I am, uh, hard working. And I like, uh, learning new thing. I can work with team. And, uh, I good at computer. Microsoft Office and, uh, social media."},
    ],

    "transcript_B1_B2": [
        {"role": "assistant", "content": "Hello! What position are you interviewing for today?"},
        {"role": "user",      "content": "I'm applying for the digital marketing coordinator position. I've been working in marketing for about two years and I'm looking for a role with more responsibility."},
        {"role": "assistant", "content": "Can you tell me about your experience?"},
        {"role": "user",      "content": "Sure. In my current job, I'm responsible for managing social media campaigns and analyzing the performance data. I also coordinate with the design team to create content. I think I've developed strong skills in data analysis and campaign planning."},
        {"role": "assistant", "content": "What are your strengths?"},
        {"role": "user",      "content": "I would say my main strengths are attention to detail and the ability to work under pressure. I'm quite organized and I always try to meet deadlines. I'm also a good communicator, which is important when working with different teams."},
    ],

    "transcript_B2_C1": [
        {"role": "assistant", "content": "Hello! What position are you interviewing for today?"},
        {"role": "user",      "content": "I'm interviewing for the Senior Marketing Strategist position. Given my background in both digital marketing and consumer psychology, I believe I can bring a unique perspective to your team's approach."},
        {"role": "assistant", "content": "Can you elaborate on your experience?"},
        {"role": "user",      "content": "Certainly. Over the past four years, I've led cross-functional marketing initiatives that have consistently exceeded KPI targets by 20 to 30 percent. What sets my approach apart is the integration of behavioral data with creative strategy — rather than relying solely on demographic targeting, I focus on identifying psychological triggers that drive conversion."},
        {"role": "assistant", "content": "What makes you stand out from other candidates?"},
        {"role": "user",      "content": "What distinguishes me is the combination of analytical rigor and creative thinking. Many candidates excel in one or the other, but I've cultivated both through deliberate practice. I've published insights on content strategy in industry publications, which has given me a broader perspective on emerging trends — particularly around AI-driven personalization, which I think represents the next frontier in marketing effectiveness."},
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# Runner
# ─────────────────────────────────────────────────────────────────────────────
async def call_groq(system_prompt: str, messages: list) -> dict:
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type":  "application/json",
    }
    body = {
        "model":           MODEL,
        "temperature":     0.1,   # rendah untuk konsistensi
        "response_format": {"type": "json_object"},
        "messages":        [{"role": "system", "content": system_prompt}] + messages,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(GROQ_URL, headers=headers, json=body)
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"]
        return json.loads(content)


async def run_benchmark():
    print("=" * 60)
    print("BENCHMARKING PROMPT ENGINEERING — CEFR Speaking Assessment")
    print(f"Model : {MODEL}")
    print(f"Waktu : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    results = {
        "meta": {
            "model":      MODEL,
            "timestamp":  datetime.now().isoformat(),
            "temperature": 0.1,
            "num_variants": len(PROMPT_VARIANTS),
            "num_transcripts": len(TEST_TRANSCRIPTS),
        },
        "variants": {},
        "summary": {},
    }

    for variant_key, variant_cfg in PROMPT_VARIANTS.items():
        print(f"\n{'─'*50}")
        print(f"▶ {variant_key}: {variant_cfg['description']}")
        print(f"{'─'*50}")
        results["variants"][variant_key] = {
            "description": variant_cfg["description"],
            "transcripts": {},
        }

        all_scores = []

        for t_key, t_msgs in TEST_TRANSCRIPTS.items():
            print(f"  Transcript: {t_key} ... ", end="", flush=True)
            await asyncio.sleep(5)   # jeda 5 detik antar request — hindari rate limit
            try:
                result = await call_groq(variant_cfg["system"], t_msgs)
                scores = result.get("scores", {})
                overall = scores.get("overall", 0)
                all_scores.append(scores)

                # Pretty print
                print(f"✅ overall={overall:.2f}")
                for dim in ["range","accuracy","fluency","coherence","phonology"]:
                    print(f"       {dim:12s}: {scores.get(dim,'?')}")

                results["variants"][variant_key]["transcripts"][t_key] = {
                    "scores":      scores,
                    "descriptors": result.get("descriptors", {}),
                    "comment":     result.get("comment",""),
                    "reasoning":   result.get("reasoning",{}),
                    "self_check":  result.get("self_check",{}),
                    "anchor_comparison": result.get("anchor_comparison",{}),
                }

            except Exception as e:
                print(f"❌ Error: {e}")
                results["variants"][variant_key]["transcripts"][t_key] = {"error": str(e)}

        # Hitung statistik konsistensi (variance antar transcript)
        if len(all_scores) >= 2:
            dims = ["range","accuracy","fluency","coherence","phonology"]
            variance_per_dim = {}
            for d in dims:
                vals = [s.get(d, 0) for s in all_scores if isinstance(s.get(d), (int, float))]
                if len(vals) >= 2:
                    variance_per_dim[d] = round(statistics.variance(vals), 3)
            results["variants"][variant_key]["score_variance"] = variance_per_dim
            print(f"\n  Score variance across transcripts: {variance_per_dim}")

    # ── Summary: bandingkan semua varian ──────────────────────────────────────
    print(f"\n{'='*60}")
    print("RINGKASAN PERBANDINGAN ANTAR PROMPT")
    print(f"{'='*60}")

    summary_table = []
    for vk, vd in results["variants"].items():
        row = {"variant": vk}
        for tk in TEST_TRANSCRIPTS:
            t = vd["transcripts"].get(tk, {})
            scores = t.get("scores", {})
            row[f"{tk}_overall"] = scores.get("overall", "—")
        variance = vd.get("score_variance", {})
        row["avg_variance"] = round(
            statistics.mean(variance.values()), 3
        ) if variance else "—"
        summary_table.append(row)
        print(f"\n{vk}:")
        for tk in TEST_TRANSCRIPTS:
            print(f"  {tk}: {row.get(f'{tk}_overall','—')}")
        print(f"  Avg variance: {row['avg_variance']}")

    results["summary"] = {
        "table": summary_table,
        "recommendation": _recommend(summary_table),
    }

    print(f"\n{'='*60}")
    print("REKOMENDASI:")
    print(results["summary"]["recommendation"])
    print(f"{'='*60}")

    # ── Simpan hasil ──────────────────────────────────────────────────────────
    out_path = "benchmark_results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nHasil lengkap disimpan di: {out_path}")

    return results


def _recommend(table: list) -> str:
    # Pilih varian dengan rata-rata variance terendah (paling konsisten)
    valid = [r for r in table if isinstance(r.get("avg_variance"), float)]
    if not valid:
        return "Tidak cukup data untuk rekomendasi."
    best = min(valid, key=lambda r: r["avg_variance"])
    return (
        f"Prompt '{best['variant']}' menunjukkan konsistensi tertinggi "
        f"(avg variance = {best['avg_variance']}).\n"
        f"Namun tetap lakukan validasi dengan ground truth dari rater manusia "
        f"menggunakan inter-rater reliability (Cohen's Kappa atau Pearson correlation)."
    )


if __name__ == "__main__":
    if not GROQ_API_KEY:
        print("ERROR: GROQ_API_KEY tidak ditemukan. Set di .env dulu.")
        exit(1)
    asyncio.run(run_benchmark())