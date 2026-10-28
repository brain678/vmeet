from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import JSONResponse
from pymongo.errors import DuplicateKeyError
from datetime import datetime, timezone
from bson import ObjectId
import logging

from database import db

logger = logging.getLogger(__name__)
router = APIRouter()

# ===========================
# DEPARTMENTS ROUTES
# ===========================

@router.post("/departments")
async def create_department(request: Request):
    """Create a new department"""
    try:
        data = await request.json()
        
        # Validate required fields
        name = data.get("name", "").strip()
        code = data.get("code", "").strip().upper()
        
        if not name or not code:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Department name and code are required"}
            )
        
        # Check if department already exists
        existing = db.db["departments"].find_one({"code": code})
        if existing:
            return JSONResponse(
                status_code=409,
                content={"status": "error", "message": f"Department with code '{code}' already exists"}
            )
        
        department = {
            "name": name,
            "code": code,
            "description": data.get("description", ""),
            "headOfDepartment": data.get("headOfDepartment", ""),
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        
        result = db.db["departments"].insert_one(department)
        department["_id"] = str(result.inserted_id)
        
        return JSONResponse(
            status_code=201,
            content={"status": "success", "message": "Department created successfully", "data": department}
        )
    
    except Exception as e:
        logger.error(f"Error creating department: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


@router.get("/departments")
async def get_departments(skip: int = Query(0), limit: int = Query(100)):
    """Get all departments with pagination"""
    try:
        departments = list(
            db.db["departments"]
            .find({}, {"_id": 1, "name": 1, "code": 1, "description": 1, "headOfDepartment": 1, "createdAt": 1})
            .skip(skip)
            .limit(limit)
            .sort("createdAt", -1)
        )
        
        # Convert ObjectId to string
        for dept in departments:
            dept["_id"] = str(dept["_id"])
            dept["id"] = dept.pop("_id")
        
        total = db.db["departments"].count_documents({})
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "data": departments,
                "total": total,
                "skip": skip,
                "limit": limit
            }
        )
    
    except Exception as e:
        logger.error(f"Error fetching departments: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


@router.get("/departments/{department_id}")
async def get_department(department_id: str):
    """Get a specific department by ID"""
    try:
        if not ObjectId.is_valid(department_id):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Invalid department ID"}
            )
        
        department = db.db["departments"].find_one({"_id": ObjectId(department_id)})
        
        if not department:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Department not found"}
            )
        
        department["id"] = str(department.pop("_id"))
        
        return JSONResponse(
            status_code=200,
            content={"status": "success", "data": department}
        )
    
    except Exception as e:
        logger.error(f"Error fetching department: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


@router.put("/departments/{department_id}")
async def update_department(department_id: str, request: Request):
    """Update a department"""
    try:
        if not ObjectId.is_valid(department_id):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Invalid department ID"}
            )
        
        data = await request.json()
        
        # Build update dictionary
        update_data = {}
        if "name" in data and data["name"]:
            update_data["name"] = data["name"].strip()
        if "description" in data:
            update_data["description"] = data["description"]
        if "headOfDepartment" in data:
            update_data["headOfDepartment"] = data["headOfDepartment"]
        
        update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        result = db.db["departments"].find_one_and_update(
            {"_id": ObjectId(department_id)},
            {"$set": update_data},
            return_document=True
        )
        
        if not result:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Department not found"}
            )
        
        result["id"] = str(result.pop("_id"))
        
        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": "Department updated successfully", "data": result}
        )
    
    except Exception as e:
        logger.error(f"Error updating department: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


@router.delete("/departments/{department_id}")
async def delete_department(department_id: str):
    """Delete a department"""
    try:
        if not ObjectId.is_valid(department_id):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Invalid department ID"}
            )
        
        # Check if any courses use this department
        course_count = db.db["courses"].count_documents({"departmentId": department_id})
        if course_count > 0:
            return JSONResponse(
                status_code=409,
                content={"status": "error", "message": f"Cannot delete department: {course_count} course(s) depend on it"}
            )
        
        result = db.db["departments"].delete_one({"_id": ObjectId(department_id)})
        
        if result.deleted_count == 0:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Department not found"}
            )
        
        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": "Department deleted successfully"}
        )
    
    except Exception as e:
        logger.error(f"Error deleting department: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


# ===========================
# ACADEMIC LEVELS ROUTES
# ===========================

@router.post("/levels")
async def create_level(request: Request):
    """Create a new academic level"""
    try:
        data = await request.json()
        
        # Validate required fields
        name = data.get("name", "").strip()
        code = data.get("code")
        year_of_study = data.get("yearOfStudy")
        
        if not name or code is None or year_of_study is None:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Name, code, and yearOfStudy are required"}
            )
        
        # Check if level already exists
        existing = db.db["levels"].find_one({"code": int(code)})
        if existing:
            return JSONResponse(
                status_code=409,
                content={"status": "error", "message": f"Level with code {code} already exists"}
            )
        
        level = {
            "name": name,
            "code": int(code),
            "description": data.get("description", ""),
            "yearOfStudy": int(year_of_study),
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        
        result = db.db["levels"].insert_one(level)
        level["_id"] = str(result.inserted_id)
        
        return JSONResponse(
            status_code=201,
            content={"status": "success", "message": "Level created successfully", "data": level}
        )
    
    except Exception as e:
        logger.error(f"Error creating level: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


@router.get("/levels")
async def get_levels(skip: int = Query(0), limit: int = Query(100)):
    """Get all academic levels with pagination"""
    try:
        levels = list(
            db.db["levels"]
            .find({}, {"_id": 1, "name": 1, "code": 1, "description": 1, "yearOfStudy": 1, "createdAt": 1})
            .skip(skip)
            .limit(limit)
            .sort("code", 1)
        )
        
        # Convert ObjectId to string
        for level in levels:
            level["_id"] = str(level["_id"])
            level["id"] = level.pop("_id")
        
        total = db.db["levels"].count_documents({})
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "data": levels,
                "total": total,
                "skip": skip,
                "limit": limit
            }
        )
    
    except Exception as e:
        logger.error(f"Error fetching levels: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


@router.get("/levels/{level_id}")
async def get_level(level_id: str):
    """Get a specific level by ID"""
    try:
        if not ObjectId.is_valid(level_id):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Invalid level ID"}
            )
        
        level = db.db["levels"].find_one({"_id": ObjectId(level_id)})
        
        if not level:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Level not found"}
            )
        
        level["id"] = str(level.pop("_id"))
        
        return JSONResponse(
            status_code=200,
            content={"status": "success", "data": level}
        )
    
    except Exception as e:
        logger.error(f"Error fetching level: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


@router.put("/levels/{level_id}")
async def update_level(level_id: str, request: Request):
    """Update a level"""
    try:
        if not ObjectId.is_valid(level_id):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Invalid level ID"}
            )
        
        data = await request.json()
        
        # Build update dictionary
        update_data = {}
        if "name" in data and data["name"]:
            update_data["name"] = data["name"].strip()
        if "description" in data:
            update_data["description"] = data["description"]
        if "yearOfStudy" in data and data["yearOfStudy"]:
            update_data["yearOfStudy"] = int(data["yearOfStudy"])
        
        update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        result = db.db["levels"].find_one_and_update(
            {"_id": ObjectId(level_id)},
            {"$set": update_data},
            return_document=True
        )
        
        if not result:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Level not found"}
            )
        
        result["id"] = str(result.pop("_id"))
        
        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": "Level updated successfully", "data": result}
        )
    
    except Exception as e:
        logger.error(f"Error updating level: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


@router.delete("/levels/{level_id}")
async def delete_level(level_id: str):
    """Delete a level"""
    try:
        if not ObjectId.is_valid(level_id):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Invalid level ID"}
            )
        
        # Check if any courses use this level
        course_count = db.db["courses"].count_documents({"levelId": level_id})
        if course_count > 0:
            return JSONResponse(
                status_code=409,
                content={"status": "error", "message": f"Cannot delete level: {course_count} course(s) depend on it"}
            )
        
        result = db.db["levels"].delete_one({"_id": ObjectId(level_id)})
        
        if result.deleted_count == 0:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Level not found"}
            )
        
        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": "Level deleted successfully"}
        )
    
    except Exception as e:
        logger.error(f"Error deleting level: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


# ===========================
# COURSES ROUTES
# ===========================

@router.post("/courses")
async def create_course(request: Request):
    """Create a new course"""
    try:
        data = await request.json()
        
        # Validate required fields
        code = data.get("code", "").strip().upper()
        title = data.get("title", "").strip()
        department_id = data.get("departmentId", "").strip()
        level_id = data.get("levelId", "").strip()
        
        if not all([code, title, department_id, level_id]):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Course code, title, department, and level are required"}
            )
        
        # Validate IDs
        if not ObjectId.is_valid(department_id) or not ObjectId.is_valid(level_id):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Invalid department or level ID"}
            )
        
        # Check if department exists
        department = db.db["departments"].find_one({"_id": ObjectId(department_id)})
        if not department:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Department not found"}
            )
        
        # Check if level exists
        level = db.db["levels"].find_one({"_id": ObjectId(level_id)})
        if not level:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Level not found"}
            )
        
        # Check if course code already exists
        existing = db.db["courses"].find_one({"code": code})
        if existing:
            return JSONResponse(
                status_code=409,
                content={"status": "error", "message": f"Course with code '{code}' already exists"}
            )
        
        course = {
            "code": code,
            "title": title,
            "departmentId": department_id,
            "departmentName": department["name"],
            "levelId": level_id,
            "levelCode": level["code"],
            "credits": int(data.get("credits", 3)),
            "description": data.get("description", ""),
            "prerequisites": data.get("prerequisites", []),
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        
        result = db.db["courses"].insert_one(course)
        course["_id"] = str(result.inserted_id)
        
        return JSONResponse(
            status_code=201,
            content={"status": "success", "message": "Course created successfully", "data": course}
        )
    
    except Exception as e:
        logger.error(f"Error creating course: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


@router.get("/courses")
async def get_courses(
    skip: int = Query(0),
    limit: int = Query(100),
    department_id: str = Query(None),
    level_id: str = Query(None),
    search: str = Query(None)
):
    """Get all courses with optional filtering and pagination"""
    try:
        # Build query filter
        query = {}
        
        if department_id:
            if not ObjectId.is_valid(department_id):
                return JSONResponse(
                    status_code=400,
                    content={"status": "error", "message": "Invalid department ID"}
                )
            query["departmentId"] = department_id
        
        if level_id:
            if not ObjectId.is_valid(level_id):
                return JSONResponse(
                    status_code=400,
                    content={"status": "error", "message": "Invalid level ID"}
                )
            query["levelId"] = level_id
        
        if search:
            query["$or"] = [
                {"code": {"$regex": search, "$options": "i"}},
                {"title": {"$regex": search, "$options": "i"}}
            ]
        
        courses = list(
            db.db["courses"]
            .find(query, {
                "_id": 1, "code": 1, "title": 1, "departmentId": 1, "departmentName": 1,
                "levelId": 1, "levelCode": 1, "credits": 1, "createdAt": 1
            })
            .skip(skip)
            .limit(limit)
            .sort("code", 1)
        )
        
        # Convert ObjectId to string
        for course in courses:
            course["_id"] = str(course["_id"])
            if "departmentId" in course and isinstance(course["departmentId"], ObjectId):
                course["departmentId"] = str(course["departmentId"])
            if "levelId" in course and isinstance(course["levelId"], ObjectId):
                course["levelId"] = str(course["levelId"])
        
        total = db.db["courses"].count_documents(query)
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "data": courses,
                "total": total,
                "skip": skip,
                "limit": limit
            }
        )
    
    except Exception as e:
        logger.error(f"Error fetching courses: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


@router.get("/courses/{course_id}")
async def get_course(course_id: str):
    """Get a specific course by ID"""
    try:
        if not ObjectId.is_valid(course_id):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Invalid course ID"}
            )
        
        course = db.db["courses"].find_one({"_id": ObjectId(course_id)})
        
        if not course:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Course not found"}
            )
        
        course["id"] = str(course.pop("_id"))
        
        return JSONResponse(
            status_code=200,
            content={"status": "success", "data": course}
        )
    
    except Exception as e:
        logger.error(f"Error fetching course: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


@router.put("/courses/{course_id}")
async def update_course(course_id: str, request: Request):
    """Update a course"""
    try:
        if not ObjectId.is_valid(course_id):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Invalid course ID"}
            )
        
        data = await request.json()
        
        # Build update dictionary
        update_data = {}
        
        if "title" in data and data["title"]:
            update_data["title"] = data["title"].strip()
        
        if "credits" in data:
            update_data["credits"] = int(data["credits"])
        
        if "description" in data:
            update_data["description"] = data["description"]
        
        if "prerequisites" in data:
            update_data["prerequisites"] = data["prerequisites"]
        
        # Handle department change
        if "departmentId" in data and data["departmentId"]:
            dept_id = data["departmentId"]
            if not ObjectId.is_valid(dept_id):
                return JSONResponse(
                    status_code=400,
                    content={"status": "error", "message": "Invalid department ID"}
                )
            department = db.db["departments"].find_one({"_id": ObjectId(dept_id)})
            if not department:
                return JSONResponse(
                    status_code=404,
                    content={"status": "error", "message": "Department not found"}
                )
            update_data["departmentId"] = dept_id
            update_data["departmentName"] = department["name"]
        
        # Handle level change
        if "levelId" in data and data["levelId"]:
            lvl_id = data["levelId"]
            if not ObjectId.is_valid(lvl_id):
                return JSONResponse(
                    status_code=400,
                    content={"status": "error", "message": "Invalid level ID"}
                )
            level = db.db["levels"].find_one({"_id": ObjectId(lvl_id)})
            if not level:
                return JSONResponse(
                    status_code=404,
                    content={"status": "error", "message": "Level not found"}
                )
            update_data["levelId"] = lvl_id
            update_data["levelCode"] = level["code"]
        
        update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        result = db.db["courses"].find_one_and_update(
            {"_id": ObjectId(course_id)},
            {"$set": update_data},
            return_document=True
        )
        
        if not result:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Course not found"}
            )
        
        result["id"] = str(result.pop("_id"))
        
        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": "Course updated successfully", "data": result}
        )
    
    except Exception as e:
        logger.error(f"Error updating course: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


@router.delete("/courses/{course_id}")
async def delete_course(course_id: str):
    """Delete a course"""
    try:
        if not ObjectId.is_valid(course_id):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Invalid course ID"}
            )
        
        result = db.db["courses"].delete_one({"_id": ObjectId(course_id)})
        
        if result.deleted_count == 0:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Course not found"}
            )
        
        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": "Course deleted successfully"}
        )
    
    except Exception as e:
        logger.error(f"Error deleting course: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


# ===========================
# BULK OPERATIONS
# ===========================

@router.get("/stats/courses")
async def get_course_stats():
    """Get course statistics"""
    try:
        total_courses = db.db["courses"].count_documents({})
        total_departments = db.db["departments"].count_documents({})
        total_levels = db.db["levels"].count_documents({})
        
        # Courses by department
        courses_by_dept = list(
            db.db["courses"].aggregate([
                {"$group": {"_id": "$departmentName", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}
            ])
        )
        
        # Courses by level
        courses_by_level = list(
            db.db["courses"].aggregate([
                {"$group": {"_id": "$levelCode", "count": {"$sum": 1}}},
                {"$sort": {"_id": 1}}
            ])
        )
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "data": {
                    "totalCourses": total_courses,
                    "totalDepartments": total_departments,
                    "totalLevels": total_levels,
                    "coursesByDepartment": courses_by_dept,
                    "coursesByLevel": courses_by_level
                }
            }
        )
    
    except Exception as e:
        logger.error(f"Error fetching stats: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )


@router.post("/courses/bulk-upload")
async def bulk_upload_courses(request: Request):
    """Bulk upload multiple courses"""
    try:
        data = await request.json()
        courses_data = data.get("courses", [])
        
        if not isinstance(courses_data, list) or len(courses_data) == 0:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "courses array is required and must not be empty"}
            )
        
        # Find or get the department and level IDs
        department_code = data.get("departmentCode", "CSC").upper()
        level = data.get("level", 100)  # Default to 100 level
        
        # Get department by code
        department = db.db["departments"].find_one({"code": department_code})
        if not department:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": f"Department with code '{department_code}' not found"}
            )
        
        # Get level by code (100, 200, 300, 400)
        level_obj = db.db["levels"].find_one({"code": level})
        if not level_obj:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": f"Level {level} not found"}
            )
        
        department_id = str(department["_id"])
        level_id = str(level_obj["_id"])
        
        inserted_count = 0
        skipped_count = 0
        errors = []
        
        for course_data in courses_data:
            try:
                code = course_data.get("code", "").strip().upper()
                title = course_data.get("title", "").strip()
                
                if not code or not title:
                    skipped_count += 1
                    errors.append(f"Skipped: Missing code or title in course {course_data}")
                    continue
                
                # Check if course code already exists
                existing = db.db["courses"].find_one({"code": code})
                if existing:
                    skipped_count += 1
                    errors.append(f"Skipped: Course with code '{code}' already exists")
                    continue
                
                # Create the course
                course = {
                    "code": code,
                    "title": title,
                    "departmentId": department_id,
                    "departmentName": department["name"],
                    "levelId": level_id,
                    "levelCode": level_obj["code"],
                    "credits": int(course_data.get("credits", 3)),
                    "description": course_data.get("description", ""),
                    "prerequisites": course_data.get("prerequisites", []),
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
                
                result = db.db["courses"].insert_one(course)
                inserted_count += 1
                logger.info(f"Created course: {code} - {title}")
                
            except Exception as e:
                errors.append(f"Error creating course {course_data.get('code', 'Unknown')}: {str(e)}")
                logger.error(f"Error creating course: {str(e)}")
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": f"Bulk upload completed: {inserted_count} courses created, {skipped_count} skipped",
                "inserted": inserted_count,
                "skipped": skipped_count,
                "errors": errors if errors else None
            }
        )
        
    except Exception as e:
        logger.error(f"Error in bulk upload: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Error in bulk upload: {str(e)}"}
        )

