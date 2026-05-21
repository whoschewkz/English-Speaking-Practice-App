#!/usr/bin/env python3
"""Test Piper TTS — offline, gratis, natural voices."""

import io
import sys

try:
    from piper.executor import PiperExecutor
    print("✓ piper-tts library imported")
except ImportError as e:
    print(f"❌ Failed to import piper-tts: {e}")
    sys.exit(1)

try:
    print("\n📥 Initializing Piper (will download voice models on first run ~200MB)...")
    executor = PiperExecutor(cache_dir=".piper_cache")
    
    # Test multiple voices
    voices = {
        "en_US-ryan-medium": "Job Interview (male, professional)",
        "en_US-amy-medium": "Daily Conversation (female, friendly)",
        "en_US-john-medium": "Business (male, professional)",
    }
    
    for voice, description in voices.items():
        print(f"\n  Testing {description}...")
        try:
            audio_bytes = io.BytesIO()
            executor.say("Hello! This is a test.", voice=voice, output_file=audio_bytes)
            size = len(audio_bytes.getvalue())
            print(f"    ✓ Generated {size} bytes")
        except Exception as e:
            print(f"    ✗ Error: {str(e)[:100]}")
    
    print("\n✅ Piper TTS is ready!")
    
except Exception as e:
    print(f"\n❌ Piper TTS error: {type(e).__name__}: {str(e)[:200]}")
    sys.exit(1)
