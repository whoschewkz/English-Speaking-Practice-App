import pytest
import requests

BASE_URL = "https://takarzein.plutolab.my.id"

# Kredensial test - sesuaikan dengan akun aktual
USER_CREDS = {"username": "dKarzein", "password": "F4uGNz9svDzkK6D"}
RATER_CREDS = {"username": "rater1", "password": "FuJEBP8xMy5xBFz"}
ADMIN_CREDS = {"username": "admin", "password": "AdminPass123!"}

@pytest.fixture(scope="session")
def user_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json=USER_CREDS, timeout=15)
    assert r.status_code == 200
    return r.json()["access_token"]

@pytest.fixture(scope="session")
def rater_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json=RATER_CREDS, timeout=15)
    assert r.status_code == 200
    return r.json()["access_token"]

@pytest.fixture(scope="session")
def user_headers(user_token):
    return {"Authorization": f"Bearer {user_token}"}

@pytest.fixture(scope="session")
def rater_headers(rater_token):
    return {"Authorization": f"Bearer {rater_token}"}

def auth_header(token):
    return {"Authorization": f"Bearer {token}"}
