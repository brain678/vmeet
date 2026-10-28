#!/usr/bin/env python3
"""
Script to upload CSC (Computer Science) courses in bulk to the backend
"""

import json
import requests
import sys

# Backend API endpoint
BACKEND_URL = "http://localhost:8000"
BULK_UPLOAD_ENDPOINT = f"{BACKEND_URL}/courses/bulk-upload"

def load_courses_from_file(filepath):
    """Load courses from JSON file"""
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
        return data
    except FileNotFoundError:
        print(f"Error: File '{filepath}' not found")
        return None
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in '{filepath}'")
        return None

def upload_courses(courses_data):
    """Upload courses in bulk by level"""
    
    # Group courses by level
    courses_by_level = {}
    for course in courses_data:
        level = course.get("level")
        if level not in courses_by_level:
            courses_by_level[level] = []
        courses_by_level[level].append(course)
    
    total_inserted = 0
    total_skipped = 0
    
    # Upload each level separately
    for level in sorted(courses_by_level.keys(), key=lambda x: int(x)):
        level_courses = courses_by_level[level]
        
        print(f"\n{'='*70}")
        print(f"Uploading {len(level_courses)} courses for Level {level}")
        print(f"{'='*70}")
        
        # Prepare payload
        payload = {
            "courses": level_courses,
            "departmentCode": "CSC",
            "level": int(level)
        }
        
        try:
            response = requests.post(
                BULK_UPLOAD_ENDPOINT,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                result = response.json()
                inserted = result.get("inserted", 0)
                skipped = result.get("skipped", 0)
                
                print(f"✓ Success!")
                print(f"  Inserted: {inserted}")
                print(f"  Skipped: {skipped}")
                print(f"  Message: {result.get('message', 'N/A')}")
                
                if result.get("errors"):
                    print(f"\n  Errors/Warnings:")
                    for error in result["errors"][:5]:  # Show first 5 errors
                        print(f"    - {error}")
                    if len(result["errors"]) > 5:
                        print(f"    ... and {len(result['errors']) - 5} more")
                
                total_inserted += inserted
                total_skipped += skipped
            else:
                print(f"✗ Failed with status {response.status_code}")
                print(f"  Response: {response.json()}")
                return False
                
        except requests.exceptions.ConnectionError:
            print(f"✗ Error: Cannot connect to backend at {BACKEND_URL}")
            print("  Make sure the backend is running (uvicorn main:app --reload)")
            return False
        except Exception as e:
            print(f"✗ Error: {str(e)}")
            return False
    
    # Summary
    print(f"\n{'='*70}")
    print(f"UPLOAD SUMMARY")
    print(f"{'='*70}")
    print(f"Total Inserted: {total_inserted}")
    print(f"Total Skipped: {total_skipped}")
    print(f"Total Processed: {total_inserted + total_skipped}")
    
    return True

def main():
    """Main function"""
    
    # Load courses from JSON file
    courses_data = load_courses_from_file("csc_courses.json")
    if not courses_data:
        sys.exit(1)
    
    print("CSC Courses Bulk Upload Tool")
    print("=" * 70)
    print(f"Loaded {len(courses_data)} courses from csc_courses.json")
    
    # Confirm before uploading
    response = input(f"\nProceed with uploading {len(courses_data)} courses? (yes/no): ").strip().lower()
    if response != 'yes':
        print("Upload cancelled.")
        sys.exit(0)
    
    # Upload courses
    success = upload_courses(courses_data)
    
    if success:
        print("\n✓ Bulk upload completed successfully!")
        sys.exit(0)
    else:
        print("\n✗ Bulk upload failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
