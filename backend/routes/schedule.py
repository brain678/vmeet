"""
Schedule routes for managing attendance session schedules.
Lecturers can schedule attendance sessions in advance with specific dates/times.
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timedelta, timezone
from database import db
import logging
import time
import json
from typing import Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

class ScheduleSession(BaseModel):
    lecturerId: str
    courseCode: str
    scheduledDate: str  # ISO format: 2025-12-07
    scheduledTime: str  # 24-hour format: 14:30
    timeLimit: Optional[int] = None  # in minutes
    description: Optional[str] = None
    latitude: Optional[float] = None  # Lecturer's location for auto-start
    longitude: Optional[float] = None  # Lecturer's location for auto-start

class ScheduleUpdate(BaseModel):
    scheduleId: str
    scheduledDate: Optional[str] = None
    scheduledTime: Optional[str] = None
    timeLimit: Optional[int] = None
    description: Optional[str] = None
    courseCode: Optional[str] = None

def get_nigeria_time():
    """Get current time in Nigeria timezone (UTC+1)"""
    return datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))

@router.post("/schedule-attendance")
async def schedule_attendance(schedule_data: ScheduleSession):
    """
    Schedule an attendance session for a future date/time.
    Lecturer can set a specific time and optional time limit.
    """
    try:
        # Validate inputs
        if not all([schedule_data.lecturerId, schedule_data.courseCode, 
                    schedule_data.scheduledDate, schedule_data.scheduledTime]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Verify lecturer exists
        lecturer = db.users.find_one({"userId": schedule_data.lecturerId})
        if not lecturer:
            raise HTTPException(status_code=404, detail="Lecturer not found")
        
        # Verify lecturer owns this course
        # Get course IDs from lecturer
        course_ids = lecturer.get("courses", [])
        
        # Check if any of the lecturer's courses match the requested courseCode
        course_found = False
        for course_id in course_ids:
            try:
                from bson import ObjectId
                # Convert string ID to ObjectId if necessary
                obj_id = ObjectId(course_id) if isinstance(course_id, str) else course_id
                course = db.courses.find_one({"_id": obj_id})
                if course and course.get("code") == schedule_data.courseCode:
                    course_found = True
                    break
            except Exception as e:
                logger.warning(f"Error checking course {course_id}: {str(e)}")
                continue
        
        if not course_found:
            raise HTTPException(status_code=403, detail="Lecturer does not teach this course")
        
        # Parse and validate scheduled date/time
        try:
            scheduled_datetime = datetime.strptime(
                f"{schedule_data.scheduledDate} {schedule_data.scheduledTime}",
                "%Y-%m-%d %H:%M"
            )
            scheduled_datetime = scheduled_datetime.replace(tzinfo=timezone(timedelta(hours=1)))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date/time format")
        
        # Ensure scheduled time is in the future
        nigeria_time = get_nigeria_time()
        if scheduled_datetime <= nigeria_time:
            raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
        
        # Create schedule document
        schedule_id = f"sched-{int(time.time())}"
        schedule_doc = {
            "scheduleId": schedule_id,
            "lecturerId": schedule_data.lecturerId,
            "courseCode": schedule_data.courseCode,
            "scheduledDateTime": scheduled_datetime.isoformat(),
            "scheduledDate": schedule_data.scheduledDate,
            "scheduledTime": schedule_data.scheduledTime,
            "timeLimit": schedule_data.timeLimit,
            "description": schedule_data.description or "",
            "status": "scheduled",  # scheduled, started, completed, cancelled
            "sessionId": None,  # Will be populated when session starts
            "latitude": schedule_data.latitude,  # Store location for auto-start
            "longitude": schedule_data.longitude,  # Store location for auto-start
            "createdAt": nigeria_time.isoformat(),
            "updatedAt": nigeria_time.isoformat(),
            "createdBy": schedule_data.lecturerId
        }
        
        db.schedules.insert_one(schedule_doc)
        
        logger.info(f"Scheduled attendance session: {schedule_id} for {schedule_data.courseCode}")
        
        return {
            "status": "success",
            "message": "Attendance session scheduled successfully",
            "scheduleId": schedule_id,
            "scheduledDateTime": scheduled_datetime.isoformat()
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error scheduling attendance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/lecturer-schedules")
async def get_lecturer_schedules(lecturerId: str):
    """
    Get all scheduled attendance sessions for a lecturer.
    Groups by status: upcoming, started, completed, cancelled
    """
    try:
        if not lecturerId:
            raise HTTPException(status_code=400, detail="Lecturer ID required")
        
        # Verify lecturer exists
        lecturer = db.users.find_one({"userId": lecturerId})
        if not lecturer:
            raise HTTPException(status_code=404, detail="Lecturer not found")
        
        # Get all schedules for this lecturer
        schedules = list(db.schedules.find(
            {"lecturerId": lecturerId}
        ).sort("scheduledDateTime", -1))
        
        # Organize by status
        upcoming = []
        started = []
        completed = []
        cancelled = []
        
        nigeria_time = get_nigeria_time()
        
        for schedule in schedules:
            scheduled_dt = datetime.fromisoformat(schedule["scheduledDateTime"])
            
            # Determine current status
            status = schedule.get("status", "scheduled")
            
            schedule_info = {
                "scheduleId": schedule["scheduleId"],
                "courseCode": schedule["courseCode"],
                "scheduledDate": schedule["scheduledDate"],
                "scheduledTime": schedule["scheduledTime"],
                "timeLimit": schedule.get("timeLimit"),
                "description": schedule.get("description", ""),
                "status": status,
                "sessionId": schedule.get("sessionId"),
                "autoStarted": schedule.get("autoStarted", False),
                "createdAt": schedule["createdAt"],
                "updatedAt": schedule["updatedAt"]
            }
            
            if status == "cancelled":
                cancelled.append(schedule_info)
            elif status == "completed":
                completed.append(schedule_info)
            elif status == "started":
                started.append(schedule_info)
            else:  # scheduled
                if scheduled_dt > nigeria_time:
                    upcoming.append(schedule_info)
                else:
                    # Time has passed but not marked as started/completed
                    schedule_info["status"] = "expired"
                    completed.append(schedule_info)
        
        return {
            "status": "success",
            "schedules": {
                "upcoming": upcoming,
                "started": started,
                "completed": completed,
                "cancelled": cancelled
            }
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error retrieving schedules: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student-schedules")
async def get_student_schedules(studentId: str):
    """Get upcoming scheduled classes for a student based on enrolled courses."""
    try:
        if not studentId:
            raise HTTPException(status_code=400, detail="Student ID required")

        student = db.users.find_one({"userId": studentId})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        from bson import ObjectId

        course_codes = set()
        for course_id in student.get("courses", []):
            try:
                course = db.courses.find_one({"_id": ObjectId(course_id) if isinstance(course_id, str) and len(course_id) == 24 else course_id})
                if course and course.get("code"):
                    course_codes.add(course["code"])
            except Exception as error:
                logger.warning(f"Unable to resolve student course {course_id}: {error}")

        now = get_nigeria_time()
        schedules = list(db.schedules.find({
            "courseCode": {"$in": list(course_codes)},
            "status": "scheduled"
        }).sort("scheduledDateTime", 1))

        upcoming = []
        for schedule in schedules:
            scheduled_dt = datetime.fromisoformat(schedule["scheduledDateTime"])
            if scheduled_dt <= now:
                continue
            upcoming.append({
                "scheduleId": schedule["scheduleId"],
                "courseCode": schedule["courseCode"],
                "scheduledDate": schedule["scheduledDate"],
                "scheduledTime": schedule["scheduledTime"],
                "scheduledDateTime": schedule["scheduledDateTime"],
                "description": schedule.get("description", ""),
                "status": schedule.get("status", "scheduled")
            })

        return {"status": "success", "schedules": upcoming}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error retrieving student schedules: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/schedule-details")
async def get_schedule_details(scheduleId: str):
    """Get detailed information about a scheduled session"""
    try:
        if not scheduleId:
            raise HTTPException(status_code=400, detail="Schedule ID required")
        
        schedule = db.schedules.find_one({"scheduleId": scheduleId})
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Include related session info if session has started
        session_info = None
        if schedule.get("sessionId"):
            session = db.sessions.find_one({"sessionId": schedule["sessionId"]})
            if session:
                session_info = {
                    "sessionId": session["sessionId"],
                    "sessionCode": session.get("sessionCode"),
                    "status": session.get("status"),
                    "startTime": session.get("startTime"),
                    "endTime": session.get("endTime"),
                    "attendeeCount": session.get("attendeeCount", 0)
                }
        
        return {
            "status": "success",
            "schedule": {
                "scheduleId": schedule["scheduleId"],
                "courseCode": schedule["courseCode"],
                "scheduledDate": schedule["scheduledDate"],
                "scheduledTime": schedule["scheduledTime"],
                "timeLimit": schedule.get("timeLimit"),
                "description": schedule.get("description", ""),
                "status": schedule.get("status", "scheduled"),
                "createdAt": schedule["createdAt"],
                "updatedAt": schedule["updatedAt"]
            },
            "session": session_info
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error retrieving schedule details: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/update-schedule")
async def update_schedule(update_data: ScheduleUpdate):
    """
    Update a scheduled session.
    Can only update if status is still 'scheduled'
    """
    try:
        if not update_data.scheduleId:
            raise HTTPException(status_code=400, detail="Schedule ID required")
        
        schedule = db.schedules.find_one({"scheduleId": update_data.scheduleId})
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Can only update if still scheduled
        if schedule.get("status") != "scheduled":
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot update schedule with status: {schedule.get('status')}"
            )
        
        # Build update document
        update_doc = {
            "updatedAt": get_nigeria_time().isoformat()
        }
        
        if update_data.scheduledDate and update_data.scheduledTime:
            try:
                scheduled_datetime = datetime.strptime(
                    f"{update_data.scheduledDate} {update_data.scheduledTime}",
                    "%Y-%m-%d %H:%M"
                )
                scheduled_datetime = scheduled_datetime.replace(tzinfo=timezone(timedelta(hours=1)))
                
                # Verify it's in the future
                if scheduled_datetime <= get_nigeria_time():
                    raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
                
                update_doc["scheduledDateTime"] = scheduled_datetime.isoformat()
                update_doc["scheduledDate"] = update_data.scheduledDate
                update_doc["scheduledTime"] = update_data.scheduledTime
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date/time format")
        
        if update_data.timeLimit is not None:
            update_doc["timeLimit"] = update_data.timeLimit
        
        if update_data.description is not None:
            update_doc["description"] = update_data.description
        
        if update_data.courseCode:
            update_doc["courseCode"] = update_data.courseCode
        
        db.schedules.update_one(
            {"scheduleId": update_data.scheduleId},
            {"$set": update_doc}
        )
        
        logger.info(f"Updated schedule: {update_data.scheduleId}")
        
        return {
            "status": "success",
            "message": "Schedule updated successfully"
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error updating schedule: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cancel-schedule")
async def cancel_schedule(request: Request):
    """Cancel a scheduled attendance session"""
    try:
        data = await request.json()
        schedule_id = data.get("scheduleId")
        lecturerId = data.get("lecturerId")
        
        if not schedule_id or not lecturerId:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        schedule = db.schedules.find_one({"scheduleId": schedule_id})
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Verify ownership
        if schedule.get("lecturerId") != lecturerId:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Can only cancel if not already started/completed
        if schedule.get("status") not in ["scheduled"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel schedule with status: {schedule.get('status')}"
            )
        
        db.schedules.update_one(
            {"scheduleId": schedule_id},
            {
                "$set": {
                    "status": "cancelled",
                    "updatedAt": get_nigeria_time().isoformat()
                }
            }
        )
        
        logger.info(f"Cancelled schedule: {schedule_id}")
        
        return {
            "status": "success",
            "message": "Schedule cancelled successfully"
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error cancelling schedule: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/start-scheduled-session")
async def start_scheduled_session(request: Request):
    """
    Start a scheduled attendance session.
    Creates an active geofence session from the schedule.
    
    This endpoint converts a scheduled session into an active session that:
    1. Is immediately visible to students offering the scheduled course
    2. Appears in the student's course list with hasActiveSession=true
    3. Works identically to manually started sessions via /start-geofence-session
    4. Uses the same session data structure with courseCode, latitude, longitude, etc.
    
    Students will be able to mark attendance using the session ID and session code,
    just as they would for any manually started session.
    """
    try:
        data = await request.json()
        schedule_id = data.get("scheduleId")
        lecturerId = data.get("lecturerId")
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        
        if not all([schedule_id, lecturerId, latitude, longitude]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        schedule = db.schedules.find_one({"scheduleId": schedule_id})
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Verify ownership
        if schedule.get("lecturerId") != lecturerId:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Can only start if scheduled
        if schedule.get("status") != "scheduled":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot start session with status: {schedule.get('status')}"
            )
        
        # Create active geofence session
        from routes.attendance import generate_session_code
        
        session_id = f"geo-{int(time.time())}"
        session_code = generate_session_code()
        
        nigeria_time = get_nigeria_time()
        
        session = {
            "sessionId": session_id,
            "sessionCode": session_code,
            "scheduleId": schedule_id,  # Link to schedule
            "hostId": lecturerId,
            "courseCode": schedule["courseCode"],
            "latitude": latitude,
            "longitude": longitude,
            "radius": 100,
            "status": "active",
            "isActive": True,
            "startTime": nigeria_time.isoformat(),
            "timeLimit": schedule.get("timeLimit"),
            "attendeeCount": 0,
            "created_at": nigeria_time.isoformat()
        }
        
        logger.info(f"Creating session with data: {json.dumps({k: v for k, v in session.items() if k not in ['latitude', 'longitude']}, default=str)}")
        
        db.sessions.insert_one(session)
        
        logger.info(f"✓ Session created successfully: {session_id} for course {schedule['courseCode']}")
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
        
        logger.info(f"Started scheduled session {schedule_id} as session {session_id}")
        
        return {
            "status": "success",
            "message": "Attendance session started from schedule",
            "sessionId": session_id,
            "sessionCode": session_code,
            "courseCode": schedule["courseCode"]
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error starting scheduled session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/upcoming-schedules-today")
async def get_upcoming_schedules_today(lecturerId: str):
    """Get upcoming scheduled sessions for today"""
    try:
        if not lecturerId:
            raise HTTPException(status_code=400, detail="Lecturer ID required")
        
        nigeria_time = get_nigeria_time()
        today_start = nigeria_time.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        schedules = list(db.schedules.find({
            "lecturerId": lecturerId,
            "scheduledDateTime": {
                "$gte": today_start.isoformat(),
                "$lt": today_end.isoformat()
            },
            "status": "scheduled"
        }).sort("scheduledDateTime", 1))
        
        result = []
        for schedule in schedules:
            result.append({
                "scheduleId": schedule["scheduleId"],
                "courseCode": schedule["courseCode"],
                "scheduledTime": schedule["scheduledTime"],
                "timeLimit": schedule.get("timeLimit"),
                "description": schedule.get("description", "")
            })
        
        return {
            "status": "success",
            "schedules": result
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error retrieving today's schedules: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
