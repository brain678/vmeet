"""
Test script for attendance scheduler functionality.
Tests creating, retrieving, updating, and starting scheduled sessions.
"""

import sys
import os
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
from dotenv import load_dotenv
import requests
import json

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "vmeet")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

def get_mongodb():
    """Get MongoDB connection"""
    client = MongoClient(MONGODB_URI)
    return client[DB_NAME]

def test_schedule_endpoints():
    """Test all schedule endpoints"""
    
    db = get_mongodb()
    
    print("\n" + "="*60)
    print("TESTING ATTENDANCE SCHEDULER")
    print("="*60)
    
    # Create test user (lecturer)
    test_lecturer_id = "test_lecturer_001"
    test_course_code = "TEST101"
    
    # Ensure test lecturer exists with courses
    lecturer = db.users.find_one({"userId": test_lecturer_id})
    if not lecturer:
        db.users.insert_one({
            "userId": test_lecturer_id,
            "name": "Test Lecturer",
            "email": "lecturer@test.com",
            "role": "lecturer",
            "courses": [test_course_code, "TEST102"],
            "department": "Computer Science"
        })
        print(f"✓ Created test lecturer: {test_lecturer_id}")
    else:
        # Add courses if not present
        if test_course_code not in lecturer.get("courses", []):
            db.users.update_one(
                {"userId": test_lecturer_id},
                {"$push": {"courses": test_course_code}}
            )
        print(f"✓ Using existing test lecturer: {test_lecturer_id}")
    
    # Test 1: Schedule attendance session
    print(f"\n--- Test 1: Schedule Attendance Session ---")
    
    scheduled_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    scheduled_time = "14:30"
    
    schedule_payload = {
        "lecturerId": test_lecturer_id,
        "courseCode": test_course_code,
        "scheduledDate": scheduled_date,
        "scheduledTime": scheduled_time,
        "timeLimit": 30,
        "description": "Test scheduled attendance session"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/schedule-attendance",
            json=schedule_payload,
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") == "success":
            schedule_id = data.get("scheduleId")
            print(f"✓ Schedule created successfully")
            print(f"  Schedule ID: {schedule_id}")
            print(f"  Scheduled for: {scheduled_date} at {scheduled_time}")
            print(f"  Time Limit: 30 minutes")
        else:
            print(f"✗ Failed to create schedule: {data}")
            return False
    except Exception as e:
        print(f"✗ Error scheduling attendance: {str(e)}")
        return False
    
    # Test 2: Get lecturer schedules
    print(f"\n--- Test 2: Retrieve Lecturer Schedules ---")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/lecturer-schedules?lecturerId={test_lecturer_id}",
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") == "success":
            schedules = data.get("schedules", {})
            upcoming = schedules.get("upcoming", [])
            
            print(f"✓ Retrieved schedules successfully")
            print(f"  Upcoming: {len(upcoming)}")
            print(f"  Started: {len(schedules.get('started', []))}")
            print(f"  Completed: {len(schedules.get('completed', []))}")
            print(f"  Cancelled: {len(schedules.get('cancelled', []))}")
            
            if upcoming and upcoming[0].get("scheduleId") == schedule_id:
                print(f"  ✓ Found our test schedule in upcoming list")
        else:
            print(f"✗ Failed to retrieve schedules: {data}")
            return False
    except Exception as e:
        print(f"✗ Error retrieving schedules: {str(e)}")
        return False
    
    # Test 3: Get schedule details
    print(f"\n--- Test 3: Get Schedule Details ---")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/schedule-details?scheduleId={schedule_id}",
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") == "success":
            schedule = data.get("schedule", {})
            print(f"✓ Retrieved schedule details")
            print(f"  Course: {schedule.get('courseCode')}")
            print(f"  Date: {schedule.get('scheduledDate')}")
            print(f"  Time: {schedule.get('scheduledTime')}")
            print(f"  Time Limit: {schedule.get('timeLimit')} minutes")
            print(f"  Description: {schedule.get('description')}")
            print(f"  Status: {schedule.get('status')}")
        else:
            print(f"✗ Failed to retrieve schedule details: {data}")
            return False
    except Exception as e:
        print(f"✗ Error retrieving schedule details: {str(e)}")
        return False
    
    # Test 4: Update schedule
    print(f"\n--- Test 4: Update Schedule ---")
    
    updated_time = "15:00"
    
    try:
        response = requests.put(
            f"{BACKEND_URL}/update-schedule",
            json={
                "scheduleId": schedule_id,
                "scheduledTime": updated_time,
                "timeLimit": 45,
                "description": "Updated test schedule"
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") == "success":
            print(f"✓ Schedule updated successfully")
            print(f"  New time: {updated_time}")
            print(f"  New time limit: 45 minutes")
        else:
            print(f"✗ Failed to update schedule: {data}")
            return False
    except Exception as e:
        print(f"✗ Error updating schedule: {str(e)}")
        return False
    
    # Test 5: Start scheduled session (with mock location)
    print(f"\n--- Test 5: Start Scheduled Session ---")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/start-scheduled-session",
            json={
                "scheduleId": schedule_id,
                "lecturerId": test_lecturer_id,
                "latitude": 6.5244,
                "longitude": 3.3792
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") == "success":
            session_id = data.get("sessionId")
            session_code = data.get("sessionCode")
            print(f"✓ Scheduled session started successfully")
            print(f"  Session ID: {session_id}")
            print(f"  Session Code: {session_code}")
            print(f"  Course: {data.get('courseCode')}")
            
            # Verify session was created in DB
            session = db.sessions.find_one({"sessionId": session_id})
            if session:
                print(f"  ✓ Session found in database")
                print(f"    Status: {session.get('status')}")
                print(f"    Time Limit: {session.get('timeLimit')} minutes")
                print(f"    Linked Schedule: {session.get('scheduleId')}")
        else:
            print(f"✗ Failed to start session: {data}")
            return False
    except Exception as e:
        print(f"✗ Error starting scheduled session: {str(e)}")
        return False
    
    # Test 6: Cancel schedule
    print(f"\n--- Test 6: Cancel Schedule ---")
    
    # Create another schedule to cancel
    cancel_payload = {
        "lecturerId": test_lecturer_id,
        "courseCode": test_course_code,
        "scheduledDate": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
        "scheduledTime": "10:00",
        "description": "Schedule to be cancelled"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/schedule-attendance",
            json=cancel_payload,
            timeout=10
        )
        response.raise_for_status()
        cancel_schedule_id = response.json().get("scheduleId")
        
        # Now cancel it
        response = requests.post(
            f"{BACKEND_URL}/cancel-schedule",
            json={
                "scheduleId": cancel_schedule_id,
                "lecturerId": test_lecturer_id
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") == "success":
            print(f"✓ Schedule cancelled successfully")
            
            # Verify in DB
            schedule = db.schedules.find_one({"scheduleId": cancel_schedule_id})
            if schedule and schedule.get("status") == "cancelled":
                print(f"  ✓ Schedule status updated to 'cancelled' in database")
        else:
            print(f"✗ Failed to cancel schedule: {data}")
            return False
    except Exception as e:
        print(f"✗ Error cancelling schedule: {str(e)}")
        return False
    
    # Test 7: Get upcoming schedules for today
    print(f"\n--- Test 7: Get Today's Upcoming Schedules ---")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/upcoming-schedules-today?lecturerId={test_lecturer_id}",
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") == "success":
            schedules = data.get("schedules", [])
            print(f"✓ Retrieved today's schedules")
            print(f"  Total for today: {len(schedules)}")
        else:
            print(f"✗ Failed to retrieve today's schedules: {data}")
            return False
    except Exception as e:
        print(f"✗ Error retrieving today's schedules: {str(e)}")
        return False
    
    # Cleanup
    print(f"\n--- Cleanup ---")
    try:
        db.schedules.delete_many({"lecturerId": test_lecturer_id})
        db.sessions.delete_many({"hostId": test_lecturer_id})
        db.users.delete_one({"userId": test_lecturer_id})
        print(f"✓ Cleaned up test data")
    except Exception as e:
        print(f"⚠ Cleanup error (non-critical): {str(e)}")
    
    print(f"\n" + "="*60)
    print("✅ ALL TESTS PASSED")
    print("="*60 + "\n")
    
    return True

if __name__ == "__main__":
    try:
        success = test_schedule_endpoints()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
