import requests
import json
from datetime import datetime, timedelta, timezone

# Test configuration
BACKEND_URL = "http://localhost:8000"

# Test ending a session
def test_end_session():
    # First, let's fetch a session from the database
    print("Testing end-attendance-session endpoint...")
    
    # Use a real session from your database
    session_id = "geo-1765056528"  # The session from the logs
    user_id = "user_36THKRVAfpN5AQDErsrW2StiCXn"  # The host user
    
    # Test the endpoint
    payload = {
        "sessionId": session_id,
        "userId": user_id
    }
    
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    response = requests.post(
        f"{BACKEND_URL}/end-attendance-session",
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

if __name__ == "__main__":
    test_end_session()
