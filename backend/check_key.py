#!/usr/bin/env python
"""Check GROQ API Key"""
import os
from dotenv import load_dotenv

load_dotenv()
key = os.getenv("GROQ_API_KEY", "")
print("GROQ_API_KEY Status:")
print(f"  - Exists: {bool(key)}")
print(f"  - Length: {len(key)}")
if key:
    print(f"  - Starts with: {key[:10]}...")
    print(f"  - Ends with: ...{key[-10:]}")
