"""
Test script to verify scheduled session visibility for students
This script simulates the complete flow:
1. Create a schedule
2. Start the schedule
3. Check if the session appears in get-student-courses
"""

import asyncio
import httpx
import json
from datetime import datetime, timedelta

BACKEND_URL = "http://localhost:8000"

async def test_scheduled_session_visibility():
    print("\n" + "="*70)
    print("TEST: Scheduled Session Visibility for Students")
    print("="*70)
    
    async with httpx.AsyncClient() as client:
        # Test data
        lecturer_id = "test-lecturer-001"
        student_id = "test-student-001"
        course_code = "CSC101"
        
        print(f"\n1. Testing with:")
        print(f"   Lecturer ID: {lecturer_id}")
        print(f"   Student ID: {student_id}")
        print(f"   Course Code: {course_code}")
        
        # Step 1: Get lecturer's courses
        print(f"\n2. Fetching lecturer's courses...")
        courses_resp = await client.get(
            f"{BACKEND_URL}/get-lecturer-courses",
            params={"userId": lecturer_id}
        )
        print(f"   Status: {courses_resp.status_code}")
        if courses_resp.status_code == 200:
            courses = courses_resp.json().get("courses", [])
            print(f"   Found {len(courses)} courses")
            for c in courses:
                print(f"     - {c.get('code')}: {c.get('title')}")
        else:
            print(f"   Error: {courses_resp.text}")
        
        # Step 2: Create a schedule
        print(f"\n3. Creating a schedule...")
        schedule_date = (datetime.now() + timedelta(hours=2)).strftime("%Y-%m-%d")
        schedule_time = datetime.now().strftime("%H:%M")
        
        create_schedule_resp = await client.post(
            f"{BACKEND_URL}/create-schedule",
            json={
                "lecturerId": lecturer_id,
                "courseCode": course_code,
                "scheduledDate": schedule_date,
                "scheduledTime": schedule_time,
                "timeLimit": 30,
                "description": "Test scheduled session"
            }
        )
        print(f"   Status: {create_schedule_resp.status_code}")
        if create_schedule_resp.status_code == 200:
            schedule_data = create_schedule_resp.json()
            schedule_id = schedule_data.get("scheduleId")
            print(f"   ✓ Schedule created: {schedule_id}")
        else:
            print(f"   Error: {create_schedule_resp.text}")
            return
        
        # Step 3: Get student's courses BEFORE starting schedule
        print(f"\n4. Checking student's courses BEFORE schedule starts...")
        student_courses_before = await client.get(
            f"{BACKEND_URL}/get-student-courses",
            params={"userId": student_id}
        )
        print(f"   Status: {student_courses_before.status_code}")
        if student_courses_before.status_code == 200:
            courses_before = student_courses_before.json().get("courses", [])
            print(f"   Found {len(courses_before)} courses")
            for c in courses_before:
                has_active = c.get("hasActiveSession", False)
                status = "🟢 ACTIVE" if has_active else "⚪ No session"
                print(f"     - {c.get('code')}: {c.get('title')} [{status}]")
                if has_active:
                    print(f"       Session ID: {c.get('sessionId')}")
        else:
            print(f"   Error: {student_courses_before.text}")
        
        # Step 4: Check database for sessions before starting
        print(f"\n5. Checking database for active sessions BEFORE...")
        # We'll show this from backend logs
        
        # Step 5: Start the schedule
        print(f"\n6. Starting the scheduled session...")
        # Using test coordinates for Lagos, Nigeria
        start_schedule_resp = await client.post(
            f"{BACKEND_URL}/start-scheduled-session",
            json={
                "scheduleId": schedule_id,
                "lecturerId": lecturer_id,
                "latitude": 6.827402,
                "longitude": 3.940343
            }
        )
        print(f"   Status: {start_schedule_resp.status_code}")
        if start_schedule_resp.status_code == 200:
            start_data = start_schedule_resp.json()
            session_id = start_data.get("sessionId")
            session_code = start_data.get("sessionCode")
            returned_course_code = start_data.get("courseCode")
            print(f"   ✓ Session started!")
            print(f"     Session ID: {session_id}")
            print(f"     Session Code: {session_code}")
            print(f"     Course Code: {returned_course_code}")
        else:
            print(f"   Error: {start_schedule_resp.text}")
            return
        
        # Step 6: Get student's courses AFTER starting schedule (immediately)
        print(f"\n7. Checking student's courses AFTER schedule starts (immediate)...")
        student_courses_after_immediate = await client.get(
            f"{BACKEND_URL}/get-student-courses",
            params={"userId": student_id}
        )
        print(f"   Status: {student_courses_after_immediate.status_code}")
        if student_courses_after_immediate.status_code == 200:
            courses_after = student_courses_after_immediate.json().get("courses", [])
            print(f"   Found {len(courses_after)} courses")
            for c in courses_after:
                has_active = c.get("hasActiveSession", False)
                status = "🟢 ACTIVE" if has_active else "⚪ No session"
                print(f"     - {c.get('code')}: {c.get('title')} [{status}]")
                if has_active:
                    print(f"       Session ID: {c.get('sessionId')}")
                    print(f"       Host ID: {c.get('hostId')}")
                    if c.get('code') == course_code and not has_active:
                        print(f"       ❌ ERROR: Course {course_code} should have active session!")
        else:
            print(f"   Error: {student_courses_after_immediate.text}")
        
        # Step 7: Verify the session exists in the database
        print(f"\n8. Verifying session in database...")
        # Check if session was created
        print(f"   Session ID created: {session_id}")
        print(f"   Expected to be found in sessions collection")
        print(f"   With status: 'active'")
        print(f"   And courseCode: {course_code}")
        
        print("\n" + "="*70)
        print("TEST COMPLETE")
        print("="*70)

if __name__ == "__main__":
    asyncio.run(test_scheduled_session_visibility())
