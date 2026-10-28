"""
Test script for automatic session termination with time limits
Tests the session expiration functionality
"""

import sys
import os
import time
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "vmeet")

def test_session_auto_termination():
    """Test automatic session termination based on time limit"""
    
    try:
        # Connect to MongoDB
        client = MongoClient(MONGODB_URI)
        db = client[DB_NAME]
        sessions_collection = db["sessions"]
        
        print("\n" + "="*60)
        print("TESTING AUTOMATIC SESSION TERMINATION")
        print("="*60)
        
        # Create a test session with 1-minute time limit
        test_session = {
            "courseCode": "TEST101",
            "lectureId": "test_lecture_001",
            "status": "active",
            "startTime": (datetime.now(timezone.utc) - timedelta(seconds=70)).isoformat(),  # Started 70 seconds ago
            "timeLimit": 1,  # 1 minute limit
            "attendanceRecords": [],
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        
        result = sessions_collection.insert_one(test_session)
        session_id = result.inserted_id
        
        print(f"\n✓ Created test session:")
        print(f"  - Session ID: {session_id}")
        print(f"  - Course: {test_session['courseCode']}")
        print(f"  - Time Limit: {test_session['timeLimit']} minute(s)")
        print(f"  - Start Time: {test_session['startTime']}")
        print(f"  - Elapsed: ~70 seconds (exceeds 1 minute limit)")
        print(f"  - Status: {test_session['status']}")
        
        # Simulate the scheduler's check_and_end_expired_sessions function
        print(f"\n⏳ Simulating scheduler check...\n")
        time.sleep(1)
        
        # This is what the scheduler would do
        active_sessions = list(sessions_collection.find({
            "status": "active",
            "timeLimit": {"$exists": True, "$ne": None}
        }))
        
        print(f"Found {len(active_sessions)} active session(s) with time limit")
        
        current_time = datetime.now(timezone.utc)
        for session in active_sessions:
            start_time_str = session.get("startTime").replace('Z', '+00:00')
            start_time = datetime.fromisoformat(start_time_str)
            
            if start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=timezone.utc)
            
            elapsed_seconds = (current_time - start_time).total_seconds()
            elapsed_minutes = elapsed_seconds / 60
            time_limit_minutes = session.get("timeLimit")
            
            print(f"\nSession {session['_id']}:")
            print(f"  - Elapsed: {elapsed_minutes:.2f} minutes")
            print(f"  - Limit: {time_limit_minutes} minute(s)")
            print(f"  - Expired: {elapsed_minutes >= time_limit_minutes}")
            
            if elapsed_minutes >= time_limit_minutes:
                # Auto-end the session
                update_result = sessions_collection.update_one(
                    {"_id": session["_id"], "status": "active"},
                    {
                        "$set": {
                            "status": "completed",
                            "endTime": current_time.isoformat(),
                            "autoEnded": True,
                            "autoEndReason": f"Time limit of {time_limit_minutes} minutes exceeded"
                        }
                    }
                )
                
                if update_result.modified_count > 0:
                    print(f"  ✓ Session auto-ended successfully")
        
        # Verify the session was ended
        print(f"\n" + "-"*60)
        print("VERIFICATION")
        print("-"*60)
        
        updated_session = sessions_collection.find_one({"_id": session_id})
        
        print(f"\nUpdated session status:")
        print(f"  - Status: {updated_session.get('status')}")
        print(f"  - Auto Ended: {updated_session.get('autoEnded', False)}")
        print(f"  - Auto End Reason: {updated_session.get('autoEndReason', 'N/A')}")
        print(f"  - End Time: {updated_session.get('endTime', 'N/A')}")
        
        if updated_session.get('status') == 'completed' and updated_session.get('autoEnded'):
            print(f"\n✅ TEST PASSED: Session was automatically terminated!")
        else:
            print(f"\n❌ TEST FAILED: Session was not properly terminated")
        
        # Cleanup
        sessions_collection.delete_one({"_id": session_id})
        print(f"\n🧹 Cleaned up test session\n")
        
        return updated_session.get('status') == 'completed'
    
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_session_auto_termination()
    sys.exit(0 if success else 1)
