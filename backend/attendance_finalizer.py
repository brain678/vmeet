"""Durable, retryable finalization of absent attendance records."""
import logging
from datetime import datetime, timedelta
from typing import Any

from pymongo import ReturnDocument

from attendance_utils import mark_course_roster_absences

logger = logging.getLogger(__name__)


def process_pending_absence_finalizations(database: Any, max_jobs: int = 10) -> int:
    """Claim and process queued sessions; Mongo status fields make claims restart-safe."""
    processed = 0
    now = datetime.utcnow()
    stale_before = now - timedelta(minutes=5)

    for _ in range(max_jobs):
        session = database.sessions.find_one_and_update(
            {
                "status": "completed",
                "$or": [
                    {"absenceFinalizationStatus": "pending"},
                    {
                        "absenceFinalizationStatus": "retrying",
                        "absenceFinalizationNextAttemptAt": {"$lte": now},
                    },
                    {
                        "absenceFinalizationStatus": "processing",
                        "absenceFinalizationStartedAt": {"$lt": stale_before},
                    },
                ],
            },
            {
                "$set": {
                    "absenceFinalizationStatus": "processing",
                    "absenceFinalizationStartedAt": now,
                    "absenceFinalizationLastError": None,
                },
                "$inc": {"absenceFinalizationAttempts": 1},
            },
            sort=[("endTime", 1)],
            return_document=ReturnDocument.AFTER,
        )
        if not session:
            break

        try:
            ended_at = session.get("endTime") or now.isoformat()
            if isinstance(ended_at, datetime):
                ended_at = ended_at.isoformat()
            absent_count = mark_course_roster_absences(database, session, ended_at)
            final_status = "skipped" if absent_count is None else "completed"
            update = {
                "absenceFinalizationStatus": final_status,
                "absenceFinalizationCompletedAt": datetime.utcnow(),
                "absenceFinalizationLastError": None,
                "absenceFinalizationNextAttemptAt": None,
                "absentCount": absent_count or 0,
            }
            if final_status == "skipped":
                update["absenceFinalizationSkipReason"] = "Course could not be resolved for session"
            else:
                update["absenceFinalizationSkipReason"] = None
            logger.info(
                "Absence finalization %s for session %s (%s absent)",
                final_status,
                session.get("sessionId"),
                absent_count or 0,
            )
        except Exception as error:
            attempts = session.get("absenceFinalizationAttempts", 1)
            retry_delay_seconds = min(300, 2 ** min(attempts, 8))
            update = {
                "absenceFinalizationStatus": "retrying",
                "absenceFinalizationLastError": str(error)[:500],
                "absenceFinalizationNextAttemptAt": datetime.utcnow() + timedelta(seconds=retry_delay_seconds),
            }
            logger.exception("Absence finalization failed for session %s", session.get("sessionId"))

        database.sessions.update_one(
            {"_id": session["_id"], "absenceFinalizationStatus": "processing"},
            {"$set": update},
        )
        processed += 1

    return processed
