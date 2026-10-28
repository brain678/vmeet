import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request

from admin_auth import get_admin_session
from attendance_utils import count_present_attendance
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_admin(request: Request):
    authorization = request.headers.get("Authorization", "")
    token = authorization.removeprefix("Bearer ") if authorization.startswith("Bearer ") else ""
    admin = get_admin_session(db.admins, token)
    if not admin:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    return admin


def _iso(value):
    return value.isoformat() if isinstance(value, datetime) else value or ""


def _resolve_host_name(session: dict) -> str:
    host_name = session.get("hostName") or session.get("host") or ""
    if host_name:
        return host_name

    host_id = session.get("hostId") or ""
    if not host_id:
        return ""

    user = db.users.find_one({"userId": host_id}, {"_id": 0, "name": 1})
    if user and user.get("name"):
        return user.get("name")
    return host_id


def _session_summary(session: dict) -> dict:
    session_id = session.get("sessionId", "")
    host_id = session.get("hostId", "")
    resolved_host_name = _resolve_host_name(session)
    return {
        "sessionId": session_id,
        "courseCode": session.get("courseCode") or session.get("code") or "",
        "courseTitle": session.get("classTitle") or session.get("title") or "Untitled session",
        "type": "physical" if session_id.startswith("geo-") else "virtual",
        "status": session.get("status", "unknown"),
        "hostId": host_id,
        "hostName": resolved_host_name,
        "startTime": _iso(session.get("startTime")),
        "endTime": _iso(session.get("endTime")),
        "attendeeCount": session.get("attendeeCount", 0),
        "finalizationStatus": session.get("absenceFinalizationStatus", "completed"),
        "finalizationError": session.get("absenceFinalizationLastError", ""),
    }


@router.get("/admin/sessions")
def list_admin_sessions(request: Request, status: str = "all", limit: int = 200):
    """List sessions and active/completed totals for a verified admin."""
    _require_admin(request)
    if status not in {"all", "active", "completed"}:
        raise HTTPException(status_code=400, detail="status must be all, active, or completed")
    limit = max(1, min(limit, 500))
    query = {} if status == "all" else {"status": status}
    sessions = list(db.sessions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit))
    return {
        "status": "success",
        "data": [_session_summary(session) for session in sessions],
        "total": db.sessions.count_documents(query),
        "activeCount": db.sessions.count_documents({"status": "active"}),
        "completedCount": db.sessions.count_documents({"status": "completed"}),
    }


@router.get("/admin/sessions/{session_id}")
def get_admin_session_detail(session_id: str, request: Request):
    """Return one session and its recorded present/absent attendees."""
    _require_admin(request)
    session = db.sessions.find_one({"sessionId": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    attendees = list(db.attendance.find(
        {"sessionId": session_id},
        {"_id": 0, "userId": 1, "name": 1, "matric": 1, "department": 1,
         "level": 1, "timestamp": 1, "attendanceStatus": 1},
    ).sort("timestamp", 1).limit(5000))
    for attendee in attendees:
        attendee["timestamp"] = _iso(attendee.get("timestamp"))
        attendee["attendanceStatus"] = attendee.get("attendanceStatus", "present")
    return {
        "status": "success",
        "session": _session_summary(session),
        "attendees": attendees,
        "attendeesTruncated": len(attendees) == 5000,
    }


@router.post("/admin/sessions/{session_id}/end")
def end_admin_session(session_id: str, request: Request):
    """Stop an active session and queue absence finalization for the background worker."""
    _require_admin(request)
    session = db.sessions.find_one({"sessionId": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get("status") != "active":
        raise HTTPException(status_code=409, detail="Only active sessions can be ended")

    nigeria_time = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=1)))
    present_count = count_present_attendance(db, session_id)
    result = db.sessions.update_one(
        {"sessionId": session_id, "status": "active"},
        {"$set": {
            "status": "completed",
            "isActive": False,
            "endTime": nigeria_time.isoformat(),
            "attendeeCount": present_count,
            "absenceFinalizationStatus": "pending",
            "absenceFinalizationQueuedAt": nigeria_time,
            "lastUpdated": nigeria_time,
            "endedByAdmin": True,
        }},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="Session is no longer active")

    db.attendance.update_many(
        {"sessionId": session_id, "attendanceStatus": {"$ne": "absent"}},
        {"$set": {
            "sessionStatus": "completed",
            "sessionEndTime": nigeria_time.isoformat(),
            "lastUpdated": nigeria_time,
        }},
    )
    if session.get("scheduleId"):
        db.schedules.update_one(
            {"scheduleId": session["scheduleId"]},
            {"$set": {"status": "completed", "updatedAt": nigeria_time.isoformat()}},
        )

    updated_session = {
        **session,
        "status": "completed",
        "endTime": nigeria_time.isoformat(),
        "attendeeCount": present_count,
        "absenceFinalizationStatus": "pending",
    }
    return {
        "status": "success",
        "message": "Session ended; absence finalization queued",
        "session": _session_summary(updated_session),
    }
