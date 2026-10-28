import asyncio
import json
from fastapi import Request
from routes.attendance import get_student_courses
from database import db

async def test_get_student_courses():
    """Test the get_student_courses endpoint"""
    
    # Get a student with courses from the database
    student = db.users.find_one({"role": "student", "courses": {"$exists": True, "$ne": []}})
    
    if not student:
        print("❌ No student with courses found in database")
        return
    
    user_id = student.get("userId")
    student_name = student.get("name")
    course_ids = student.get("courses", [])
    
    print(f"\n=== Testing /get-student-courses endpoint ===")
    print(f"Student: {student_name} ({user_id})")
    print(f"Registered Course IDs: {course_ids}\n")
    
    # Call the endpoint
    try:
        result = await get_student_courses(user_id)
        
        print("✅ API Response:")
        print(json.dumps(result, indent=2, default=str))
        
        # Validate response
        if result.get("status") == "success":
            courses = result.get("courses", [])
            print(f"\n✅ API returned {len(courses)} courses")
            
            if len(courses) == 0:
                print("⚠️  WARNING: API returned empty courses array!")
                print("   This would cause 'You haven't registered for any courses' message")
            else:
                print("\n✅ Courses returned:")
                for course in courses:
                    print(f"   - {course.get('code')}: {course.get('title')}")
                    print(f"     Active Session: {course.get('hasActiveSession')}")
        else:
            print(f"❌ API returned error status: {result.get('status')}")
    
    except Exception as e:
        print(f"❌ Error calling endpoint: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_get_student_courses())
