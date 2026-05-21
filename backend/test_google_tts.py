#!/usr/bin/env python3
"""
Test Google Cloud TTS API connection.
Requires:
  1. Google Cloud service account JSON key
  2. Text-to-Speech API enabled
  3. GOOGLE_APPLICATION_CREDENTIALS env var set
"""

import os
import sys
from pathlib import Path

# Check if credentials are set
creds_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', '')
if not creds_path:
    print("❌ GOOGLE_APPLICATION_CREDENTIALS not set in .env")
    print("\n📝 Setup instructions:")
    print("1. Go to https://console.cloud.google.com/")
    print("2. Create new project (or select existing)")
    print("3. Enable 'Cloud Text-to-Speech API'")
    print("4. Create service account: APIs & Services → Credentials → Create Credentials → Service Account")
    print("5. Create JSON key for the service account")
    print("6. Add to .env: GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json")
    sys.exit(1)

# Verify file exists
if not Path(creds_path).exists():
    print(f"❌ Credentials file not found: {creds_path}")
    sys.exit(1)

print(f"✓ Credentials found: {creds_path}")

try:
    from google.cloud import texttospeech
    print("✓ google-cloud-texttospeech library installed")
except ImportError:
    print("❌ google-cloud-texttospeech not installed")
    print("   Run: pip install google-cloud-texttospeech")
    sys.exit(1)

# Test TTS
try:
    client = texttospeech.TextToSpeechClient()
    
    # Test request
    synthesis_input = texttospeech.SynthesisInput(text="Hello! This is a test of Google Cloud Text to Speech.")
    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        name="en-US-Neural2-C",
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
    )
    
    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config,
    )
    
    audio_size = len(response.audio_content)
    print(f"\n✓ Google Cloud TTS working!")
    print(f"  Audio generated: {audio_size} bytes")
    print(f"  Voice: en-US-Neural2-C (male, professional)")
    
except Exception as e:
    print(f"\n❌ Google Cloud TTS failed:")
    print(f"  {type(e).__name__}: {str(e)[:200]}")
    sys.exit(1)

print("\n✅ All tests passed! Google TTS is ready.")
