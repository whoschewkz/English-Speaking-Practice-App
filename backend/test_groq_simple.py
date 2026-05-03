import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

if not GROQ_API_KEY:
    print("❌ GROQ_API_KEY not found")
    exit(1)

print("🔄 Testing API connection...")

url = "https://api.groq.com/openai/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {GROQ_API_KEY}",
    "Content-Type": "application/json",
}
body = {
    "model": "llama-3.3-70b-versatile",
    "temperature": 0.1,
    "messages": [{"role": "user", "content": "Say hello"}],
}

try:
    r = httpx.post(url, headers=headers, json=body, timeout=30)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.json()}")
except Exception as e:
    print(f"❌ Error: {e}")