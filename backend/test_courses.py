from database import db
from bson import ObjectId

# Find a lecturer with courses
lecturer = db.users.find_one({'role': 'lecturer', 'courses': {'$exists': True}})
if lecturer:
    print('Lecturer found:', lecturer.get('name'))
    print('User ID:', lecturer.get('userId'))
    course_ids = lecturer.get('courses', [])
    print('Course IDs stored:', course_ids)
    print()
    
    # Fetch course details
    courses_list = []
    for course_id in course_ids:
        try:
            obj_id = ObjectId(course_id) if isinstance(course_id, str) else course_id
            course = db.courses.find_one({"_id": obj_id})
            if course:
                course_data = {
                    "code": course.get("code", ""),
                    "title": course.get("title", ""),
                    "id": str(course.get("_id", ""))
                }
                courses_list.append(course_data)
                print(f"Course found: {course_data}")
        except Exception as e:
            print(f"Error fetching course {course_id}: {str(e)}")
    
    print()
    print('Final formatted courses:', courses_list)
else:
    print('No lecturer found')
