"""
Find existing lecturers and courses to use for testing auto-completion.
This helps identify what data is available in your database.
"""

import requests
import json
from datetime import datetime, timedelta, timezone

BACKEND_URL = "http://localhost:8000"

def get_nigeria_time():
    """Get current time in Nigeria timezone"""
    return datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=1)))

def find_available_lecturers():
    """Try to find existing lecturers in the system"""
    print("\n" + "="*70)
    print("FINDING AVAILABLE TEST DATA")
    print("="*70)
    
    print("\n1. Searching for lecturers...")
    
    # Try common endpoints to find lecturers
    endpoints_to_try = [
        f"{BACKEND_URL}/get-all-lecturers",
        f"{BACKEND_URL}/api/lecturers",
        f"{BACKEND_URL}/lecturers",
    ]
    
    lecturers = []
    for endpoint in endpoints_to_try:
        try:
            response = requests.get(endpoint)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    lecturers = data
                    break
                elif isinstance(data, dict) and 'data' in data:
                    lecturers = data['data']
                    break
        except:
            continue
    
    if lecturers:
        print(f"✅ Found {len(lecturers)} lecturer(s)")
        for i, lecturer in enumerate(lecturers[:3], 1):
            print(f"   {i}. {lecturer.get('name', 'Unknown')} (ID: {lecturer.get('userId', 'unknown')})")
            if i == 3:
                print("   ...")
                break
    else:
        print("❌ No lecturers found via API")
        print("   Try checking directly in MongoDB:")
        print("   db.users.find({role: 'lecturer'}).limit(5)")
    
    return lecturers

def find_available_courses():
    """Try to find existing courses in the system"""
    print("\n2. Searching for courses...")
    
    endpoints_to_try = [
        f"{BACKEND_URL}/get-all-courses",
        f"{BACKEND_URL}/api/courses",
        f"{BACKEND_URL}/courses",
    ]
    
    courses = []
    for endpoint in endpoints_to_try:
        try:
            response = requests.get(endpoint)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    courses = data
                    break
                elif isinstance(data, dict) and 'data' in data:
                    courses = data['data']
                    break
        except:
            continue
    
    if courses:
        print(f"✅ Found {len(courses)} course(s)")
        for i, course in enumerate(courses[:3], 1):
            print(f"   {i}. {course.get('code', 'Unknown')} - {course.get('title', 'Unknown')}")
            if i == 3:
                print("   ...")
                break
    else:
        print("❌ No courses found via API")
        print("   Try checking directly in MongoDB:")
        print("   db.courses.find({}).limit(5)")
    
    return courses

def test_with_sample_data():
    """Create a simple test schedule if we can find valid lecturer/course"""
    print("\n3. Attempting to create test schedule...")
    
    # Try to get any lecturer and course
    # This is a simplified approach - in real scenario you'd pick specific ones
    
    lecturers = find_available_lecturers()
    courses = find_available_courses()
    
    if not lecturers or not courses:
        print("\n⚠️  Cannot create test schedule without lecturer and course")
        return
    
    lecturer_id = lecturers[0].get('userId')
    course_code = courses[0].get('code')
    
    print(f"\n   Using Lecturer: {lecturer_id}")
    print(f"   Using Course: {course_code}")
    
    # Check if lecturer teaches this course
    # This is a simplified check
    lecturer_courses = lecturers[0].get('courses', [])
    print(f"   Lecturer courses: {lecturer_courses}")
    
    # Schedule for 2 minutes in the future with 1-minute limit
    nigeria_time = get_nigeria_time()
    scheduled_time = nigeria_time + timedelta(minutes=2)
    
    schedule_data = {
        "lecturerId": lecturer_id,
        "courseCode": course_code,
        "scheduledDate": scheduled_time.strftime("%Y-%m-%d"),
        "scheduledTime": scheduled_time.strftime("%H:%M"),
        "timeLimit": 1,  # 1 minute for quick test
        "description": "Auto-completion test",
        "latitude": 6.5244,
        "longitude": 3.3792,
    }
    
    print(f"\n   Creating schedule with:")
    print(f"     - Lecturer: {lecturer_id}")
    print(f"     - Course: {course_code}")
    print(f"     - Time: {scheduled_time.strftime('%H:%M')} (in 2 minutes)")
    print(f"     - Time Limit: 1 minute")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/schedule-attendance",
            json=schedule_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\n   Response Status: {response.status_code}")
        data = response.json()
        
        if response.status_code == 200 and data.get("status") == "success":
            schedule_id = data["data"]["scheduleId"]
            print(f"   ✅ Schedule created: {schedule_id}")
            print(f"\n   Now the auto-completion scheduler will:")
            print(f"     1. Start the session at {scheduled_time.strftime('%H:%M')} (in ~2min)")
            print(f"     2. End the session 1 minute later (in ~3min)")
            print(f"     3. Update schedule status to 'completed'")
            print(f"\n   Check backend logs for '[AUTO-COMPLETE]' messages")
        else:
            print(f"   ❌ Failed: {data.get('detail', 'Unknown error')}")
            print(f"   Full Response: {json.dumps(data, indent=2)}")
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")

def main():
    print("\n" + "="*70)
    print("AUTO-COMPLETION TEST DATA FINDER")
    print("="*70)
    print(f"Backend URL: {BACKEND_URL}")
    
    find_available_lecturers()
    find_available_courses()
    test_with_sample_data()
    
    print("\n" + "="*70)
    print("NEXT STEPS")
    print("="*70)
    print("""
If you have a real lecturer/course:
    1. Update LECTURER_ID in test_auto_completion.py
    2. Update COURSE_CODE in test_auto_completion.py
    3. Run: python test_auto_completion.py
    
If no data exists, create sample data:
    1. Register as lecturer via the app
    2. Create/enroll in courses
    3. Then run the auto-completion test
    
To verify auto-completion is working:
    1. Check backend logs for '[AUTO-COMPLETE]' messages
    2. Query database: db.sessions.findOne({...})
    3. Verify session.status = 'ended' and session.autoCompleted = true
    """)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
