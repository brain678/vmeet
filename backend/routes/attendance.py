from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
import os
import glob
import time
from datetime import datetime, timedelta, timezone
from database import db
import logging
import random
import math
from typing import Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

class LocationData(BaseModel):
    latitude: float
    longitude: float

class GeofenceSession(BaseModel):
    hostId: str
    latitude: float
    longitude: float

class AttendanceMarkRequest(BaseModel):
    sessionId: str
    userId: str
    code: str
    latitude: float
    longitude: float
    studentName: str
    matric: str
    department: str
    level: str

def generate_session_code():
    return ''.join([str(random.randint(0, 9)) for _ in range(4)])

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Debug logging with more precision
    logger.info(f"Calculating distance between points:")
    logger.info(f"Point 1 (Lecturer): {lat1:.6f}°N, {lon1:.6f}°E")
    logger.info(f"Point 2 (Student): {lat2:.6f}°N, {lon2:.6f}°E")

    R = 6371000  # Earth's radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi/2) * math.sin(delta_phi/2) + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda/2) * math.sin(delta_lambda/2)
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c  # Distance in meters

    # Log with detailed precision
    logger.info(f"Calculated distance: {distance:.2f}m")
    return distance

@router.post("/start-geofence-session")
async def start_geofence_session(session_data: GeofenceSession):
    try:
        # Generate unique session ID and 4-digit code
        session_id = f"geo-{int(time.time())}"
        session_code = generate_session_code()
        
        nigeria_time = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
        
        session = {
            "sessionId": session_id,
            "sessionCode": session_code,
            "hostId": session_data.hostId,
            "latitude": session_data.latitude,
            "longitude": session_data.longitude,
            "radius": 100,  # Changed from 200 to 100 meters
            "status": "active",
            "startTime": nigeria_time.isoformat(),
            "attendeeCount": 0
        }
        
        db.sessions.insert_one(session)
        
        return {
            "status": "success",
            "sessionId": session_id,
            "sessionCode": session_code
        }
        
    except Exception as e:
        logger.error(f"Error starting geofence session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mark-attendance")
async def mark_attendance(request: AttendanceMarkRequest):
    try:
        # Log received coordinates
        logger.info(f"Received attendance request coordinates - Latitude: {request.latitude}, Longitude: {request.longitude}")
        
        # Get session details
        session = db.sessions.find_one({"sessionId": request.sessionId})
        if not session:
            raise HTTPException(status_code=404, detail={"status": "error", "message": "Session not found"})
            
        if session["status"] != "active":
            raise HTTPException(status_code=400, detail={"status": "error", "message": "Session has ended"})
            
        if session["sessionCode"] != request.code:
            raise HTTPException(status_code=400, detail={"status": "error", "message": "Invalid session code"})
        
        # Log session coordinates for comparison
        logger.info(f"Session location - Latitude: {session['latitude']}, Longitude: {session['longitude']}")
        
        # Calculate distance between lecturer and student
        distance = calculate_distance(
            session["latitude"], 
            session["longitude"],
            request.latitude,
            request.longitude
        )
        
        # Log calculated distance
        logger.info(f"Calculated distance: {int(distance)}m")
        
        if distance > session["radius"]:
            raise HTTPException(
                status_code=400, 
                detail={"status": "error", "message": f"You are {int(distance)}m away from the lecture location. Must be within {session['radius']}m"}
            )
            
        # Check if student already marked attendance
        existing = db.attendance.find_one({
            "sessionId": request.sessionId,
            "userId": request.userId
        })
        
        if existing:
            raise HTTPException(status_code=400, detail={"status": "error", "message": "Attendance already marked"})
            
        # Record attendance
        nigeria_time = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
        attendance_record = {
            "sessionId": request.sessionId,
            "userId": request.userId,
            "name": request.studentName,
            "matric": request.matric,
            "department": request.department,
            "level": request.level,
            "timestamp": nigeria_time.isoformat(),
            "distance": int(distance),
            "latitude": request.latitude,
            "longitude": request.longitude
        }
        
        db.attendance.insert_one(attendance_record)
        
        # Update session attendee count
        db.sessions.update_one(
            {"sessionId": request.sessionId},
            {"$inc": {"attendeeCount": 1}}
        )
        
        return {
            "status": "success",
            "message": "Attendance marked successfully",
            "data": {
                "timestamp": nigeria_time.isoformat(),
                "distance": int(distance)
            }
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error marking attendance: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail={"status": "error", "message": str(e)}
        )

@router.get("/download-attendance")
async def download_attendance(sessionId: str, userId: str):
    if not sessionId or not userId:
        logger.warning(f"Missing parameters - sessionId: {sessionId}, userId: {userId}")
        raise HTTPException(status_code=400, detail="Missing required parameters")

    try:
        logger.info(f"Attendance download requested - Session: {sessionId}, User: {userId}")
        
        # First check database for session and attendance records
        session = db.sessions.find_one({"sessionId": sessionId})
        if not session:
            logger.warning(f"Session not found: {sessionId}")
            raise HTTPException(status_code=404, detail="Session not found")
            
        # Check user authorization
        host_id = session.get("hostId")
        if not host_id:
            logger.error(f"Session {sessionId} has no host ID")
            raise HTTPException(status_code=500, detail="Invalid session configuration")
            
        if host_id != userId:
            logger.warning(f"Unauthorized access attempt by user {userId} for session {sessionId}")
            raise HTTPException(status_code=403, detail="Unauthorized access")

        # Ensure session is completed
        if session.get("status") != "completed":
            logger.warning(f"Attempted to download active session: {sessionId}")
            raise HTTPException(
                status_code=400, 
                detail="Cannot download attendance for active session. Please end the session first."
            )

        # Get attendance records from database
        records = list(db.attendance.find(
            {"sessionId": sessionId},
            {"_id": 0}
        ).sort("created_at", 1))

        if not records:
            logger.warning(f"No attendance records found for session {sessionId}")
            raise HTTPException(
                status_code=404,
                detail="No attendance records found for this session"
            )

        # Generate Excel file
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Attendance"

        # Add session information
        ws.merge_cells('A1:F1')
        ws['A1'] = f"Attendance Records for Session: {sessionId}"
        ws['A1'].font = Font(bold=True, size=14)
        ws['A1'].alignment = Alignment(horizontal='center')

        # Add metadata
        ws['A2'] = f"Host: {session.get('hostName', 'Unknown')}"
        ws['A3'] = f"Start Time: {session.get('startTime', 'N/A')}"
        ws['A4'] = f"End Time: {session.get('endTime', 'N/A')}"
        ws['A5'] = f"Total Attendees: {len(records)}"

        # Add headers
        headers = ["Name", "Matric Number", "Department", "Time", "Status", "Verification Score"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=8, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal='center')

        # Add records
        for row, record in enumerate(records, 9):
            ws.cell(row=row, column=1).value = record.get("name", "")
            ws.cell(row=row, column=2).value = record.get("matric", "")
            ws.cell(row=row, column=3).value = record.get("department", "")

            # Format timestamp
            try:
                timestamp = datetime.fromisoformat(record.get("timestamp", ""))
                if not timestamp.tzinfo:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                nigeria_time = timestamp.astimezone(timezone(timedelta(hours=1)))
                ws.cell(row=row, column=4).value = nigeria_time.strftime("%Y-%m-%d %I:%M %p")
            except Exception as e:
                logger.error(f"Error formatting timestamp: {e}")
                ws.cell(row=row, column=4).value = record.get("timestamp", "")

            ws.cell(row=row, column=5).value = "Present"
            
            # Add verification score
            face_distance = record.get("face_distance")
            if face_distance is not None:
                confidence = round((1 - float(face_distance)) * 100, 2)
                ws.cell(row=row, column=6).value = f"{confidence}%"

        # Adjust column widths
        for col in range(1, 7):
            ws.column_dimensions[chr(64 + col)].width = 15

        # Save the file
        if not os.path.exists(UPLOAD_DIR):
            os.makedirs(UPLOAD_DIR)

        filename = f"attendance_{sessionId}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        wb.save(file_path)
        
        # Verify file was created and has content
        if not os.path.exists(file_path):
            raise HTTPException(status_code=500, detail="Failed to generate attendance file")
            
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            os.remove(file_path)
            raise HTTPException(status_code=500, detail="Generated file is empty")

        return FileResponse(
            file_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        logger.error(f"Error generating attendance report: {str(e)}")
        return HTTPException(status_code=500, detail=f"Failed to generate attendance report: {str(e)}")

@router.post("/end-attendance-session")
async def end_attendance_session(request: Request):
    try:
        data = await request.json()
        session_id = data.get("sessionId")
        user_id = data.get("userId")
        
        if not session_id or not user_id:
            raise HTTPException(status_code=400, detail="Missing required fields")

        # Get session info
        session = db.sessions.find_one({"sessionId": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        if session.get("hostId") != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized to end this session")
            
        if session.get("status") != "active":
            raise HTTPException(status_code=400, detail="Session is not active")

        # Get all records and archive them
        records = list(db.attendance.find({"sessionId": session_id}).sort("created_at", 1))
        nigeria_time = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
        
        # Update each attendance record with session end details
        for record in records:
            db.attendance.update_one(
                {"_id": record["_id"]},
                {
                    "$set": {
                        "sessionEndTime": nigeria_time.isoformat(),
                        "sessionStatus": "completed",
                        "lastUpdated": datetime.utcnow().isoformat()
                    }
                }
            )
        
        # Update session status
        db.sessions.update_one(
            {"sessionId": session_id},
            {
                "$set": {
                    "status": "completed",
                    "endTime": nigeria_time.isoformat(),
                    "attendeeCount": len(records),
                    "lastUpdated": datetime.utcnow().isoformat()
                }
            }
        )
        
        return {
            "status": "success",
            "message": "Attendance session ended successfully",
            "downloadUrl": f"/download-attendance/{session_id}",
            "recordCount": len(records),
            "sessionEndTime": nigeria_time.isoformat()
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error ending attendance session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get-active-session")
async def get_active_session(code: str):
    try:
        # Find active session with this code
        session = db.sessions.find_one({
            "sessionCode": code,
            "status": "active"
        })
        
        if not session:
            raise HTTPException(status_code=404, detail="No active session found with this code")
        
        return {
            "status": "success",
            "sessionId": session["sessionId"],
            "message": "Active session found"
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error finding active session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get-student-details")
async def get_student_details(userId: str):
    try:
        # Get user details from database
        user = db.users.find_one({"userId": userId})
        if not user:
            raise HTTPException(status_code=404, detail={"status": "error", "message": "Student not found"})
            
        if user.get("role") != "student":
            raise HTTPException(status_code=400, detail={"status": "error", "message": "User is not a student"})

        return {
            "status": "success",
            "data": {
                "name": user.get("name", ""),
                "matricNumber": user.get("matricNumber", ""),
                "department": user.get("department", ""),
                "level": user.get("level", "")
            }
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error getting student details: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": str(e)}
        )

@router.get("/get-session-status")
async def get_session_status(sessionId: str):
    try:
        session = db.sessions.find_one({"sessionId": sessionId})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Calculate session duration and check if it's still valid
        start_time = datetime.fromisoformat(session["startTime"].replace('Z', '+00:00'))
        current_time = datetime.utcnow().replace(tzinfo=timezone.utc)
        session_duration = (current_time - start_time).total_seconds() / 3600  # in hours

        # Update session status if it's been active for too long (e.g., 24 hours)
        if session["status"] == "active" and session_duration > 24:
            db.sessions.update_one(
                {"sessionId": sessionId},
                {
                    "$set": {
                        "status": "completed",
                        "endTime": current_time.isoformat(),
                        "lastUpdated": current_time.isoformat()
                    }
                }
            )
            return {
                "status": "completed",
                "isActive": False,
                "message": "Session automatically ended due to duration limit"
            }

        return {
            "status": session["status"],
            "isActive": session["status"] == "active",
            "startTime": session["startTime"],
            "attendeeCount": session.get("attendeeCount", 0),
            "message": "Session status retrieved successfully"
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error getting session status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/check-attendance-status")
async def check_attendance_status(userId: str, sessionId: str):
    try:
        # Check if session exists and is active
        session = db.sessions.find_one({
            "sessionId": sessionId,
            "status": "active"
        })
        
        if not session:
            return {
                "status": "error",
                "hasMarkedAttendance": False,
                "message": "Session not found or not active"
            }

        # Check if student has marked attendance
        attendance = db.attendance.find_one({
            "sessionId": sessionId,
            "userId": userId
        })

        return {
            "status": "success",
            "hasMarkedAttendance": bool(attendance),
            "message": "Attendance already marked" if attendance else "Attendance not yet marked",
            "timestamp": attendance["timestamp"] if attendance else None
        }
    except Exception as e:
        logger.error(f"Error checking attendance status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Test coordinates
LECTURER_TEST_COORDS = {
    "latitude": 6.827302,
    "longitude": 3.940243
}

STUDENT_TEST_COORDS = {
    "latitude": 6.827402,
    "longitude": 3.940343
}

# Add this function to test coordinates
def test_distance():
    distance = calculate_distance(
        LECTURER_TEST_COORDS["latitude"],
        LECTURER_TEST_COORDS["longitude"],
        STUDENT_TEST_COORDS["latitude"],
        STUDENT_TEST_COORDS["longitude"]
    )
    logger.info(f"Test distance between points: {distance:.2f}m")
    return distance <= 100  # Changed from 200 to 100

@router.get("/test-coords")
async def test_coordinates():
    distance = calculate_distance(
        LECTURER_TEST_COORDS["latitude"],
        LECTURER_TEST_COORDS["longitude"],
        STUDENT_TEST_COORDS["latitude"],
        STUDENT_TEST_COORDS["longitude"]
    )
    return {
        "distance": round(distance, 2),
        "within_range": distance <= 100,  # Changed from 200 to 100
        "lecturer": LECTURER_TEST_COORDS,
        "student": STUDENT_TEST_COORDS
    }
