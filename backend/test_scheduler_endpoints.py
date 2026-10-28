"""
Comprehensive test for all scheduler endpoints.
Tests the complete flow of scheduling, retrieving, updating, cancelling, and starting sessions.
"""

import sys
import os
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
from dotenv import load_dotenv
import requests
import json
import time

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "vmeet")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

def get_mongodb():
    """Get MongoDB connection"""
    client = MongoClient(MONGODB_URI)
    return client[DB_NAME]

def get_nigeria_time():
    """Get current time in Nigeria timezone (UTC+1)"""
    return datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))

def test_scheduler_endpoints():
    """Test all scheduler endpoints"""
    
    db = get_mongodb()
    
    print("\n" + "="*70)
    print("COMPREHENSIVE SCHEDULER ENDPOINTS TEST")
    print("="*70)
    
    # Setup test data
    test_lecturer_id = "test_scheduler_lecturer_001"
    test_course_code = "CS301"
    
    # Clean up existing test data
    print("\n[SETUP] Cleaning up existing test data...")
    db.users.delete_one({"userId": test_lecturer_id})
    db.schedules.delete_many({"lecturerId": test_lecturer_id})
    print("✓ Cleaned up test data")
    
    # Create test lecturer with courses
    print("\n[SETUP] Creating test lecturer...")
    lecturer_doc = {
        "userId": test_lecturer_id,
        "name": "Dr. Test Scheduler",
        "email": "scheduler@test.com",
        "role": "lecturer",
        "courses": [test_course_code, "CS302", "CS303"],
        "department": "Computer Science"
    }
    db.users.insert_one(lecturer_doc)
    print(f"✓ Created test lecturer: {test_lecturer_id}")
    
    # Test 1: Schedule Attendance Session
    print("\n" + "-"*70)
    print("TEST 1: Schedule Attendance Session")
    print("-"*70)
    
    # Calculate future date/time
    future_time = get_nigeria_time() + timedelta(hours=2)
    scheduled_date = future_time.strftime("%Y-%m-%d")
    scheduled_time = future_time.strftime("%H:%M")
    
    schedule_payload = {
        "lecturerId": test_lecturer_id,
        "courseCode": test_course_code,
        "scheduledDate": scheduled_date,
        "scheduledTime": scheduled_time,
        "timeLimit": 60,
        "description": "Test scheduled attendance session"
    }
    
    print(f"\nScheduling session for {scheduled_date} at {scheduled_time}")
    try:
        response = requests.post(
            f"{BACKEND_URL}/schedule-attendance",
            json=schedule_payload,
            timeout=10
        )
        
        print(f"Response Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get("status") == "success":
            schedule_id = data.get("scheduleId")
            print(f"\n✓ TEST 1 PASSED: Schedule created successfully")
            print(f"  Schedule ID: {schedule_id}")
        else:
            print(f"\n✗ TEST 1 FAILED: Unexpected response")
            return False
    except Exception as e:
        print(f"\n✗ TEST 1 FAILED: {str(e)}")
        return False
    
    # Test 2: Get Lecturer Schedules
    print("\n" + "-"*70)
    print("TEST 2: Get Lecturer Schedules")
    print("-"*70)
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/lecturer-schedules",
            params={"lecturerId": test_lecturer_id},
            timeout=10
        )
        
        print(f"Response Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get("status") == "success":
            schedules = data.get("schedules", {})
            upcoming = schedules.get("upcoming", [])
            
            if len(upcoming) > 0:
                retrieved_schedule = upcoming[0]
                print(f"\n✓ TEST 2 PASSED: Schedules retrieved successfully")
                print(f"  Found {len(upcoming)} upcoming schedule(s)")
                print(f"  Schedule: {retrieved_schedule['courseCode']} at {retrieved_schedule['scheduledTime']}")
            else:
                print(f"\n✗ TEST 2 FAILED: No schedules found in response")
                return False
        else:
            print(f"\n✗ TEST 2 FAILED: Unexpected response")
            return False
    except Exception as e:
        print(f"\n✗ TEST 2 FAILED: {str(e)}")
        return False
    
    # Test 3: Get Schedule Details
    print("\n" + "-"*70)
    print("TEST 3: Get Schedule Details")
    print("-"*70)
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/schedule-details",
            params={"scheduleId": schedule_id},
            timeout=10
        )
        
        print(f"Response Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get("status") == "success":
            schedule_detail = data.get("schedule", {})
            print(f"\n✓ TEST 3 PASSED: Schedule details retrieved successfully")
            print(f"  Course: {schedule_detail['courseCode']}")
            print(f"  Time Limit: {schedule_detail['timeLimit']} minutes")
            print(f"  Status: {schedule_detail['status']}")
        else:
            print(f"\n✗ TEST 3 FAILED: Unexpected response")
            return False
    except Exception as e:
        print(f"\n✗ TEST 3 FAILED: {str(e)}")
        return False
    
    # Test 4: Update Schedule
    print("\n" + "-"*70)
    print("TEST 4: Update Schedule")
    print("-"*70)
    
    # Calculate new future time
    new_future_time = get_nigeria_time() + timedelta(hours=3)
    new_scheduled_date = new_future_time.strftime("%Y-%m-%d")
    new_scheduled_time = new_future_time.strftime("%H:%M")
    
    update_payload = {
        "scheduleId": schedule_id,
        "scheduledDate": new_scheduled_date,
        "scheduledTime": new_scheduled_time,
        "timeLimit": 90,
        "description": "Updated test scheduled session"
    }
    
    print(f"\nUpdating to new time: {new_scheduled_date} at {new_scheduled_time}")
    try:
        response = requests.put(
            f"{BACKEND_URL}/update-schedule",
            json=update_payload,
            timeout=10
        )
        
        print(f"Response Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get("status") == "success":
            print(f"\n✓ TEST 4 PASSED: Schedule updated successfully")
        else:
            print(f"\n✗ TEST 4 FAILED: Unexpected response")
            return False
    except Exception as e:
        print(f"\n✗ TEST 4 FAILED: {str(e)}")
        return False
    
    # Test 5: Start Scheduled Session
    print("\n" + "-"*70)
    print("TEST 5: Start Scheduled Session")
    print("-"*70)
    
    start_payload = {
        "scheduleId": schedule_id,
        "lecturerId": test_lecturer_id,
        "latitude": 6.5244,
        "longitude": 3.3792
    }
    
    print(f"\nStarting scheduled session at location (6.5244, 3.3792)")
    try:
        response = requests.post(
            f"{BACKEND_URL}/start-scheduled-session",
            json=start_payload,
            timeout=10
        )
        
        print(f"Response Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get("status") == "success":
            session_id = data.get("sessionId")
            session_code = data.get("sessionCode")
            print(f"\n✓ TEST 5 PASSED: Session started from schedule")
            print(f"  Session ID: {session_id}")
            print(f"  Session Code: {session_code}")
            print(f"  Course: {data.get('courseCode')}")
        else:
            print(f"\n✗ TEST 5 FAILED: Unexpected response")
            return False
    except Exception as e:
        print(f"\n✗ TEST 5 FAILED: {str(e)}")
        return False
    
    # Test 6: Verify Schedule Status Updated to "started"
    print("\n" + "-"*70)
    print("TEST 6: Verify Schedule Status")
    print("-"*70)
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/schedule-details",
            params={"scheduleId": schedule_id},
            timeout=10
        )
        
        print(f"Response Status: {response.status_code}")
        data = response.json()
        
        if response.status_code == 200 and data.get("status") == "success":
            schedule_detail = data.get("schedule", {})
            status = schedule_detail.get("status")
            
            if status == "started":
                print(f"\n✓ TEST 6 PASSED: Schedule status updated to 'started'")
                print(f"  Status: {status}")
                print(f"  Session ID linked: {schedule_detail.get('sessionId', 'N/A')}")
            else:
                print(f"\n✗ TEST 6 FAILED: Status is '{status}', expected 'started'")
                return False
        else:
            print(f"\n✗ TEST 6 FAILED: Could not retrieve schedule")
            return False
    except Exception as e:
        print(f"\n✗ TEST 6 FAILED: {str(e)}")
        return False
    
    # Test 7: Create Another Schedule for Cancel Test
    print("\n" + "-"*70)
    print("TEST 7: Cancel Schedule")
    print("-"*70)
    
    # Create a new schedule to cancel
    cancel_future_time = get_nigeria_time() + timedelta(hours=4)
    cancel_date = cancel_future_time.strftime("%Y-%m-%d")
    cancel_time = cancel_future_time.strftime("%H:%M")
    
    cancel_schedule_payload = {
        "lecturerId": test_lecturer_id,
        "courseCode": "CS302",
        "scheduledDate": cancel_date,
        "scheduledTime": cancel_time,
        "timeLimit": 45,
        "description": "Schedule to be cancelled"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/schedule-attendance",
            json=cancel_schedule_payload,
            timeout=10
        )
        
        if response.status_code == 200:
            cancel_schedule_id = response.json().get("scheduleId")
            print(f"\nCreated schedule to cancel: {cancel_schedule_id}")
            
            # Now cancel it
            cancel_payload = {
                "scheduleId": cancel_schedule_id,
                "lecturerId": test_lecturer_id
            }
            
            response = requests.post(
                f"{BACKEND_URL}/cancel-schedule",
                json=cancel_payload,
                timeout=10
            )
            
            print(f"Cancel Response Status: {response.status_code}")
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if response.status_code == 200 and data.get("status") == "success":
                # Verify it was cancelled
                response = requests.get(
                    f"{BACKEND_URL}/schedule-details",
                    params={"scheduleId": cancel_schedule_id},
                    timeout=10
                )
                
                if response.status_code == 200:
                    detail = response.json().get("schedule", {})
                    if detail.get("status") == "cancelled":
                        print(f"\n✓ TEST 7 PASSED: Schedule cancelled successfully")
                        print(f"  Status verified: {detail.get('status')}")
                    else:
                        print(f"\n✗ TEST 7 FAILED: Status not updated to 'cancelled'")
                        return False
                else:
                    print(f"\n✗ TEST 7 FAILED: Could not verify cancellation")
                    return False
            else:
                print(f"\n✗ TEST 7 FAILED: Cancel endpoint returned error")
                return False
        else:
            print(f"\n✗ TEST 7 FAILED: Could not create schedule for cancellation test")
            return False
    except Exception as e:
        print(f"\n✗ TEST 7 FAILED: {str(e)}")
        return False
    
    # Test 8: Get Today's Schedules
    print("\n" + "-"*70)
    print("TEST 8: Get Today's Schedules")
    print("-"*70)
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/upcoming-schedules-today",
            params={"lecturerId": test_lecturer_id},
            timeout=10
        )
        
        print(f"Response Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get("status") == "success":
            schedules = data.get("schedules", [])
            print(f"\n✓ TEST 8 PASSED: Today's schedules retrieved")
            print(f"  Found {len(schedules)} schedule(s) for today")
        else:
            print(f"\n✗ TEST 8 FAILED: Unexpected response")
            return False
    except Exception as e:
        print(f"\n✗ TEST 8 FAILED: {str(e)}")
        return False
    
    # Cleanup
    print("\n" + "-"*70)
    print("CLEANUP")
    print("-"*70)
    
    db.users.delete_one({"userId": test_lecturer_id})
    db.schedules.delete_many({"lecturerId": test_lecturer_id})
    print("✓ Test data cleaned up")
    
    # Summary
    print("\n" + "="*70)
    print("✓ ALL TESTS PASSED!")
    print("="*70)
    print("\nScheduler endpoints verified:")
    print("  1. POST /schedule-attendance - Create schedule")
    print("  2. GET /lecturer-schedules - Retrieve all schedules")
    print("  3. GET /schedule-details - Get schedule details")
    print("  4. PUT /update-schedule - Update schedule")
    print("  5. POST /start-scheduled-session - Start session from schedule")
    print("  6. Verify schedule status transitions")
    print("  7. POST /cancel-schedule - Cancel schedule")
    print("  8. GET /upcoming-schedules-today - Get today's schedules")
    print("="*70 + "\n")
    
    return True

if __name__ == "__main__":
    try:
        success = test_scheduler_endpoints()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n✗ FATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
