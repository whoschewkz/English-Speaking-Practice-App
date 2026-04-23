#!/usr/bin/env python
"""Test chat endpoint"""
import json
import sys
sys.path.insert(0, '/D:/SSN/Tingkat IV/Bismillah TA/App/English-Speaking-Practice-App/backend')

try:
    import httpx
    import asyncio
    
    async def test_chat():
        payload = {
            "scenarioId": "1",
            "messages": [
                {"role": "user", "content": "Hello, how are you?"}
            ]
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        
        print("=" * 60)
        print("TESTING CHAT ENDPOINT")
        print("=" * 60)
        print(f"\nPayload:\n{json.dumps(payload, indent=2)}")
        
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    "http://localhost:8000/api/chat",
                    json=payload,
                    headers=headers
                )
                
                print(f"\nStatus Code: {resp.status_code}")
                print(f"Response Headers: {dict(resp.headers)}")
                
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"\n✓ SUCCESS!")
                    print(f"Response: {json.dumps(data, indent=2)}")
                else:
                    print(f"\n✗ ERROR")
                    print(f"Response: {resp.text}")
        except Exception as e:
            print(f"\n✗ Request error: {e}")
            import traceback
            traceback.print_exc()
    
    asyncio.run(test_chat())

except ImportError as e:
    print(f"Import error: {e}")
    print("Please install httpx: pip install httpx")
