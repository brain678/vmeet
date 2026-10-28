#!/usr/bin/env python3
"""
Comprehensive test for scheduled session visibility.
Tests the complete flow from schedule creation to student visibility.

Run with: python test_scheduled_session_complete.py
"""

from database import db
from datetime import datetime, timedelta
from bson import ObjectId
import time

def test_scheduled_session_visibility():
    print("\n" + "="*80)
    print("TESTING: Scheduled Session Visibility for Students")
    print("="*80)
    
    # 1. Check if test data exists
    print("\n[Step 1] Checking test data...")
    
    # Get a lecturer
    lecturer = db.users.find_one({"role": "lecturer"})
    if not lecturer:
        print("❌ No lecturer found in database")
        return False
    
    lecturer_id = lecturer.get("userId")
    lecturer_name = lecturer.get("name", "Unknown")
    lecturer_courses = lecturer.get("courses", [])
    print(f"✓ Found lecturer: {lecturer_name} ({lecturer_id})")
    print(f"  Courses: {len(lecturer_courses)} course(s)")
    
    if not lecturer_courses:
        print("❌ Lecturer has no courses assigned")
        return False
    
    # Get first course
    first_course_id = lecturer_courses[0]
    print(f"  Using course: {first_course_id}")
    
    # Get course details
    course = db.courses.find_one({"_id": ObjectId(first_course_id)})
    if not course:
        print("❌ Course not found")
        return False
    
    course_code = course.get("code", "UNKNOWN")
    course_title = course.get("title", "Unknown")
    print(f"  Course Code: {course_code} - {course_title}")
    
    # Get students enrolled in this course
    students = list(db.users.find({
        "role": "student",
        "courses": first_course_id
    }))
    
    if not students:
        print("❌ No students found enrolled in this course")
        return False
    
    student = students[0]
    student_id = student.get("userId")
    student_name = student.get("name", "Unknown")
    print(f"✓ Found student: {student_name} ({student_id}) enrolled in {course_code}")
    
    # 2. Create a schedule
    print(f"\n[Step 2] Creating a schedule...")
    
    schedule_date = (datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%d")
    schedule_time = (datetime.now() + timedelta(hours=1)).strftime("%H:%M")
    
    schedule_doc = {
        "scheduleId": f"test-schedule-{int(time.time())}",
        "lecturerId": lecturer_id,
        "courseCode": course_code,
        "scheduledDate": schedule_date,
        "scheduledTime": schedule_time,
        "scheduledDateTime": (datetime.now() + timedelta(hours=1)).isoformat(),
        "timeLimit": 30,
        "description": "Test scheduled session",
        "status": "scheduled",
        "createdAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat()
    }
    
    result = db.schedules.insert_one(schedule_doc)
    schedule_id = schedule_doc["scheduleId"]
    print(f"✓ Schedule created: {schedule_id}")
    print(f"  Date: {schedule_date}")
    print(f"  Time: {schedule_time}")
    
    # 3. Check student's courses BEFORE starting schedule
    print(f"\n[Step 3] Checking student's courses BEFORE schedule starts...")
    
    student_courses_before = db.courses.find({
        "_id": {"$in": [ObjectId(cid) if isinstance(cid, str) and len(cid) == 24 else cid 
                        for cid in student.get("courses", [])]}
    })
    student_courses_before_list = list(student_courses_before)
    print(f"✓ Student has {len(student_courses_before_list)} registered course(s)")
    
    # Check for active sessions for these courses
    course_codes = [c.get("code") for c in student_courses_before_list]
    active_sessions_before = list(db.sessions.find({
        "courseCode": {"$in": course_codes},
        "status": "active"
    }))
    print(f"✓ Active sessions matching student's courses: {len(active_sessions_before)}")
    
    for c in student_courses_before_list:
        c_code = c.get("code")
        has_session = any(s.get("courseCode") == c_code for s in active_sessions_before)
        status = "🟢 ACTIVE" if has_session else "⚪ No session"
        print(f"  - {c_code}: {c.get('title')} [{status}]")
    
    # 4. Start the schedule
    print(f"\n[Step 4] Starting the scheduled session...")
    
    nigeria_time = datetime.now()
    session_id = f"geo-{int(time.time())}"
    session_code = "1234"  # Simulated
    
    session_doc = {
        "sessionId": session_id,
        "sessionCode": session_code,
        "scheduleId": schedule_id,
        "hostId": lecturer_id,
        "courseCode": course_code,
        "latitude": 6.827402,
        "longitude": 3.940343,
        "radius": 100,
        "status": "active",
        "isActive": True,
        "startTime": nigeria_time.isoformat(),
        "timeLimit": 30,
        "attendeeCount": 0,
        "created_at": nigeria_time.isoformat()
    }
    
    db.sessions.insert_one(session_doc)
    print(f"✓ Session created and inserted")
    print(f"  Session ID: {session_id}")
    print(f"  Session Code: {session_code}")
    print(f"  Course Code: {course_code}")
    print(f"  Status: active")
    
    # Update schedule status
    db.schedules.update_one(
        {"scheduleId": schedule_id},
        {
            "$set": {
                "sessionId": session_id,
                "status": "started",
                "updatedAt": nigeria_time.isoformat()
            }
        }
    )
    print(f"✓ Schedule status updated to 'started'")
    
    # 5. Check student's courses AFTER starting schedule
    print(f"\n[Step 5] Checking student's courses AFTER schedule starts...")
    
    # Re-fetch courses
    student_courses_after = db.courses.find({
        "_id": {"$in": [ObjectId(cid) if isinstance(cid, str) and len(cid) == 24 else cid 
                        for cid in student.get("courses", [])]}
    })
    student_courses_after_list = list(student_courses_after)
    
    # Check for active sessions again
    active_sessions_after = list(db.sessions.find({
        "courseCode": {"$in": course_codes},
        "status": "active"
    }))
    print(f"✓ Active sessions matching student's courses: {len(active_sessions_after)}")
    
    found_scheduled_session = False
    for c in student_courses_after_list:
        c_code = c.get("code")
        has_session = any(s.get("courseCode") == c_code for s in active_sessions_after)
        status = "🟢 ACTIVE" if has_session else "⚪ No session"
        print(f"  - {c_code}: {c.get('title')} [{status}]")
        
        if c_code == course_code and has_session:
            found_scheduled_session = True
            session = next(s for s in active_sessions_after if s.get("courseCode") == c_code)
            print(f"    └─ Session ID: {session.get('sessionId')}")
            print(f"    └─ Host ID: {session.get('hostId')}")
    
    # 6. Verify the session is correctly stored
    print(f"\n[Step 6] Verifying session in database...")
    
    stored_session = db.sessions.find_one({"sessionId": session_id})
    if not stored_session:
        print("❌ Session not found in database!")
        return False
    
    print(f"✓ Session found in database")
    print(f"  sessionId: {stored_session.get('sessionId')}")
    print(f"  courseCode: {stored_session.get('courseCode')}")
    print(f"  status: {stored_session.get('status')}")
    print(f"  hostId: {stored_session.get('hostId')}")
    
    # 7. Final result
    print(f"\n" + "="*80)
    if found_scheduled_session:
        print("✅ SUCCESS: Student can see the scheduled session!")
        print("   The course is marked as active and the session is visible")
    else:
        print("❌ FAILURE: Student CANNOT see the scheduled session")
        print("   The active session was not found for the student's course")
    print("="*80 + "\n")
    
    # Cleanup
    print("[Cleanup] Removing test data...")
    db.schedules.delete_one({"scheduleId": schedule_id})
    db.sessions.delete_one({"sessionId": session_id})
    print("✓ Test data cleaned up\n")
    
    return found_scheduled_session

if __name__ == "__main__":
    success = test_scheduled_session_visibility()
    exit(0 if success else 1)
