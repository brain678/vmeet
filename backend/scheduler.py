"""
Background scheduler for automatic session termination based on time limits.
"""

import logging
from datetime import datetime, timezone
from database import db
from attendance_utils import count_present_attendance
from attendance_finalizer import process_pending_absence_finalizations
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

class SessionScheduler:
    """Manages background tasks for session expiration"""
    
    _instance = None
    _scheduler = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SessionScheduler, cls).__new__(cls)
        return cls._instance
    
    def start(self):
        """Start the background scheduler"""
        if self._scheduler is not None:
            logger.warning("Scheduler is already running")
            return
        
        try:
            self._scheduler = BackgroundScheduler(daemon=True)
            
            # Add job to check and auto-end expired sessions every 30 seconds
            self._scheduler.add_job(
                self.check_and_end_expired_sessions,
                trigger=IntervalTrigger(seconds=30),
                id='check_expired_sessions',
                name='Check and end expired sessions',
                replace_existing=True
            )

            self._scheduler.add_job(
                lambda: process_pending_absence_finalizations(db),
                trigger=IntervalTrigger(seconds=5),
                id='finalize_session_absences',
                name='Finalize absent attendance records',
                replace_existing=True,
                max_instances=1,
                coalesce=True,
            )
            
            self._scheduler.start()
            logger.info("Session scheduler started successfully. Check interval: 30 seconds")
        except Exception as e:
            logger.error(f"Failed to start session scheduler: {str(e)}")
            self._scheduler = None
    
    def stop(self):
        """Stop the background scheduler"""
        if self._scheduler is not None:
            try:
                self._scheduler.shutdown(wait=False)
                self._scheduler = None
                logger.info("Session scheduler stopped")
            except Exception as e:
                logger.error(f"Error stopping scheduler: {str(e)}")
    
    @staticmethod
    def check_and_end_expired_sessions():
        """
        Check all active sessions and end those that have exceeded their time limit.
        This function runs in the background and is not dependent on client connections.
        """
        try:
            # Get all active sessions with a time limit set
            active_sessions = list(db.sessions.find({
                "status": "active",
                "timeLimit": {"$exists": True, "$ne": None}
            }))
            
            if not active_sessions:
                logger.debug("No active sessions with time limit found")
                return
            
            logger.debug(f"Checking {len(active_sessions)} active sessions for expiration")
            
            current_time = datetime.now(timezone.utc)
            expired_count = 0
            
            for session in active_sessions:
                try:
                    session_id = session.get("_id")
                    start_time_str = session.get("startTime")
                    time_limit_minutes = session.get("timeLimit")
                    
                    if not start_time_str or time_limit_minutes is None:
                        continue
                    
                    # Parse start time (handle both ISO format and Z suffix)
                    if isinstance(start_time_str, str):
                        start_time_str = start_time_str.replace('Z', '+00:00')
                        start_time = datetime.fromisoformat(start_time_str)
                    else:
                        start_time = start_time_str
                    
                    # Ensure both times are in the same timezone for comparison
                    if start_time.tzinfo is None:
                        start_time = start_time.replace(tzinfo=timezone.utc)
                    
                    # Calculate elapsed time in minutes
                    elapsed_seconds = (current_time - start_time).total_seconds()
                    elapsed_minutes = elapsed_seconds / 60
                    
                    # Check if session has exceeded time limit
                    if elapsed_minutes >= time_limit_minutes:
                        # Auto-end the session
                        end_result = SessionScheduler._auto_end_session(
                            session_id,
                            session,
                            elapsed_minutes,
                            time_limit_minutes
                        )
                        
                        if end_result:
                            expired_count += 1
                
                except Exception as e:
                    logger.error(f"Error processing session {session.get('_id')}: {str(e)}")
                    continue
            
            if expired_count > 0:
                logger.info(f"Auto-ended {expired_count} expired session(s)")
        
        except Exception as e:
            logger.error(f"Error in check_and_end_expired_sessions: {str(e)}")
    
    @staticmethod
    def _auto_end_session(session_id, session_data, elapsed_minutes, time_limit_minutes):
        """
        Helper function to auto-end a single session
        Handles attendance records the same way as manual end-session
        
        Args:
            session_id: MongoDB ObjectId of the session
            session_data: Full session document
            elapsed_minutes: How many minutes have elapsed
            time_limit_minutes: Time limit in minutes
        
        Returns:
            True if session was successfully ended, False otherwise
        """
        try:
            from datetime import timedelta
            
            # Get Nigeria timezone (UTC+1)
            nigeria_time = datetime.now(timezone.utc).replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
            
            # Convert session_id to string if needed for sessionId field
            session_id_str = str(session_id)
            
            # Get the sessionId field from the session document (used in attendance records)
            session_doc_id = session_data.get("sessionId", session_id_str)
            
            # Get all attendance records for this session
            records = list(db.attendance.find({"sessionId": session_doc_id}))
            logger.debug(f"Found {len(records)} attendance records for session {session_id}")
            
            # Update each attendance record with session end details (same as manual end)
            for record in records:
                try:
                    db.attendance.update_one(
                        {"_id": record["_id"]},
                        {
                            "$set": {
                                "sessionEndTime": nigeria_time.isoformat(),
                                "sessionStatus": "completed",
                                "autoEnded": True,  # Mark as auto-ended
                                "lastUpdated": datetime.utcnow().isoformat()
                            }
                        }
                    )
                except Exception as e:
                    logger.error(f"Error updating attendance record {record['_id']}: {str(e)}")
                    continue
            
            # Update session status to completed (atomic operation - only if still active)
            update_result = db.sessions.update_one(
                {"_id": session_id, "status": "active"},
                {
                    "$set": {
                        "status": "completed",
                        "endTime": nigeria_time.isoformat(),
                        "autoEnded": True,
                        "autoEndReason": f"Time limit of {time_limit_minutes} minutes exceeded",
                        "attendeeCount": count_present_attendance(db, session_doc_id),
                        "absenceFinalizationStatus": "pending",
                        "absenceFinalizationQueuedAt": nigeria_time,
                        "lastUpdated": datetime.utcnow().isoformat()
                    }
                }
            )
            
            if update_result.modified_count > 0:
                logger.info(
                    f"Auto-ended session {session_id}. "
                    f"Elapsed: {elapsed_minutes:.1f}min, Limit: {time_limit_minutes}min, "
                    f"Attendance records updated: {len(records)}"
                )
                return True
            else:
                logger.debug(f"Session {session_id} was already ended or not found")
                return False
        
        except Exception as e:
            logger.error(f"Error auto-ending session {session_id}: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return False


def initialize_scheduler():
    """Initialize and start the session scheduler"""
    try:
        scheduler = SessionScheduler()
        scheduler.start()
        return scheduler
    except Exception as e:
        logger.error(f"Failed to initialize scheduler: {str(e)}")
        return None
