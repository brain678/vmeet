"""
Quick test for auto-completion using real database data
"""
import requests
import json
import time
from datetime import datetime, timedelta, timezone
from bson import ObjectId

# Configuration - using real data from database
BACKEND_URL = "http://localhost:8000"
LECTURER_ID = "user_2xjjkNQnjJNC6NPRShmIL9d5G5u"  # Real lecturer from DB
COURSE_CODE = "CSC111"  # Real course from DB
COURSE_ID = "693409858cbfdb968d6dfcc6"

def get_nigeria_time():
    """Get current time in Nigeria timezone"""
    return datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=1)))

def setup():
    """Assign course to lecturer"""
    print("\n=== SETUP: Assigning Course to Lecturer ===")
    
    from database import db
    
    # Update lecturer to have this course
    result = db.users.update_one(
        {"userId": LECTURER_ID},
        {
            "$addToSet": {
                "courses": ObjectId(COURSE_ID)
            }
        }
    )
    
    if result.modified_count > 0:
        print(f"✅ Assigned course {COURSE_CODE} to lecturer {LECTURER_ID}")
    else:
        print(f"⚠️  Course already assigned or lecturer not updated")
    
    return True

def test_auto_completion():
    """Test auto-completion with real data"""
    print("\n" + "="*70)
    print("AUTO-COMPLETION TEST (Using Real Database Data)")
    print("="*70)
    print(f"Lecturer: {LECTURER_ID}")
    print(f"Course: {COURSE_CODE}")
    
    # Setup
    setup()
    
    # Schedule for 1 minute from now with 2-minute limit
    nigeria_time = get_nigeria_time()
    scheduled_time = nigeria_time + timedelta(minutes=1)
    
    print(f"\nScheduled Time: {scheduled_time.strftime('%Y-%m-%d %H:%M:%S')} (Nigeria TZ)")
    print(f"Time Limit: 2 minutes")
    print(f"\nExpected timeline:")
    print(f"  • Now (~00:00): Schedule created")
    print(f"  • ~00:30: Auto-start scheduler triggers (checks every 30s)")
    print(f"  • ~01:00: Session starts")
    print(f"  • ~01:15: Auto-complete scheduler checks (every 15s)")
    print(f"  • ~03:00: Time limit (2m) expires")
    print(f"  • ~03:15: Auto-complete scheduler ends session")
    
    schedule_data = {
        "lecturerId": LECTURER_ID,
        "courseCode": COURSE_CODE,
        "scheduledDate": scheduled_time.strftime("%Y-%m-%d"),
        "scheduledTime": scheduled_time.strftime("%H:%M"),
        "timeLimit": 2,  # 2 minutes
        "description": "Auto-completion test",
        "latitude": 6.5244,
        "longitude": 3.3792,
    }
    
    print(f"\n=== Creating Schedule ===")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/schedule-attendance",
            json=schedule_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        data = response.json()
        
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get("status") == "success":
            schedule_id = data.get("scheduleId") or data.get("data", {}).get("scheduleId")
            print(f"✅ Schedule created: {schedule_id}")
            
            print(f"\n=== Waiting for Auto-Start (max 35 seconds) ===")
            
            # Wait for auto-start
            max_wait = 35
            elapsed = 0
            session_id = None
            
            while elapsed < max_wait:
                time.sleep(5)
                elapsed += 5
                
                response = requests.get(
                    f"{BACKEND_URL}/get-schedule/{LECTURER_ID}/{schedule_id}",
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    schedule = response.json()
                    status = schedule.get("status")
                    session_id = schedule.get("sessionId")
                    
                    print(f"⏱️  {elapsed}s - Status: {status}", end="")
                    
                    if status == "started" and session_id:
                        print(" ✅")
                        print(f"\n✅ Session auto-started: {session_id}")
                        break
                    else:
                        print()
            
            if not session_id:
                print("❌ Session did not auto-start")
                return False
            
            print(f"\n=== Waiting for Auto-Complete (2m + 30s max) ===")
            
            # Wait for auto-completion (2 minutes + 40 seconds for check)
            wait_time = 160  # 2m40s
            elapsed = 0
            
            while elapsed < wait_time:
                remaining = wait_time - elapsed
                print(f"⏱️  Time remaining: {remaining}s ({remaining//60}m {remaining%60}s)", end="\r")
                
                time.sleep(10)
                elapsed += 10
                
                # Check session status
                from database import db
                session = db.sessions.find_one({"sessionId": session_id})
                
                if session and session.get("status") == "ended":
                    print(f"\n\n✅ Session auto-completed!")
                    print(f"   Status: {session.get('status')}")
                    print(f"   Auto-Completed: {session.get('autoCompleted')}")
                    print(f"   End Time: {session.get('endTime')}")
                    return True
            
            print(f"\n❌ Session did not auto-complete within time limit")
            return False
            
        else:
            print(f"❌ Failed to create schedule")
            print(f"Response: {json.dumps(data, indent=2)}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = test_auto_completion()
    
    print("\n" + "="*70)
    if result:
        print("✅ AUTO-COMPLETION TEST PASSED")
    else:
        print("❌ AUTO-COMPLETION TEST FAILED")
    print("="*70)
