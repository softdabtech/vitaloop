#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_current_user

# Mock user
fake_user = {
    "sub": "test-user-id",
    "email": "test@vitaloop.test",
}

# Override dependencies
app.dependency_overrides[get_current_user] = lambda: fake_user

client = TestClient(app)

def test_results_endpoint():
    # Test the results endpoint exposed by analysis router
    response = client.get("/analyze/3ece76e5-ae57-4b37-8f2e-37e58dc829a0")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

if __name__ == "__main__":
    test_results_endpoint()