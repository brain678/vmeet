from database import db
from bson import ObjectId

course_ids = ["693409df8cbfdb968d6dfcc7", "69340a018cbfdb968d6dfcc8", "693409858cbfdb968d6dfcc6"]

print("Checking if student's course IDs exist in database...\n")

for cid in course_ids:
    try:
        obj_id = ObjectId(cid)
        course = db.courses.find_one({"_id": obj_id})
        if course:
            print(f"✓ Found: {cid}")
            print(f"  Code: {course.get('code')}")
            print(f"  Title: {course.get('title')}\n")
        else:
            print(f"✗ NOT FOUND: {cid}\n")
    except Exception as e:
        print(f"✗ ERROR for {cid}: {str(e)}\n")

print(f"Total courses in DB: {db.courses.count_documents({})}")

# Also check all courses to see what's available
print("\nAll courses in database:")
all_courses = list(db.courses.find().limit(10))
for course in all_courses:
    print(f"  {course.get('_id')} -> {course.get('code')} - {course.get('title')}")
