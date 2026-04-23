#!/usr/bin/env python3
"""Test script untuk mengecek dashboard API endpoints"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_endpoint(method, endpoint, description):
    """Test a single endpoint"""
    url = f"{BASE_URL}{endpoint}"
    print(f"\n{'='*60}")
    print(f"Testing: {description}")
    print(f"URL: {url}")
    print(f"Method: {method}")
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, timeout=5)
        elif method.upper() == "POST":
            response = requests.post(url, timeout=5)
        else:
            print(f"Unknown method: {method}")
            return False
            
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        try:
            print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        except:
            print(f"Response Body (text): {response.text[:200]}")
            
        return response.status_code < 400
        
    except requests.exceptions.ConnectionError as e:
        print(f"ERROR: Cannot connect to {BASE_URL}")
        print(f"Details: {e}")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    print("Dashboard API Test")
    print(f"Testing API at: {BASE_URL}")
    
    results = []
    
    # Test endpoints
    results.append(("Health Check", test_endpoint("GET", "/api/health", "Health check endpoint")))
    results.append(("Profile", test_endpoint("GET", "/api/profile", "Get user profile")))
    results.append(("Recent Sessions", test_endpoint("GET", "/api/sessions/recent?limit=10", "Get recent sessions")))
    results.append(("Session Stats", test_endpoint("GET", "/api/sessions/stats", "Get session statistics")))
    
    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")
    
    all_passed = all(r[1] for r in results)
    sys.exit(0 if all_passed else 1)
