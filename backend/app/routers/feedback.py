import json

from fastapi import APIRouter, Depends, Body
from fastapi.responses import JSONResponse

from ..config import GROQ_API_KEY
from ..schemas import FeedbackIn
from ..auth import require_user
from ..utils import _normalize_scores_obj, _extract_json_block, _objective_from_messages

router = APIRouter()

# Prompt Variant C: Anchored Few-Shot + Self-Consistency
# Terpilih dari hasil benchmarking 3 varian prompt (prompt_benchmark.py)
_RUBRIK = (
    "You are a certified CEFR speaking examiner conducting an analytic assessment.\n\n"
    "=== SCORING RUBRIC (1-5, adapted from CEFR descriptors A2-C2) ===\n\n"
    "RANGE (Vocabulary Range):\n"
    "  5=Extremely flexible; reformulates ideas with varied forms; uses idioms precisely.\n"
    "  4=Wide range; expresses ideas on general, academic, professional topics.\n"
    "  3=Sufficiently wide; describes opinions on general topics with some complex structures.\n"
    "  2=Sufficient for familiar topics (family, work, travel); occasional indirect explanations.\n"
    "  1=Basic patterns and memorized phrases for limited everyday information.\n\n"
    "ACCURACY (Grammatical Accuracy):\n"
    "  5=Consistent control of complex structures even while attending to other aspects.\n"
    "  4=High accuracy; errors rare and self-corrected immediately.\n"
    "  3=Relatively high control; rarely causes misunderstanding.\n"
    "  2=Common grammatical patterns with adequate accuracy in predictable situations.\n"
    "  1=Some simple structures correct but frequent basic errors.\n\n"
    "FLUENCY (Speech Fluency):\n"
    "  5=Speaks at length spontaneously with natural flow; handles difficulty imperceptibly.\n"
    "  4=Fluent and spontaneous with little effort except on very complex topics.\n"
    "  3=Relatively even tempo; some hesitation searching for words.\n"
    "  2=Understandable but frequent pauses to plan language.\n"
    "  1=Very short utterances with many pauses, revisions, false starts.\n\n"
    "COHERENCE (Discourse Coherence):\n"
    "  5=Highly coherent/cohesive; varied organisational patterns and connectors.\n"
    "  4=Clear, well-structured, flowing; appropriate connector use.\n"
    "  3=Links ideas with cohesive devices; sometimes less smooth in longer utterances.\n"
    "  2=Connects simple ideas in a clear enough linear sequence.\n"
    "  1=Links words/phrases with basic connectors (and, but, because).\n\n"
    "PHONOLOGY (Pronunciation):\n"
    "  5=Full control of stress, rhythm, intonation; message very clear.\n"
    "  4=Good control; intelligibility maintained despite slight accent.\n"
    "  3=Generally clear despite L1 accent influence.\n"
    "  2=Generally intelligible though L1 accent evident.\n"
    "  1=Sufficiently clear though repetition sometimes needed.\n\n"
    "TOTAL = (Range+Accuracy+Fluency+Coherence+Phonology)/5\n"
    "CEFR: 1.0-1.9=A2 | 2.0-2.9=B1 | 3.0-3.9=B2 | 4.0-4.9=C1 | 5.0=C2\n\n"
    "=== CALIBRATION ANCHORS (scores VARY per dimension — do NOT give all dimensions the same score) ===\n"
    "ANCHOR A — Slow, hesitant, simple vocabulary, minor grammar errors:\n"
    "  'I am... uh... working in the, uh, company. It is good place. I like it very much.'\n"
    "  WPM≈40 | Range=2, Accuracy=2, Fluency=1, Coherence=2, Phonology=3\n\n"
    "ANCHOR B — Fluent delivery but limited vocabulary and loose structure:\n"
    "  'Yeah so I basically work in marketing, and like, we do campaigns and stuff. "
    "It is really good experience for me because I learn a lot of new things every day.'\n"
    "  WPM≈130 | Range=2, Accuracy=3, Fluency=4, Coherence=2, Phonology=3\n\n"
    "ANCHOR C — Rich vocabulary and coherent, but noticeable accent and some hesitation:\n"
    "  'The most compelling aspect of this role is the cross-functional... um... opportunity. "
    "Collaboration between departments consistently yields more innovative outcomes.'\n"
    "  WPM≈95 | Range=4, Accuracy=4, Fluency=3, Coherence=4, Phonology=2\n\n"
    "ANCHOR D — Near-native: varied vocabulary, accurate grammar, fluent, well-structured:\n"
    "  'What strikes me most is how interdisciplinary collaboration drives innovation. "
    "When diverse teams align around a shared objective, the outcomes are remarkably more robust.'\n"
    "  WPM≈155 | Range=5, Accuracy=5, Fluency=5, Coherence=5, Phonology=4\n\n"
    "=== PROCEDURE ===\n"
    "1. Read ALL user utterances only (ignore assistant turns).\n"
    "2. Per dimension: cite 1-2 transcript examples as evidence.\n"
    "3. Compare to rubric descriptors AND anchor examples above.\n"
    "4. Assign integer score 1-5.\n"
    "5. SELF-CHECK: Is each score consistent with rubric + anchors? Revise if not.\n"
    "6. Overall = average of 5 scores (1 decimal).\n\n"
    "Return STRICTLY VALID JSON only — no code fences, no extra text:\n"
    '{"scores":{"range":int,"accuracy":int,"fluency":int,"coherence":int,"phonology":int,"overall":float},'
    '"descriptors":{"range":"evidence+rubric","accuracy":"evidence+rubric",'
    '"fluency":"evidence+rubric","coherence":"evidence+rubric","phonology":"evidence+rubric"},'
    '"self_check":{"revisions_made":"none or description"},'
    '"comment":"CEFR level estimate + strengths + 2 improvement actions",'
    '"standards":{"rubric":"CEFR-aligned 1-5","method":"anchored-few-shot+self-consistency"}}'
)


@router.post("/feedback")
async def feedback(
    req: FeedbackIn = Body(...),
    current_user: dict = Depends(require_user),
):
    if not GROQ_API_KEY:
        return JSONResponse({"error": "Missing GROQ_API_KEY"}, status_code=500)
    try:
        import httpx
    except Exception as e:
        return JSONResponse({"error": "Missing dependency 'httpx'", "detail": str(e)}, status_code=500)

    msgs = [m.dict() for m in req.messages][-40:]

    # Inject objective metrics so LLM can factor WPM into Fluency score
    obj_metrics = _objective_from_messages(msgs, float(req.duration_min or 0.0))
    wpm   = obj_metrics.get("speech_rate_wpm")
    fill  = obj_metrics.get("filler_per_100w", 0)
    words = obj_metrics.get("total_words", 0)
    obj_note = (
        f"\n=== OBJECTIVE SPEECH METRICS (use these for Fluency scoring) ===\n"
        f"Speech rate: {wpm} WPM (reference: <60=very slow/1, 60-100=slow/2, 100-130=moderate/3, 130-160=fluent/4, >160=very fluent/5)\n"
        f"Filler words per 100w: {fill} (reference: >15=1, 10-15=2, 5-10=3, 2-5=4, <2=5)\n"
        f"Total words spoken: {words}\n"
        f"IMPORTANT: Fluency score MUST reflect WPM above, not just vocabulary quality.\n"
    )
    system_prompt = {"role": "system", "content": _RUBRIK + obj_note}
    body_req = {
        "model": "llama-3.3-70b-versatile",
        "messages": [system_prompt, *msgs],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    url     = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=body_req)
        if r.status_code != 200:
            return JSONResponse({"error": "groq_feedback_failed", "detail": r.text}, status_code=500)
        data = r.json()

    content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "") or ""
    try:    parsed = json.loads(content)
    except: parsed = _extract_json_block(content)

    if not parsed:
        return {"scores": {}, "comment": content or "No feedback generated.", "objective_metrics": obj_metrics}

    norm = _normalize_scores_obj(parsed)
    return {
        "scores":            norm["scores"],
        "descriptors":       parsed.get("descriptors", {}),
        "comment":           norm["comment"],
        "standards":         parsed.get("standards", {}),
        "objective_metrics": obj_metrics,
    }
