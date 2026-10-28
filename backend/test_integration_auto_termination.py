"""
Integration test for automatic session termination
Tests the complete flow with scheduler simulation
"""

import sys
import os
import time
import asyncio
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "vmeet")

def setup_test_data():
    """Create test sessions with different scenarios"""
    
    client = MongoClient(MONGODB_URI)
    db = client[DB_NAME]
    sessions = db["sessions"]
    attendance = db["attendance"]
    
    # Clear test data
    sessions.delete_many({"courseCode": {"$regex": "^TEST_"}})
    attendance.delete_many({"courseCode": {"$regex": "^TEST_"}})
    
    now = datetime.now(timezone.utc)
    test_sessions = []
    
    # Scenario 1: Session that should expire (started 35 minutes ago, 30-minute limit)
    session1 = {
        "sessionId": "test_session_exp_001",
        "courseCode": "TEST_EXP001",
        "lectureId": "test_001",
        "status": "active",
        "startTime": (now - timedelta(minutes=35)).isoformat(),
        "timeLimit": 30,
        "attendanceRecords": [],
        "createdAt": now.isoformat()
    }
    result1 = sessions.insert_one(session1)
    test_sessions.append(("EXPIRED", result1.inserted_id, session1))
    
    # Scenario 2: Session that should NOT expire (started 5 minutes ago, 30-minute limit)
    session2 = {
        "sessionId": "test_session_active_001",
        "courseCode": "TEST_ACTIVE001",
        "lectureId": "test_002",
        "status": "active",
        "startTime": (now - timedelta(minutes=5)).isoformat(),
        "timeLimit": 30,
        "attendanceRecords": [],
        "createdAt": now.isoformat()
    }
    result2 = sessions.insert_one(session2)
    test_sessions.append(("ACTIVE", result2.inserted_id, session2))
    
    # Scenario 3: Session without time limit (should never auto-end)
    session3 = {
        "sessionId": "test_session_notime_001",
        "courseCode": "TEST_NOTIME001",
        "lectureId": "test_003",
        "status": "active",
        "startTime": (now - timedelta(hours=2)).isoformat(),
        "attendanceRecords": [],
        "createdAt": now.isoformat()
    }
    result3 = sessions.insert_one(session3)
    test_sessions.append(("NO_LIMIT", result3.inserted_id, session3))
    
    # Add some attendance records for the first session
    for i in range(3):
        attendance.insert_one({
            "sessionId": str(result1.inserted_id),
            "userId": f"test_user_{i}",
            "courseCode": "TEST_EXP001",
            "studentId": f"student_{i}",
            "status": "present",
            "checkInTime": now.isoformat(),
            "checkInMethod": "face_recognition"
        })
    
    return test_sessions

def run_auto_termination_check():
    """Simulate the scheduler's auto-termination check"""
    
    client = MongoClient(MONGODB_URI)
    db = client[DB_NAME]
    sessions = db["sessions"]
    attendance = db["attendance"]
    
    # Find active sessions with time limits
    active_sessions = list(sessions.find({
        "status": "active",
        "timeLimit": {"$exists": True, "$ne": None}
    }))
    
    current_time = datetime.now(timezone.utc)
    results = {
        "checked": len(active_sessions),
        "expired": [],
        "active": []
    }
    
    for session in active_sessions:
        start_time_str = session.get("startTime").replace('Z', '+00:00')
        start_time = datetime.fromisoformat(start_time_str)
        
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        
        elapsed_seconds = (current_time - start_time).total_seconds()
        elapsed_minutes = elapsed_seconds / 60
        time_limit = session.get("timeLimit")
        
        if elapsed_minutes >= time_limit:
            # Auto-end the session
            sessions.update_one(
                {"_id": session["_id"], "status": "active"},
                {
                    "$set": {
                        "status": "completed",
                        "endTime": current_time.isoformat(),
                        "autoEnded": True,
                        "autoEndReason": f"Time limit of {time_limit} minutes exceeded"
                    }
                }
            )
            
            # Update attendance records
            attendance.update_many(
                {
                    "sessionId": str(session["_id"]),
                    "status": {"$in": ["present", "late"]}
                },
                {
                    "$set": {
                        "sessionAutoEnded": True,
                        "sessionEndTime": current_time.isoformat()
                    }
                }
            )
            
            results["expired"].append({
                "sessionId": str(session["_id"]),
                "courseCode": session.get("courseCode"),
                "elapsed": f"{elapsed_minutes:.1f}",
                "limit": time_limit
            })
        else:
            results["active"].append({
                "sessionId": str(session["_id"]),
                "courseCode": session.get("courseCode"),
                "elapsed": f"{elapsed_minutes:.1f}",
                "limit": time_limit
            })
    
    return results

def main():
    """Run the integration test"""
    
    print("\n" + "="*70)
    print("AUTOMATIC SESSION TERMINATION - INTEGRATION TEST")
    print("="*70)
    
    # Setup test data
    print("\n📋 Setting up test data...")
    test_sessions = setup_test_data()
    
    print("\nCreated test sessions:")
    for scenario, sid, session in test_sessions:
        print(f"  [{scenario}] {session['courseCode']}")
        if 'timeLimit' in session:
            print(f"    └─ Time Limit: {session['timeLimit']} minutes")
        else:
            print(f"    └─ No time limit")
    
    # Run the auto-termination check
    print("\n⏳ Running auto-termination check...")
    results = run_auto_termination_check()
    
    print(f"\nCheck results:")
    print(f"  - Sessions checked: {results['checked']}")
    print(f"  - Sessions expired: {len(results['expired'])}")
    print(f"  - Sessions still active: {len(results['active'])}")
    
    if results['expired']:
        print(f"\n✅ Expired sessions (auto-ended):")
        for exp in results['expired']:
            print(f"  - {exp['courseCode']}: {exp['elapsed']} minutes (limit: {exp['limit']}m)")
    
    if results['active']:
        print(f"\n⏱️  Active sessions (not expired):")
        for act in results['active']:
            print(f"  - {act['courseCode']}: {act['elapsed']} minutes (limit: {act['limit']}m)")
    
    # Verify results
    print("\n" + "-"*70)
    print("VERIFICATION")
    print("-"*70)
    
    client = MongoClient(MONGODB_URI)
    db = client[DB_NAME]
    sessions = db["sessions"]
    attendance = db["attendance"]
    
    all_correct = True
    
    # Check each test scenario
    for scenario, sid, original in test_sessions:
        updated = sessions.find_one({"_id": sid})
        
        if scenario == "EXPIRED":
            if updated["status"] == "completed" and updated.get("autoEnded"):
                print(f"✅ {original['courseCode']}: Correctly auto-ended")
                
                # Verify attendance records updated
                att_count = attendance.count_documents({
                    "sessionId": str(sid),
                    "sessionAutoEnded": True
                })
                if att_count == 3:
                    print(f"   └─ {att_count}/3 attendance records marked as auto-ended ✓")
                else:
                    print(f"   └─ ⚠️  {att_count}/3 attendance records marked as auto-ended")
            else:
                print(f"❌ {original['courseCode']}: Should be expired but isn't")
                all_correct = False
        
        elif scenario == "ACTIVE":
            if updated["status"] == "active" and not updated.get("autoEnded"):
                print(f"✅ {original['courseCode']}: Correctly remained active")
            else:
                print(f"❌ {original['courseCode']}: Should be active but was ended")
                all_correct = False
        
        elif scenario == "NO_LIMIT":
            if updated["status"] == "active" and not updated.get("autoEnded"):
                print(f"✅ {original['courseCode']}: Correctly never auto-ended (no limit)")
            else:
                print(f"❌ {original['courseCode']}: Should remain active but was ended")
                all_correct = False
    
    # Cleanup
    print("\n🧹 Cleaning up test data...")
    sessions.delete_many({"courseCode": {"$regex": "^TEST_"}})
    attendance.delete_many({"courseCode": {"$regex": "^TEST_"}})
    print("Test data cleaned up")
    
    # Final result
    print("\n" + "="*70)
    if all_correct:
        print("✅ INTEGRATION TEST PASSED - All scenarios handled correctly!")
    else:
        print("❌ INTEGRATION TEST FAILED - Some scenarios failed")
    print("="*70 + "\n")
    
    return all_correct

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
