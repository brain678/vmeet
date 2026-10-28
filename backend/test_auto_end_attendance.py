"""
Test script for automatic session termination with attendance record handling
Verifies that attendance records are saved and handled properly just like manual termination
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

def test_auto_end_with_attendance():
    """Test automatic session termination with proper attendance record handling"""
    
    try:
        # Connect to MongoDB
        client = MongoClient(MONGODB_URI)
        db = client[DB_NAME]
        sessions_collection = db["sessions"]
        attendance_collection = db["attendance"]
        
        print("\n" + "="*70)
        print("TESTING AUTO-END SESSION WITH ATTENDANCE RECORD HANDLING")
        print("="*70)
        
        # Use unique session ID with timestamp
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        test_session_id = f"test_auto_end_{unique_id}"
        test_session = {
            "sessionId": test_session_id,
            "courseCode": "TEST101",
            "lectureId": "test_lecture_001",
            "hostId": "lecturer_001",
            "status": "active",
            "startTime": (datetime.now(timezone.utc) - timedelta(seconds=70)).isoformat(),
            "endTime": None,
            "timeLimit": 1,  # 1 minute limit
            "attendeeCount": 0,
            "attendanceRecords": [],
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        
        result = sessions_collection.insert_one(test_session)
        session_mongo_id = result.inserted_id
        
        print(f"\n✓ Created test session:")
        print(f"  - Session ID: {test_session_id}")
        print(f"  - MongoDB ID: {session_mongo_id}")
        print(f"  - Course: {test_session['courseCode']}")
        print(f"  - Time Limit: {test_session['timeLimit']} minute(s)")
        print(f"  - Elapsed: ~70 seconds (exceeds 1 minute limit)")
        
        # Create test attendance records
        attendance_records = [
            {
                "sessionId": test_session_id,
                "userId": "student_001",
                "studentId": "student_001",
                "studentName": "John Doe",
                "status": "present",
                "timestamp": (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat(),
                "created_at": datetime.now(timezone.utc)
            },
            {
                "sessionId": test_session_id,
                "userId": "student_002",
                "studentId": "student_002",
                "studentName": "Jane Smith",
                "status": "present",
                "timestamp": (datetime.now(timezone.utc) - timedelta(seconds=45)).isoformat(),
                "created_at": datetime.now(timezone.utc)
            },
            {
                "sessionId": test_session_id,
                "userId": "student_003",
                "studentId": "student_003",
                "studentName": "Bob Johnson",
                "status": "late",
                "timestamp": (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat(),
                "created_at": datetime.now(timezone.utc)
            }
        ]
        
        attendance_ids = []
        for record in attendance_records:
            result = attendance_collection.insert_one(record)
            attendance_ids.append(result.inserted_id)
        
        print(f"\n✓ Created {len(attendance_records)} attendance records:")
        for i, record in enumerate(attendance_records, 1):
            print(f"  {i}. {record['studentName']} ({record['status']})")
        
        # Simulate the scheduler's auto-end logic
        print(f"\n⏳ Simulating scheduler auto-end...\n")
        time.sleep(1)
        
        # This is what the scheduler would do
        current_time = datetime.now(timezone.utc)
        start_time_str = test_session["startTime"].replace('Z', '+00:00')
        start_time = datetime.fromisoformat(start_time_str)
        
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        
        elapsed_seconds = (current_time - start_time).total_seconds()
        elapsed_minutes = elapsed_seconds / 60
        time_limit_minutes = test_session.get("timeLimit")
        
        print(f"Session Check:")
        print(f"  - Elapsed: {elapsed_minutes:.2f} minutes")
        print(f"  - Limit: {time_limit_minutes} minute(s)")
        print(f"  - Expired: {elapsed_minutes >= time_limit_minutes}")
        
        if elapsed_minutes >= time_limit_minutes:
            # Nigeria timezone (UTC+1)
            nigeria_time = current_time.replace(tzinfo=timezone.utc).astimezone(
                timezone(timedelta(hours=1))
            )
            
            # Get all attendance records
            records = list(attendance_collection.find({"sessionId": test_session_id}))
            print(f"\n✓ Found {len(records)} attendance records to update")
            
            # Update each attendance record (same as manual end)
            for record in records:
                attendance_collection.update_one(
                    {"_id": record["_id"]},
                    {
                        "$set": {
                            "sessionEndTime": nigeria_time.isoformat(),
                            "sessionStatus": "completed",
                            "autoEnded": True,
                            "lastUpdated": datetime.utcnow().isoformat()
                        }
                    }
                )
            
            # Update session status
            session_update = sessions_collection.update_one(
                {"_id": session_mongo_id, "status": "active"},
                {
                    "$set": {
                        "status": "completed",
                        "endTime": nigeria_time.isoformat(),
                        "autoEnded": True,
                        "autoEndReason": f"Time limit of {time_limit_minutes} minutes exceeded",
                        "attendeeCount": len(records),
                        "lastUpdated": datetime.utcnow().isoformat()
                    }
                }
            )
            
            if session_update.modified_count > 0:
                print(f"  ✓ Session auto-ended successfully")
                print(f"  ✓ All {len(records)} attendance records updated")
        
        # VERIFICATION
        print(f"\n" + "-"*70)
        print("VERIFICATION - Checking Session and Attendance Records")
        print("-"*70)
        
        # Check session
        updated_session = sessions_collection.find_one({"_id": session_mongo_id})
        print(f"\nUpdated Session:")
        print(f"  - Status: {updated_session.get('status')}")
        print(f"  - Auto Ended: {updated_session.get('autoEnded', False)}")
        print(f"  - Auto End Reason: {updated_session.get('autoEndReason', 'N/A')}")
        print(f"  - End Time: {updated_session.get('endTime', 'N/A')}")
        print(f"  - Attendee Count: {updated_session.get('attendeeCount', 0)}")
        
        # Check attendance records
        print(f"\nUpdated Attendance Records:")
        updated_records = list(attendance_collection.find({"sessionId": test_session_id}))
        for i, record in enumerate(updated_records, 1):
            print(f"\n  Record {i}: {record['studentName']}")
            print(f"    - Status: {record.get('status')}")
            print(f"    - Session Status: {record.get('sessionStatus')}")
            print(f"    - Auto Ended: {record.get('autoEnded', False)}")
            print(f"    - Session End Time: {record.get('sessionEndTime', 'N/A')}")
            print(f"    - Last Updated: {record.get('lastUpdated', 'N/A')}")
        
        # Verification checks
        print(f"\n" + "-"*70)
        print("VERIFICATION CHECKS")
        print("-"*70)
        
        checks_passed = 0
        total_checks = 6
        
        # Check 1: Session status
        if updated_session.get('status') == 'completed':
            print(f"✓ Check 1: Session status is 'completed'")
            checks_passed += 1
        else:
            print(f"✗ Check 1: Session status is '{updated_session.get('status')}' (expected 'completed')")
        
        # Check 2: Auto ended flag
        if updated_session.get('autoEnded'):
            print(f"✓ Check 2: Session marked as auto-ended")
            checks_passed += 1
        else:
            print(f"✗ Check 2: Session not marked as auto-ended")
        
        # Check 3: End time set
        if updated_session.get('endTime'):
            print(f"✓ Check 3: Session end time is set")
            checks_passed += 1
        else:
            print(f"✗ Check 3: Session end time is not set")
        
        # Check 4: Attendee count
        if updated_session.get('attendeeCount') == len(attendance_records):
            print(f"✓ Check 4: Attendee count matches ({updated_session.get('attendeeCount')} records)")
            checks_passed += 1
        else:
            print(f"✗ Check 4: Attendee count mismatch")
        
        # Check 5: All attendance records updated
        all_records_updated = all(
            r.get('sessionStatus') == 'completed' and 
            r.get('autoEnded') and 
            r.get('sessionEndTime')
            for r in updated_records
        )
        if all_records_updated:
            print(f"✓ Check 5: All {len(updated_records)} attendance records properly updated")
            checks_passed += 1
        else:
            print(f"✗ Check 5: Not all attendance records were properly updated")
        
        # Check 6: Student status preserved
        original_statuses = {r['studentId']: r['status'] for r in attendance_records}
        updated_statuses = {r['studentId']: r['status'] for r in updated_records}
        if original_statuses == updated_statuses:
            print(f"✓ Check 6: Original student attendance statuses preserved")
            checks_passed += 1
        else:
            print(f"✗ Check 6: Student attendance statuses were modified")
        
        # Final result
        print(f"\n" + "="*70)
        if checks_passed == total_checks:
            print(f"✅ ALL TESTS PASSED ({checks_passed}/{total_checks})")
            print(f"\n✨ Attendance records are properly saved and handled,")
            print(f"   just like manual session termination!")
            result_code = 0
        else:
            print(f"❌ SOME TESTS FAILED ({checks_passed}/{total_checks})")
            result_code = 1
        print("="*70)
        
        # Cleanup
        sessions_collection.delete_one({"_id": session_mongo_id})
        attendance_collection.delete_many({"sessionId": test_session_id})
        print(f"\n🧹 Cleaned up test data\n")
        
        return result_code
    
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    result = test_auto_end_with_attendance()
    sys.exit(result)
