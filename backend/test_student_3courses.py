import asyncio
import json
from routes.attendance import get_student_courses
from database import db

async def test_specific_student():
    """Test with the specific student who has 3 courses"""
    
    # Test with the student we know has 3 courses
    user_id = "user_36TMm4B5qvMrCpJQreFFmOlsj68"
    
    student = db.users.find_one({"userId": user_id})
    
    if not student:
        print(f"❌ Student {user_id} not found")
        return
    
    student_name = student.get("name")
    course_ids = student.get("courses", [])
    
    print(f"\n=== Testing specific student with 3 courses ===")
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
    asyncio.run(test_specific_student())
