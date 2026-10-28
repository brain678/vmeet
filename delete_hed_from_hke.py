#!/usr/bin/env python3
"""
Script to delete HED (Health Education) courses from Department of Human Kinetics and Sport Science
"""

import requests
import sys

# Backend API endpoints
BACKEND_URL = "http://localhost:8000"
GET_COURSES_ENDPOINT = f"{BACKEND_URL}/courses"
DELETE_COURSE_ENDPOINT = f"{BACKEND_URL}/courses"

# Courses to delete (all HED codes)
COURSES_TO_DELETE = [
    "HED111", "HED121", "HED122", "HED123", "HED124",
    "HED211", "HED212", "HED213", "HED214", "HED215", "HED221", "HED222", "HED223", "HED224", "HED225", "HED226",
    "HED311", "HED312", "HED313", "HED314", "HED315", "HED316", "HED317", "HED318",
    "HED321", "HED322", "HED323", "HED324", "HED325", "HED326",
    "HED421", "HED422", "HED423", "HED424", "HED425", "HED426", "HED429"
]

def find_courses_by_code():
    """Find all HED courses in the database"""
    try:
        # Get all courses - we'll filter client-side
        response = requests.get(f"{GET_COURSES_ENDPOINT}?limit=1000")
        response.raise_for_status()
        data = response.json()
        
        courses = data.get("data", [])
        hed_courses = []
        
        for course in courses:
            if course.get("code") in COURSES_TO_DELETE:
                hed_courses.append(course)
        
        return hed_courses
    except Exception as e:
        print(f"Error fetching courses: {e}")
        return []

def delete_course(course_id):
    """Delete a single course by ID"""
    try:
        response = requests.delete(
            f"{DELETE_COURSE_ENDPOINT}/{course_id}",
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            return True, response.json().get("message", "Deleted")
        else:
            return False, response.json().get("message", "Unknown error")
    except Exception as e:
        return False, str(e)

def main():
    """Main function"""
    
    print("HED Courses Deletion Tool")
    print("=" * 70)
    print(f"Department: Human Kinetics and Sport Science")
    print(f"Courses to delete: {len(COURSES_TO_DELETE)} HED course codes")
    
    # Find HED courses
    print("\nSearching for HED courses in database...")
    hed_courses = find_courses_by_code()
    
    if not hed_courses:
        print("✗ No HED courses found in the database.")
        sys.exit(0)
    
    print(f"✓ Found {len(hed_courses)} HED courses:")
    print("=" * 70)
    for course in hed_courses:
        print(f"  {course.get('code'):10} {course.get('title')}")
    
    # Confirm before deleting
    response = input(f"\n\nProceed with deleting {len(hed_courses)} courses? (yes/no): ").strip().lower()
    if response != 'yes':
        print("Deletion cancelled.")
        sys.exit(0)
    
    # Delete courses
    print("\n" + "=" * 70)
    print("Deleting courses...")
    print("=" * 70)
    
    deleted = 0
    failed = 0
    
    for course in hed_courses:
        course_id = course.get("_id")
        course_code = course.get("code")
        course_title = course.get("title")
        
        success, message = delete_course(course_id)
        
        if success:
            print(f"✓ Deleted: {course_code:10} {course_title}")
            deleted += 1
        else:
            print(f"✗ Failed:  {course_code:10} {course_title}")
            print(f"  Error: {message}")
            failed += 1
    
    # Summary
    print("\n" + "=" * 70)
    print("DELETION SUMMARY")
    print("=" * 70)
    print(f"Successfully deleted: {deleted}")
    print(f"Failed to delete: {failed}")
    print(f"Total processed: {deleted + failed}")
    
    if deleted == len(hed_courses):
        print("\n✓ All HED courses have been deleted successfully!")
        sys.exit(0)
    else:
        print("\n⚠ Some courses failed to delete. Please review the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
