import sys
import traceback

from fastapi import APIRouter, Depends, Body, UploadFile, File, Form
from fastapi.responses import JSONResponse

from ..config import GROQ_API_KEY
from ..schemas import ChatRequest
from ..auth import require_user

router = APIRouter()


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form("en"),
    current_user: dict = Depends(require_user),
):
    if not GROQ_API_KEY:
        return JSONResponse({"error": "Missing GROQ_API_KEY"}, status_code=500)
    try:
        import httpx
    except Exception as e:
        return JSONResponse({"error": "Missing dependency 'httpx'", "detail": str(e)}, status_code=500)

    url        = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers    = {"Authorization": f"Bearer {GROQ_API_KEY}"}
    file_bytes = await audio.read()
    filename   = audio.filename or "speech.wav"

    if filename.endswith(".wav"):   content_type = "audio/wav"
    elif filename.endswith(".mp3"): content_type = "audio/mpeg"
    elif filename.endswith(".ogg"): content_type = "audio/ogg"
    else:                           content_type = audio.content_type or "audio/wav"

    files = {"file": (filename, file_bytes, content_type)}
    data  = {"model": "whisper-large-v3", "language": language, "temperature": 0.0}

    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(url, headers=headers, files=files, data=data)
        if r.status_code != 200:
            return JSONResponse({"error": "groq_transcribe_failed", "detail": r.text}, status_code=500)
        return r.json()


@router.post("/chat")
async def chat(
    req: ChatRequest = Body(...),
    current_user: dict = Depends(require_user),
):
    if not GROQ_API_KEY:
        return JSONResponse({"error": "Missing GROQ_API_KEY"}, status_code=500)
    try:
        import httpx
    except Exception as e:
        return JSONResponse({"error": "Missing dependency 'httpx'", "detail": str(e)}, status_code=500)

    try:
        url     = "https://api.groq.com/openai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
        scenario = (
            "Job Interview"      if req.scenarioId == "1" else
            "Daily Conversation" if req.scenarioId == "2" else
            "Business Meeting"   if req.scenarioId == "3" else
            "Travel Situations"  if req.scenarioId == "4" else
            "Agent"              if req.scenarioId == "agent" else "Custom"
        )
        system_prompt = {
            "role": "system",
            "content": (
                "You are an English speaking practice assistant for TOEFL/IELTS. "
                "Keep replies 2–5 sentences. Ask one question at a time. "
                f"Add one short improvement tip at the end. Scenario: {scenario}"
            ),
        }
        msgs = [m.dict() if hasattr(m, "dict") else m for m in req.messages]
        final_messages = (
            msgs if (msgs and isinstance(msgs[0], dict) and msgs[0].get("role") == "system")
            else [system_prompt, *msgs]
        ) if msgs else [system_prompt]

        body_req = {"model": "llama-3.3-70b-versatile", "messages": final_messages, "temperature": 0.3}
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, headers=headers, json=body_req)
            if r.status_code != 200:
                return JSONResponse({"error": "groq_chat_failed", "detail": r.text}, status_code=500)
            data = r.json()

        content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "") or "I couldn't generate a response."
        return {"content": content}

    except Exception as e:
        print(f"[CHAT] Error: {e}\n{traceback.format_exc()}", file=sys.stderr)
        return JSONResponse({"error": "chat_error", "detail": str(e)}, status_code=500)
