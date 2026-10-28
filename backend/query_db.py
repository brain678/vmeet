"""
Query database to find existing lecturers for testing
"""
from database import db

print("\n=== DATABASE QUERY: LECTURERS ===\n")

lecturers = list(db.users.find({'role': 'lecturer'}).limit(10))
print(f"Found {len(lecturers)} lecturers:\n")

for lecturer in lecturers:
    user_id = lecturer.get('userId', 'unknown')
    name = lecturer.get('name', 'unknown')
    courses = lecturer.get('courses', [])
    email = lecturer.get('email', 'unknown')
    
    print(f"ID: {user_id}")
    print(f"Name: {name}")
    print(f"Email: {email}")
    print(f"Courses: {len(courses)} course(s)")
    if courses:
        # Try to show course codes
        course_codes = []
        for course_id in courses[:3]:
            try:
                from bson import ObjectId
                course = db.courses.find_one({"_id": ObjectId(course_id)})
                if course:
                    course_codes.append(course.get('code', 'unknown'))
            except:
                pass
        if course_codes:
            print(f"  - {', '.join(course_codes)}")
            if len(courses) > 3:
                print(f"  - ... and {len(courses)-3} more")
    print()

if not lecturers:
    print("❌ No lecturers found in database")
    print("\nTo test auto-completion, you need to:")
    print("1. Register as a lecturer in the app")
    print("2. Assign yourself to a course")
    print("3. Then run the auto-completion test")
    print("\nOr manually create a test lecturer in MongoDB:")
    print("""
    db.users.insertOne({
        userId: "test-lecturer-001",
        name: "Test Lecturer",
        email: "test@example.com",
        role: "lecturer",
        courses: [ObjectId("...")]  // Add a course ObjectId
    })
    """)

print("\n=== DATABASE QUERY: COURSES ===\n")

courses = list(db.courses.find({}).limit(5))
print(f"Found {len(courses)} courses (showing first 5):\n")

for course in courses:
    print(f"Code: {course.get('code', 'unknown')}")
    print(f"Title: {course.get('title', 'unknown')}")
    print(f"ID: {course.get('_id', 'unknown')}")
    print()
