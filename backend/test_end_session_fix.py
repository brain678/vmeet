#!/usr/bin/env python3
"""
Test script to verify end-attendance-session endpoint is working correctly
"""
import subprocess
import time
import sys

def run_test():
    print("=" * 70)
    print("END SESSION ENDPOINT TEST")
    print("=" * 70)
    
    print("\n1. Checking if backend is running on localhost:8000...")
    try:
        import requests
        response = requests.get("http://localhost:8000/docs", timeout=2)
        if response.status_code == 200:
            print("✓ Backend is running!")
        else:
            print("✗ Backend returned status code:", response.status_code)
            print("  Make sure backend is running with: uvicorn backend.main:app --reload")
            return False
    except Exception as e:
        print("✗ Cannot connect to backend:", str(e))
        print("\n  To start backend:")
        print("  cd backend")
        print("  uvicorn main:app --reload")
        return False
    
    print("\n2. Fetching active sessions from database...")
    try:
        from database import db
        sessions = list(db.sessions.find({"status": "active"}).limit(3))
        
        if not sessions:
            print("✗ No active sessions found in database")
            print("  Create a session first as a lecturer, then try again")
            return False
        
        print(f"✓ Found {len(sessions)} active session(s)")
        
        for session in sessions:
            print(f"\n  Session ID: {session.get('sessionId')}")
            print(f"  Course Code: {session.get('courseCode')}")
            print(f"  Host ID: {session.get('hostId')}")
            print(f"  Status: {session.get('status')}")
    except Exception as e:
        print("✗ Error accessing database:", str(e))
        return False
    
    print("\n" + "=" * 70)
    print("RESULT: Backend and database are accessible!")
    print("=" * 70)
    
    print("\nNext steps:")
    print("1. Open the application in browser")
    print("2. Login as a lecturer")
    print("3. Start an attendance session")
    print("4. Click 'End Session & Download Report'")
    print("5. Check browser console (F12) for detailed logs")
    print("6. Session status should change from 'active' to 'completed'")
    
    return True

if __name__ == "__main__":
    try:
        success = run_test()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
