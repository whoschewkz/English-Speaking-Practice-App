"""
Simple test script for chat endpoint debugging
"""
import json
import requests

API_BASE = "http://localhost:8000"

# Test 1: Check if API is running
print("=" * 60)
print("TEST 1: Check if API is running")
print("=" * 60)
try:
    r = requests.get(f"{API_BASE}/api/health")
    print(f"✓ Health check: {r.status_code}")
    print(f"Response: {r.json()}")
except Exception as e:
    print(f"✗ Error: {e}")

# Test 2: Test chat endpoint with simple message
print("\n" + "=" * 60)
print("TEST 2: Test chat endpoint with simple message")
print("=" * 60)

test_payload = {
    "scenarioId": "1",
    "messages": [
        {"role": "user", "content": "Hello, how are you?"}
    ]
}

print(f"Sending payload:")
print(json.dumps(test_payload, indent=2))

try:
    r = requests.post(
        f"{API_BASE}/api/chat",
        json=test_payload,
        headers={"Content-Type": "application/json"}
    )
    print(f"\n✓ Status code: {r.status_code}")
    
    if r.status_code == 200:
        print(f"✓ SUCCESS!")
        print(f"Response: {r.json()}")
    else:
        print(f"✗ ERROR - Status {r.status_code}")
        print(f"Response: {r.text}")
        try:
            print(f"JSON: {r.json()}")
        except:
            pass
            
except Exception as e:
    print(f"✗ Request error: {e}")

# Test 3: Test with agent mode
print("\n" + "=" * 60)
print("TEST 3: Test chat endpoint with agent mode")
print("=" * 60)

test_payload_agent = {
    "scenarioId": "agent",
    "messages": [
        {"role": "user", "content": "I want to practice speaking"}
    ]
}

print(f"Sending payload:")
print(json.dumps(test_payload_agent, indent=2))

try:
    r = requests.post(
        f"{API_BASE}/api/chat",
        json=test_payload_agent,
        headers={"Content-Type": "application/json"}
    )
    print(f"\n✓ Status code: {r.status_code}")
    
    if r.status_code == 200:
        print(f"✓ SUCCESS!")
        print(f"Response: {r.json()}")
    else:
        print(f"✗ ERROR - Status {r.status_code}")
        print(f"Response: {r.text}")
        try:
            print(f"JSON: {r.json()}")
        except:
            pass
            
except Exception as e:
    print(f"✗ Request error: {e}")

print("\n" + "=" * 60)
print("Testing complete!")
print("=" * 60)
