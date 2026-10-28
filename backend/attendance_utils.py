from datetime import datetime
from typing import Any

from pymongo import UpdateOne


def present_attendance_query(session_id: str | None = None, user_id: str | None = None) -> dict[str, Any]:
    query: dict[str, Any] = {
        "$or": [
            {"attendanceStatus": {"$exists": False}},
            {"attendanceStatus": "present"},
        ]
    }
    if session_id:
        query["sessionId"] = session_id
    if user_id:
        query["userId"] = user_id
    return query


def count_present_attendance(database: Any, session_id: str) -> int:
    return database.attendance.count_documents(present_attendance_query(session_id))


def increment_session_attendee_count(database: Any, session_id: str) -> None:
    database.sessions.update_one(
        {"sessionId": session_id},
        {
            "$inc": {"attendeeCount": 1},
            "$set": {"lastUpdated": datetime.utcnow()},
        },
    )


def mark_course_roster_absences(database: Any, session: dict[str, Any], ended_at: str) -> int | None:
    """Bulk-insert absent rows for enrolled students without overwriting marks."""
    session_id = session.get("sessionId")
    course_code = session.get("courseCode") or session.get("code")
    if not course_code and session.get("scheduleId"):
        schedule = database.schedules.find_one({"scheduleId": session["scheduleId"]})
        course_code = schedule.get("courseCode") if schedule else None
    if not session_id or not course_code:
        return None

    course = database.courses.find_one({"code": course_code})
    course_refs = [course_code]
    if course and course.get("_id") is not None:
        course_refs.extend([course["_id"], str(course["_id"])])

    roster = database.users.find(
        {"role": "student", "courses": {"$in": course_refs}},
        {"_id": 0, "userId": 1, "name": 1, "matricNumber": 1,
         "matric": 1, "department": 1, "level": 1},
    )
    operations = []
    for student in roster:
        student_id = student.get("userId")
        if not student_id:
            continue
        operations.append(UpdateOne(
            {"sessionId": session_id, "userId": student_id},
            {"$setOnInsert": {
                    "sessionId": session_id,
                    "courseCode": course_code,
                    "userId": student_id,
                    "name": student.get("name", "Unknown student"),
                    "matric": student.get("matricNumber") or student.get("matric", ""),
                    "department": student.get("department", ""),
                    "level": student.get("level", ""),
                    "timestamp": "",
                    "attendanceStatus": "absent",
                    "sessionStatus": "completed",
                    "sessionEndTime": ended_at,
                    "created_at": ended_at,
                    "source": "session-completion",
                }},
            upsert=True,
        ))

    for offset in range(0, len(operations), 500):
        database.attendance.bulk_write(operations[offset:offset + 500], ordered=False)

    return database.attendance.count_documents({
        "sessionId": session_id,
        "attendanceStatus": "absent",
    })