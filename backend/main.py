import time
from fastapi import FastAPI, UploadFile, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment
from pymongo import MongoClient, ASCENDING
from gridfs import GridFS
from database import db
import os
import sys
import logging
import traceback
import shutil
import face_recognition
import numpy as np
from routes.attendance import router as attendance_router

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
allowed_origins = [
    "http://localhost:3000",
    "https://vmeetnew.vercel.app",  # Add your Vercel domain here
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
async def health_check():
    try:
        # Test database connection
        if not db.ping():
            raise Exception("Database connection failed")
        return {"status": "healthy", "mongodb": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "unhealthy", "error": str(e)}
        )

@app.post("/upload-face-image")
async def upload_face_image(
    userId: str = Form(...),
    name: str = Form(...),
    matric: str = Form(...),
    department: str = Form(...),
    file: UploadFile = Form(...)
):
    logger.info(f"Received face image upload request for user: {userId}")
    file_path = None
    try:
        # Validate input
        if not all([userId, name, matric, department]):
            raise HTTPException(status_code=400, detail="All fields are required")
            
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")

        # Save uploaded image temporarily
        file_path = os.path.join(UPLOAD_DIR, f"ref_{userId}.jpg")
        logger.debug(f"Saving image to: {file_path}")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Verify the image contains a face
        logger.debug("Verifying face in image")
        image = face_recognition.load_image_file(file_path)
        face_locations = face_recognition.face_locations(image)
        if not face_locations:
            raise HTTPException(status_code=400, detail="No face detected in the image")

        def store_in_gridfs():
            # Remove old image from GridFS if exists
            for old in db.fs.find({"filename": f"ref_{userId}.jpg"}):
                db.fs.delete(old._id)
            
            # Store new image in GridFS
            with open(file_path, "rb") as f:
                file_id = db.fs.put(f, filename=f"ref_{userId}.jpg", userId=userId)
                stored_file = db.fs.find_one({"_id": file_id})
                if not stored_file:
                    raise Exception("Failed to verify stored image")
                return file_id

        # Retry GridFS operation if needed
        file_id = db.retry_operation(store_in_gridfs)
        
        # Save user info to MongoDB
        def update_user():
            return db.users.update_one(
                {"userId": userId},
                {
                    "$set": {
                        "userId": userId,
                        "name": name,
                        "matric": matric,
                        "department": department,
                        "role": "student",
                        "registeredAt": datetime.utcnow(),
                        "lastUpdated": datetime.utcnow(),
                        "hasReferenceImage": True
                    }
                },
                upsert=True
            )

        result = db.retry_operation(update_user)
        logger.info(f"MongoDB update result - Modified: {result.modified_count}, Upserted: {result.upserted_id is not None}")
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Face image and user info uploaded successfully",
                "userId": userId,
                "name": name
            }
        )

    except HTTPException as he:
        logger.error(f"HTTP Exception in upload_face_image: {str(he)}")
        raise he
    except Exception as e:
        logger.error(f"Error in upload_face_image: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"An error occurred while processing the request: {str(e)}"
            }
        )
    finally:
        # Clean up temporary file
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.error(f"Error removing temporary file: {str(e)}")

@app.post("/verify-face")
async def verify_face(userId: str = Form(...), sessionId: str = Form(...), file: UploadFile = Form(...)):
    temp_file = None
    ref_path = None
    
    try:
        # First verify session is active
        def get_session():
            return db.sessions.find_one({
                "sessionId": sessionId,
                "status": "active",
                "isActive": True
            })
        
        session = db.retry_operation(get_session)
        if not session:
            raise HTTPException(
                status_code=400,
                detail="Attendance session is not active or has ended"
            )

        # Check if already marked attendance
        def check_existing():
            return db.attendance.find_one({
                "userId": userId,
                "sessionId": sessionId
            })
        
        existing = db.retry_operation(check_existing)
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Attendance already marked for this session"
            )

        # Save uploaded image temporarily
        temp_file = os.path.join(UPLOAD_DIR, f"verify_{userId}_{int(time.time())}.jpg")
        with open(temp_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Process verification image
        try:
            verify_image = face_recognition.load_image_file(temp_file)
            face_locations = face_recognition.face_locations(verify_image)
            if not face_locations:
                raise HTTPException(status_code=400, detail="No face detected in the verification image")
            verify_encoding = face_recognition.face_encodings(verify_image, face_locations)[0]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing verification image: {str(e)}")

        # Get and process reference image
        def get_reference_image():
            ref_file = db.fs.find_one({"filename": f"ref_{userId}.jpg"})
            if not ref_file:
                raise HTTPException(status_code=404, detail="No reference image found. Please register first.")
            return ref_file
            
        ref_file = db.retry_operation(get_reference_image)
        
        ref_path = os.path.join(UPLOAD_DIR, f"ref_{userId}.jpg")
        with open(ref_path, "wb") as f:
            f.write(db.fs.get(ref_file._id).read())

        try:
            ref_image = face_recognition.load_image_file(ref_path)
            ref_encoding = face_recognition.face_encodings(ref_image)[0]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing reference image: {str(e)}")

        # Verify face match
        face_distance = face_recognition.face_distance([ref_encoding], verify_encoding)[0]
        matches = face_recognition.compare_faces([ref_encoding], verify_encoding, tolerance=0.6)

        if not matches[0]:
            return JSONResponse(
                status_code=401,
                content={"detail": "Face verification failed. Please ensure proper lighting and camera position."}
            )

        # Get user info
        def get_user_info():
            return db.users.find_one({"userId": userId})
        user_info = db.retry_operation(get_user_info)
        
        if not user_info:
            raise HTTPException(status_code=404, detail="User information not found")

        # Record attendance with timezone handling
        nigeria_time = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
        attendance_record = {
            "userId": userId,
            "name": user_info.get("name", ""),
            "matric": user_info.get("matric", ""),
            "department": user_info.get("department", ""),
            "sessionId": sessionId,
            "timestamp": nigeria_time.isoformat(),
            "created_at": datetime.utcnow(),
            "face_distance": float(face_distance),
            "verified": True,
            "device_info": "web"
        }

        # Save attendance record with retry and update session
        def save_attendance():
            # Insert attendance record
            result = db.attendance.insert_one(attendance_record)
            if not result.inserted_id:
                raise Exception("Failed to save attendance record")
                
            # Update session with new attendee count
            attendee_count = db.attendance.count_documents({"sessionId": sessionId})
            update_result = db.sessions.update_one(
                {"sessionId": sessionId},
                {
                    "$set": {
                        "attendeeCount": attendee_count,
                        "lastUpdated": datetime.utcnow()
                    }
                }
            )
            if update_result.modified_count != 1:
                raise Exception("Failed to update session attendee count")
                
            return result

        result = db.retry_operation(save_attendance)
        
        logger.info(f"Successfully recorded attendance for user {userId} in session {sessionId}")
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Attendance marked successfully",
                "timestamp": nigeria_time.isoformat()
            }
        )

    except HTTPException as he:
        logger.error(f"HTTP Exception in verify_face: {str(he)}")
        raise he
    except Exception as e:
        logger.error(f"Error in verify_face: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": f"An error occurred: {str(e)}"}
        )
    finally:
        # Clean up temporary files
        for temp_path in [temp_file, ref_path]:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception as e:
                    logger.error(f"Error removing temporary file {temp_path}: {str(e)}")

@app.post("/create-attendance-session")
async def create_attendance_session(request: Request):
    try:
        data = await request.json()
        session_id = data.get("sessionId")
        host_id = data.get("hostId")

        # Input validation
        if not all([session_id, host_id]):
            return JSONResponse(
                status_code=400,
                content={"detail": "Missing required fields: sessionId or hostId"}
            )

        # Get host info with retry
        def get_host():
            return db.users.find_one({"userId": host_id})
            
        host = db.retry_operation(get_host)
        if not host or host.get("role") != "lecturer":
            return JSONResponse(
                status_code=403,
                content={"detail": "Only lecturers can create attendance sessions"}
            )

        # Check for existing active session with retry
        def check_existing_session():
            return db.sessions.find_one({
                "sessionId": session_id,
                "status": "active"
            })
            
        existing_session = db.retry_operation(check_existing_session)
        if existing_session:
            return JSONResponse(
                status_code=400,
                content={"detail": "An active session already exists with this ID"}
            )        # Create new session with proper timezone handling
        nigeria_time = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
        
        session = {
            "sessionId": session_id,
            "hostId": host_id,
            "hostName": host.get("name", "Unknown"),
            "status": "active",
            "isActive": True,  # Explicit active flag
            "startTime": nigeria_time.isoformat(),
            "attendeeCount": 0,
            "created_at": nigeria_time.isoformat()  # Store as ISO format string
        }
        
        logger.info(f"Creating new session: {session}")

        # Insert session with retry
        def create_session():
            result = db.sessions.insert_one(session)
            if not result.inserted_id:
                raise Exception("Failed to create attendance session")
            return result
            
        result = db.retry_operation(create_session)
        
        logger.info(f"Created attendance session: {session_id}")
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "sessionId": session_id,
                "message": "Attendance session created successfully"
            }
        )

    except Exception as e:
        logger.error(f"Error creating attendance session: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to create attendance session: {str(e)}"}
        )

@app.get("/download-attendance/{session_id}")
async def download_attendance(session_id: str):
    temp_file = None
    try:
        logger.info(f"Fetching attendance records for session: {session_id}")
          # Validate session exists with retry
        def get_session():
            return db.sessions.find_one({"sessionId": session_id})
            
        session = db.retry_operation(get_session)
        if not session:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "error",
                    "message": "Session not found"
                }
            )        # Get all records with retry mechanism
        def get_records():
            return list(db.attendance.find(
                {"sessionId": session_id},
                {"_id": 0}
            ).sort("created_at", 1))
            
        records = db.retry_operation(get_records)
        
        logger.info(f"Found {len(records)} attendance records")
        
        if not records:
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "message": "No attendance records available for download",
                    "records": []
                }
            )
        
        # Create new workbook with enhanced styling
        wb = Workbook()
        ws = wb.active
        ws.title = "Attendance"
        
        # Add detailed session information
        ws.merge_cells('A1:E1')
        ws['A1'] = f"Attendance Records for Session: {session_id}"
        ws['A1'].font = Font(bold=True, size=14)
        ws['A1'].alignment = Alignment(horizontal='center')
        
        # Add session metadata
        ws['A2'] = f"Host: {session.get('hostName', 'Unknown')}"
        ws['A3'] = f"Start Time: {session.get('startTime', 'N/A')}"
        ws['A4'] = f"End Time: {session.get('endTime', 'N/A')}"
        ws['A5'] = f"Total Attendees: {len(records)}"
        ws['A6'] = f"Generated at: {datetime.now(timezone(timedelta(hours=1))).strftime('%Y-%m-%d %H:%M:%S %Z')}"
        
        # Start data from row 8
        headers = ["Name", "Matric Number", "Department", "Time", "Status", "Verification Score"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=8, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal='center')
            ws.column_dimensions[cell.column_letter].width = max(15, len(header) + 2)
        
        # Add records with enhanced formatting
        for row, record in enumerate(records, start=9):
            # Basic info
            ws.cell(row=row, column=1).value = record.get("name", "")
            ws.cell(row=row, column=2).value = record.get("matric", "")
            ws.cell(row=row, column=3).value = record.get("department", "")
            
            # Format timestamp
            try:
                timestamp = datetime.fromisoformat(record.get("timestamp", ""))
                if not timestamp.tzinfo:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                nigeria_time = timestamp.astimezone(timezone(timedelta(hours=1)))
                formatted_time = nigeria_time.strftime("%Y-%m-%d %I:%M %p")
                ws.cell(row=row, column=4).value = formatted_time
            except Exception as e:
                logger.error(f"Error formatting timestamp: {e}")
                ws.cell(row=row, column=4).value = record.get("timestamp", "Time not available")
            
            # Status and verification info
            ws.cell(row=row, column=5).value = "Present"
            face_distance = record.get("face_distance")
            if face_distance is not None:
                confidence = round((1 - float(face_distance)) * 100, 2)
                ws.cell(row=row, column=6).value = f"{confidence}%"
            
            # Adjust column widths
            for col in range(1, 7):
                cell = ws.cell(row=row, column=col)
                current_width = ws.column_dimensions[cell.column_letter].width
                content_length = len(str(cell.value))
                if content_length + 2 > current_width:
                    ws.column_dimensions[cell.column_letter].width = content_length + 2
        
        # Create a properly formatted filename
        formatted_date = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"attendance_{session_id}_{formatted_date}.xlsx"
        temp_file = os.path.join(UPLOAD_DIR, filename)
        
        # Save with error handling
        try:
            wb.save(temp_file)
        except Exception as e:
            logger.error(f"Error saving Excel file: {e}")
            raise Exception("Failed to generate Excel file")
        
        return FileResponse(
            temp_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename
        )
    
    except Exception as e:
        logger.error(f"Error generating attendance report: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Error generating attendance report: {str(e)}"
            }
        )
    finally:
        # Clean up temporary file
        if temp_file and os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except Exception as e:
                logger.error(f"Error removing temporary file: {str(e)}")

@app.get("/attendance/{session_id}")
async def get_attendance(session_id: str):
    try:
        logger.info(f"Fetching attendance records for session: {session_id}")
        # Get all records for this session ordered by timestamp
        records = list(db.attendance.find(
            {"sessionId": session_id},
            {"_id": 0}  # Exclude MongoDB ID
        ).sort("created_at", 1))  # Sort by creation time
        
        logger.info(f"Found {len(records)} attendance records")
        
        if not records:
            logger.info(f"No records yet for session {session_id}")
            return {
                "status": "success",
                "data": {
                    "session_id": session_id,
                    "total_records": 0,
                    "records": []
                }
            }
        
        # Format the timestamps for frontend display
        for record in records:
            try:
                timestamp = datetime.fromisoformat(record["timestamp"])
                # Make sure timestamp has timezone info
                if not timestamp.tzinfo:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                # Convert to Nigeria timezone
                nigeria_time = timestamp.astimezone(timezone(timedelta(hours=1)))
                record["formattedTime"] = nigeria_time.strftime("%Y-%m-%d %H:%M:%S")
            except Exception as e:
                logger.error(f"Error formatting timestamp for record: {e}")
                record["formattedTime"] = record["timestamp"]
        
        return {
            "status": "success",
            "data": {
                "session_id": session_id,
                "total_records": len(records),
                "records": records
            }
        }
    
    except Exception as e:
        logger.error(f"Error retrieving attendance records: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Error retrieving attendance records: {str(e)}"
            }
        )

@app.get("/get-user-role")
async def get_user_role(userId: str):
    try:
        def get_user():
            return db.users.find_one({"userId": userId})

        user = db.retry_operation(get_user)
        if not user:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "detail": "User not found"}
            )

        # Convert datetime objects to ISO format strings
        registered_at = user.get("registeredAt")
        last_updated = user.get("lastUpdated")
        registered_at_str = registered_at.isoformat() if registered_at else None
        last_updated_str = last_updated.isoformat() if last_updated else None

        has_face_image = db.fs.exists({"filename": f"ref_{userId}.jpg"})
        role_data = {}
        
        if user.get("role") == "student":
            attendance_records = db.get_student_attendance(userId)
            is_registered = user.get("isRegistered", False)
            registration_complete = is_registered and has_face_image
            
            role_data = {
                "attendanceCount": len(attendance_records),
                "matricNumber": user.get("matricNumber", "") or user.get("matric", ""),
                "department": user.get("department", ""),
                "level": user.get("level", ""),
                "isRegistered": is_registered,
                "registrationComplete": registration_complete,
                "hasReferenceImage": has_face_image
            }
        elif user.get("role") == "lecturer":
            active_sessions = db.get_lecturer_sessions(userId, include_inactive=False)
            all_sessions = db.get_lecturer_sessions(userId, include_inactive=True)
            role_data = {
                "activeSessions": len(active_sessions),
                "totalSessions": len(all_sessions),
                "department": user.get("department", ""),
                "isRegistered": True
            }

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "role": user.get("role"),
                "name": user.get("name", ""),
                "email": user.get("email", ""),
                "matricNumber": user.get("matricNumber", ""),
                "department": user.get("department", ""),
                "level": user.get("level", ""),
                "registeredAt": registered_at_str,
                "lastUpdated": last_updated_str,
                "roleData": role_data,
                "isRegistered": user.get("isRegistered", False)
            }
        )
        
    except Exception as e:
        logger.error(f"Error getting user role: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Error retrieving user role: {str(e)}"
            }
        )

@app.post("/set-user-role")
async def set_user_role(request: Request):
    try:
        data = await request.json()
        userId = data.get("userId")
        email = data.get("email")
        name = data.get("name")
        role = data.get("role")
        department = data.get("department")

        # Input validation
        if not all([userId, email, name, role]):
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "detail": "Missing required fields"
                }
            )

        if role not in ["lecturer", "student"]:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "detail": "Invalid role"
                }
            )

        # Check if user exists and role change is allowed
        existing_user = db.get_user_by_id(userId)
        if existing_user and existing_user.get("role") != role:
            if existing_user.get("isRegistered"):
                return JSONResponse(
                    status_code=400,
                    content={
                        "status": "error",
                        "detail": "Cannot change role of registered user"
                    }
                )        # Prepare update document with role-specific fields
        update_doc = {
            "userId": userId,
            "email": email,
            "name": name,
            "role": role,
            "lastUpdated": datetime.utcnow()
        }

        if department:
            update_doc["department"] = department

        if not existing_user:
            update_doc["registeredAt"] = datetime.utcnow()
            if role == "lecturer":
                update_doc["isRegistered"] = True  # Lecturers are registered by default

        def update_user_role():
            return db.users.update_one(
                {"userId": userId},
                {"$set": update_doc},
                upsert=True
            )
        
        result = db.retry_operation(update_user_role)

        if result.modified_count > 0 or result.upserted_id:
            # Get updated user for response
            updated_user = db.get_user_by_id(userId)
            
            # Convert datetime objects to ISO format strings
            registered_at = updated_user.get("registeredAt")
            last_updated = updated_user.get("lastUpdated")
            
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "message": "User role updated successfully",
                    "user": {
                        "userId": userId,
                        "role": role,
                        "name": name,
                        "email": email,
                        "department": department,
                        "registeredAt": registered_at.isoformat() if registered_at else None,
                        "lastUpdated": last_updated.isoformat() if last_updated else None
                    }
                }
            )
        else:
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "detail": "Failed to update user role"
                }
            )

    except Exception as e:
        logger.error(f"Error setting user role: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error setting user role: {str(e)}"}
        )

@app.post("/end-attendance-session")
async def end_attendance_session(request: Request):
    try:
        data = await request.json()
        session_id = data.get("sessionId")
        if not session_id:
            return JSONResponse(status_code=400, content={"detail": "Missing required field: sessionId"})

        # Get session info with retry mechanism
        def get_session():
            return db.sessions.find_one({"sessionId": session_id})
        session = db.retry_operation(get_session)
        
        if not session:
            return JSONResponse(status_code=404, content={"detail": "Session not found"})
            
        if session.get("status") != "active":
            return JSONResponse(status_code=400, content={"detail": "Session is not active"})

        # Get records with retry mechanism
        def get_records():
            return list(db.attendance.find({"sessionId": session_id}).sort("created_at", 1))
        records = db.retry_operation(get_records)
        
        # Set endTime in Nigeria timezone (UTC+1)
        nigeria_time = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
        
        # Update session status with retry mechanism
        def update_session():
            result = db.sessions.update_one(
                {"sessionId": session_id},
                {
                    "$set": {
                        "status": "completed",
                        "isActive": False,
                        "endTime": nigeria_time.isoformat(),
                        "attendeeCount": len(records),
                        "downloadUrl": f"/download-attendance/{session_id}",
                        "lastUpdated": datetime.utcnow()
                    }
                }
            )
            if result.modified_count != 1:
                raise Exception("Failed to update session status")
            return result
        
        update_result = db.retry_operation(update_session)

        # Archive records with additional metadata        
        def archive_records():
            try:
                updated_count = 0
                failures = []
                
                for record in records:
                    try:
                        update_time = datetime.utcnow().replace(tzinfo=timezone.utc)
                        update_data = {
                            "sessionEndTime": nigeria_time.isoformat(),
                            "status": "completed",
                            "lastUpdated": update_time.isoformat()
                        }
                        # Update each record with session completion info and retry if needed
                        def update_record():
                            result = db.attendance.update_one(
                                {"_id": record["_id"]},
                                {"$set": update_data}
                            )
                            if result.modified_count == 0:
                                raise Exception(f"Failed to update record {record['_id']}")
                            return result
                        
                        result = db.retry_operation(update_record)
                        updated_count += 1
                    except Exception as e:
                        logger.error(f"Error updating record {record.get('_id')}: {str(e)}")
                        failures.append(str(record.get('_id')))
                        continue
                
                if failures:
                    logger.error(f"Failed to update {len(failures)} records: {failures}")
                    if updated_count == 0:
                        raise Exception(f"Failed to update any records")
                
                return updated_count
            except Exception as e:
                logger.error(f"Error in archive_records: {str(e)}")
                raise
        
        records_updated = db.retry_operation(archive_records)

        logger.info(f"Successfully ended attendance session: {session_id} with {len(records)} records")
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Attendance session ended successfully",
                "downloadUrl": f"/download-attendance/{session_id}",
                "recordCount": len(records),
                "sessionEndTime": nigeria_time.isoformat()
            }
        )

    except Exception as e:
        logger.error(f"Error ending attendance session: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Error ending attendance session: {str(e)}"
            }
        )

@app.get("/get-attendance-records")
async def get_attendance_records(userId: str):
    try:
        logger.info(f"Fetching attendance records for user: {userId}")
        user = db.users.find_one({"userId": userId})
        if not user:
            return JSONResponse(status_code=404, content={"detail": "User not found"})

        if user.get("role") == "lecturer":
            sessions = list(db.sessions.find({"hostId": userId}, {"_id": 0}).sort("created_at", -1))
            for session in sessions:
                session["attendeeCount"] = db.attendance.count_documents({"sessionId": session["sessionId"]})
                if "startTime" in session:
                    try:
                        # Format startTime in UTC+1 (Nigeria timezone)
                        start_time = datetime.fromisoformat(session["startTime"])
                        nigeria_start_time = start_time.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
                        session["startTime"] = nigeria_start_time.isoformat()
                    except Exception as e:
                        logger.error(f"Error formatting startTime: {e}")
                if "endTime" in session:
                    try:
                        # Format endTime in UTC+1 (Nigeria timezone)
                        end_time = datetime.fromisoformat(session["endTime"])
                        nigeria_end_time = end_time.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
                        session["endTime"] = nigeria_end_time.isoformat()
                    except Exception as e:
                        logger.error(f"Error formatting endTime: {e}")
            return sessions
        else:
            records = list(db.attendance.find({"userId": userId}, {"_id": 0}).sort("created_at", -1))
            for record in records:
                session = db.sessions.find_one({"sessionId": record["sessionId"]})
                if session:
                    record["hostName"] = session.get("hostName", "Unknown")
                    record["status"] = session.get("status", "completed")
            return records

    except Exception as e:
        logger.error(f"Error fetching attendance records: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(status_code=500, content={"detail": f"Error fetching attendance records: {str(e)}"})

@app.post("/register-student")
async def register_student(request: Request):
    try:
        data = await request.json()
        user_id = data.get("userId")
        matric_number = data.get("matricNumber")
        department = data.get("department")
        level = data.get("level")
        name = data.get("name")

        # Enhanced input validation
        if not all([user_id, matric_number, department, level, name]):
            missing_fields = [field for field, value in {
                "userId": user_id,
                "matricNumber": matric_number,
                "department": department,
                "level": level,
                "name": name
            }.items() if not value]
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "detail": f"Missing required fields: {', '.join(missing_fields)}"
                }
            )

        # Check if this is an update operation
        is_update = data.get("isUpdate", False)
        
        def get_existing_user():
            return db.users.find_one({"userId": user_id})
            
        existing_user = db.retry_operation(get_existing_user)
        
        # Enhanced registration validation
        if not is_update and existing_user:
            if existing_user.get("isRegistered"):
                return JSONResponse(
                    status_code=400,
                    content={
                        "status": "error",
                        "detail": "User is already registered",
                        "user": {
                            "matricNumber": existing_user.get("matricNumber"),
                            "department": existing_user.get("department"),
                            "level": existing_user.get("level"),
                            "name": existing_user.get("name")
                        }
                    }
                )

        if is_update and (not existing_user or not existing_user.get("isRegistered")):
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "detail": "User must be registered before updating"
                }
            )

        # Prepare update document with enhanced metadata
        update_doc = {
            "userId": user_id,
            "lastUpdated": datetime.utcnow(),
            "updatedBy": user_id,
            "updateSource": "web"
        }
          # Common fields for both update and registration
        update_doc.update({
            "lastUpdated": datetime.utcnow()
        })

        if is_update:
            # Only allow updating specific fields during update
            if level:
                update_doc["level"] = level
            if department:
                update_doc["department"] = department
            if name:
                update_doc["name"] = name
            if matric_number:
                update_doc["matricNumber"] = matric_number
        else:
            # For new registrations, include all fields
            update_doc.update({
                "matricNumber": matric_number,
                "department": department,
                "name": name,
                "level": level,
                "role": "student",
                "isRegistered": True,
                "registeredAt": datetime.utcnow(),
                "registrationSource": "web",
                "status": "active"
            })

        def update_user():
            return db.users.update_one(
                {"userId": user_id},
                {"$set": update_doc},
                upsert=True
            )
            
        result = db.retry_operation(update_user)

        if result.modified_count > 0 or result.upserted_id:            # Get updated user data
            updated_user = db.users.find_one({"userId": user_id})
            
            # Convert datetime objects to ISO format
            registered_at = updated_user.get("registeredAt")
            last_updated = updated_user.get("lastUpdated")

            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "message": "Student registration completed successfully",
                    "user": {
                        "userId": updated_user.get("userId"),
                        "name": updated_user.get("name"),
                        "matricNumber": updated_user.get("matricNumber"),
                        "department": updated_user.get("department"),
                        "level": updated_user.get("level"),
                        "registeredAt": registered_at.isoformat() if registered_at else None,
                        "lastUpdated": last_updated.isoformat() if last_updated else None
                    }
                }
            )
        else:
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "detail": "Failed to update user record"
                }
            )

    except Exception as e:
        logger.error(f"Error in register_student: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Registration failed: {str(e)}"
            }
        )

@app.get("/check-reference-image")
async def check_reference_image(userId: str):
    try:
        logger.info(f"Checking reference image for user: {userId}")
        
        # Check if user has a reference image in GridFS
        ref_file = db.fs.find_one({"filename": f"ref_{userId}.jpg"})
        exists = ref_file is not None
        
        logger.info(f"Reference image {'found' if exists else 'not found'} for user {userId}")
        return {"exists": exists}
        
    except Exception as e:
        logger.error(f"Error checking reference image: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error checking reference image: {str(e)}"}
        )

@app.get("/get-session-status")
async def get_session_status(sessionId: str):
    try:
        logger.info(f"Checking status for session: {sessionId}")
        
        # Input validation
        if not sessionId or sessionId == "null":
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "detail": "Invalid session ID"
                }
            )

        # Find session with retry mechanism and enhanced error handling
        def get_session():
            session = db.sessions.find_one({
                "sessionId": sessionId
            })
            if not session:
                logger.warning(f"No session found with ID: {sessionId}")
                return None
            return session
            
        session = db.retry_operation(get_session)
        if not session:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "inactive",
                    "message": "No session found",
                    "sessionId": sessionId,
                    "timestamp": datetime.utcnow().isoformat()
                }
            )

        # Enhanced session status check with explicit validation
        session_status = session.get("status", "unknown")
        is_active = session_status == "active"
        
        if not is_active:
            logger.info(f"Session {sessionId} found but not active. Status: {session_status}")
            inactive_response = {
                "status": session_status,
                "sessionId": sessionId,
                "hostId": session.get("hostId"),
                "hostName": session.get("hostName", "Unknown"),
                "isActive": False,
                "startTime": session.get("startTime"),
                "endTime": session.get("endTime"),
                "message": f"Session exists but is not active (status: {session_status})"
            }
            
            # Add completion time if session is completed
            if session_status == "completed":
                inactive_response["completedAt"] = session.get("lastUpdated", session.get("endTime"))
            
            return JSONResponse(
                status_code=200,
                content=inactive_response
            )

        # Get attendance count
        def get_attendance_count():
            return db.attendance.count_documents({"sessionId": sessionId})
            
        attendee_count = db.retry_operation(get_attendance_count)
        logger.info(f"Found {attendee_count} attendees for session {sessionId}")
        
        # Format times in Nigeria timezone
        start_time = None
        end_time = None
        
        if "startTime" in session:
            try:
                start_time = datetime.fromisoformat(session["startTime"])
                if not start_time.tzinfo:
                    start_time = start_time.replace(tzinfo=timezone.utc)
                start_time = start_time.astimezone(timezone(timedelta(hours=1)))
            except Exception as e:
                logger.error(f"Error formatting start time: {e}")
        
        if "endTime" in session:
            try:
                end_time = datetime.fromisoformat(session["endTime"])
                if not end_time.tzinfo:
                    end_time = end_time.replace(tzinfo=timezone.utc)
                end_time = end_time.astimezone(timezone(timedelta(hours=1)))
            except Exception as e:
                logger.error(f"Error formatting end time: {e}")

        # Convert created_at to ISO format string if it exists
        created_at = session.get("created_at")
        if created_at and isinstance(created_at, datetime):
            created_at = created_at.isoformat()

        response_data = {
            "status": "active",  # We know it's active if we get here
            "sessionId": sessionId,
            "hostId": session.get("hostId"),
            "hostName": session.get("hostName", "Unknown"),
            "startTime": start_time.isoformat() if start_time else None,
            "endTime": end_time.isoformat() if end_time else None,
            "attendeeCount": attendee_count,
            "isActive": True,
            "downloadUrl": f"/download-attendance/{sessionId}" if attendee_count > 0 else None,
            "created_at": created_at
        }
        
        logger.info(f"Session status response prepared for: {sessionId} with data: {response_data}")
        return JSONResponse(
            status_code=200,
            content=response_data
        )
        
    except Exception as e:
        logger.error(f"Error checking session status: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Error checking session status: {str(e)}"
            }
        )

@app.post("/check-role-selection")
async def check_role_selection(request: Request):
    try:
        data = await request.json()
        user_id = data.get("userId")
        
        if not user_id:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "detail": "Missing user ID"
                }
            )

        # Check if user already has a role
        def get_user():
            return db.users.find_one({"userId": user_id})
            
        user = db.retry_operation(get_user)
        
        if not user:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "error",
                    "detail": "User not found",
                    "needsRoleSelection": True
                }
            )

        role_data = {}
        if user.get("role") == "student":
            # For students, check if registration is complete
            is_registered = user.get("isRegistered", False)
            has_reference = db.fs.exists({"filename": f"ref_{user_id}.jpg"})
            
            role_data = {
                "isRegistered": is_registered or has_reference,
                "hasReferenceImage": has_reference,
                "registrationComplete": is_registered and has_reference,
                "nextStep": "registration" if not (is_registered and has_reference) else "home"
            }
        elif user.get("role") == "lecturer":
            # For lecturers, check if they have any sessions
            sessions_count = db.sessions.count_documents({"hostId": user_id})
            role_data = {
                "isRegistered": True,  # Lecturers don't need extra registration
                "sessionsCount": sessions_count,
                "nextStep": "home"
            }
        
        return {
            "status": "success",
            "role": user.get("role"),
            "needsRoleSelection": False,
            "roleData": role_data
        }

    except Exception as e:
        logger.error(f"Error checking role selection: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Error checking role selection: {str(e)}",
                "needsRoleSelection": True
            }
        )

app.include_router(attendance_router, tags=["attendance"])
