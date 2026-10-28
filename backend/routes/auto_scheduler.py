"""
Background scheduler to automatically start scheduled attendance sessions when their time arrives
and automatically end them when their time limit expires.
This ensures sessions become active and end even if the lecturer forgets to manually manage them.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from database import db
from attendance_utils import count_present_attendance
from routes.attendance import generate_session_code
import time

logger = logging.getLogger(__name__)

def get_nigeria_time():
    """Get current time in Nigeria (UTC+1)"""
    return datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=1)))

async def auto_start_scheduled_sessions():
    """
    Check for scheduled sessions that have reached their scheduled time
    and automatically start them if they haven't been started yet.
    
    Runs every 30 seconds to check for sessions that should be started.
    """
    while True:
        try:
            nigeria_time = get_nigeria_time()
            
            # Find all scheduled sessions that should have started
            # (scheduled time has passed, but status is still "scheduled")
            scheduled_sessions = list(db.schedules.find({
                "status": "scheduled",
                "scheduledDateTime": {
                    "$lte": nigeria_time.isoformat()  # Scheduled time has passed
                }
            }))
            
            if scheduled_sessions:
                logger.info(f"[AUTO-START] Found {len(scheduled_sessions)} schedule(s) that should be started")
            
            for schedule in scheduled_sessions:
                try:
                    schedule_id = schedule.get("scheduleId")
                    lecturer_id = schedule.get("lecturerId")
                    course_code = schedule.get("courseCode")
                    
                    # Check if this schedule already has a session
                    if schedule.get("sessionId"):
                        logger.info(f"[AUTO-START] Schedule {schedule_id} already has session {schedule.get('sessionId')}, skipping")
                        continue
                    
                    logger.info(f"[AUTO-START] Auto-starting schedule {schedule_id} for course {course_code}")
                    
                    # Create session with stored coordinates or default if not available
                    latitude = schedule.get("latitude") or 6.5244  # Default to Lagos center if not provided
                    longitude = schedule.get("longitude") or 3.3792
                    
                    session_id = f"geo-{int(time.time())}"
                    session_code = generate_session_code()
                    
                    session = {
                        "sessionId": session_id,
                        "sessionCode": session_code,
                        "scheduleId": schedule_id,
                        "hostId": lecturer_id,
                        "courseCode": course_code,
                        "latitude": latitude,  # Use stored location from schedule
                        "longitude": longitude,  # Use stored location from schedule
                        "radius": 100,
                        "status": "active",
                        "isActive": True,
                        "startTime": nigeria_time.isoformat(),
                        "timeLimit": schedule.get("timeLimit"),
                        "attendeeCount": 0,
                        "created_at": nigeria_time.isoformat(),
                        "autoStarted": True  # Mark as automatically started
                    }
                    
                    # Insert session
                    db.sessions.insert_one(session)
                    
                    # Update schedule with session ID and status
                    db.schedules.update_one(
                        {"scheduleId": schedule_id},
                        {
                            "$set": {
                                "sessionId": session_id,
                                "status": "started",
                                "autoStarted": True,
                                "updatedAt": nigeria_time.isoformat()
                            }
                        }
                    )
                    
                    logger.info(f"[AUTO-START] ✓ Successfully auto-started session {session_id} for schedule {schedule_id}")
                    
                except Exception as e:
                    logger.error(f"[AUTO-START] Error auto-starting schedule {schedule_id}: {str(e)}")
                    # Continue with next schedule even if one fails
                    continue
            
        except Exception as e:
            logger.error(f"[AUTO-START] Error in auto-start scheduler: {str(e)}")
        
        # Check every 30 seconds
        await asyncio.sleep(30)

def start_auto_scheduler():
    """Start the auto-scheduler background task"""
    logger.info("[AUTO-START] Starting automatic session scheduler...")
    # Return the task so it can be managed


async def auto_complete_sessions():
    """
    Check for active sessions that have exceeded their time limit
    and automatically end them.
    
    Runs every 15 seconds to check for sessions that should be completed.
    """
    while True:
        try:
            nigeria_time = get_nigeria_time()
            
            # Find all active sessions that have a time limit
            active_sessions = list(db.sessions.find({
                "status": "active",
                "timeLimit": {"$exists": True, "$ne": None, "$gt": 0},
                "startTime": {"$exists": True}
            }))
            
            for session in active_sessions:
                try:
                    session_id = session.get("sessionId")
                    start_time_str = session.get("startTime")
                    time_limit = session.get("timeLimit")  # in minutes
                    
                    # Parse start time
                    start_time = datetime.fromisoformat(start_time_str)
                    
                    # Calculate when session should end
                    end_time = start_time + timedelta(minutes=time_limit)
                    
                    # Check if current time has passed end time
                    if nigeria_time >= end_time:
                        logger.info(f"[AUTO-COMPLETE] Session {session_id} time limit ({time_limit}m) has expired, ending session")
                        
                        # Get related schedule
                        schedule_id = session.get("scheduleId")
                        
                        # UPDATE ATTENDANCE RECORDS - Same as manual session end
                        # Get all attendance records for this session
                        records = list(db.attendance.find({"sessionId": session_id}))
                        
                        # Mark each attendance record as completed
                        for record in records:
                            db.attendance.update_one(
                                {"_id": record["_id"]},
                                {
                                    "$set": {
                                        "sessionEndTime": nigeria_time.isoformat(),
                                        "sessionStatus": "completed",
                                        "lastUpdated": nigeria_time.isoformat()
                                    }
                                }
                            )
                        
                        logger.info(f"[AUTO-COMPLETE] Updated {len(records)} attendance records for session {session_id}")
                        
                        # Update session status to completed
                        db.sessions.update_one(
                            {"sessionId": session_id},
                            {
                                "$set": {
                                    "status": "completed",
                                    "isActive": False,
                                    "endTime": nigeria_time.isoformat(),
                                    "absenceFinalizationStatus": "pending",
                                    "absenceFinalizationQueuedAt": nigeria_time,
                                    "autoCompleted": True,  # Mark as automatically completed
                                    "attendeeCount": count_present_attendance(db, session_id),  # Store final present count
                                    "updated_at": nigeria_time.isoformat()
                                }
                            }
                        )

                        # Update related schedule to completed
                        if schedule_id:
                            db.schedules.update_one(
                                {"scheduleId": schedule_id},
                                {
                                    "$set": {
                                        "status": "completed",
                                        "updatedAt": nigeria_time.isoformat()
                                    }
                                }
                            )
                        
                        logger.info(f"[AUTO-COMPLETE] ✓ Successfully ended session {session_id} (auto-completed)")
                        
                except Exception as e:
                    logger.error(f"[AUTO-COMPLETE] Error auto-completing session {session.get('sessionId')}: {str(e)}")
                    continue
                    
        except Exception as e:
            logger.error(f"[AUTO-COMPLETE] Error in auto-complete scheduler: {str(e)}")
        
        # Check every 15 seconds (more frequent than auto-start since timing is critical)
        await asyncio.sleep(15)
    return asyncio.create_task(auto_start_scheduled_sessions())
