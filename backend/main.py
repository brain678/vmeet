from fastapi import FastAPI, UploadFile, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import os
from dotenv import load_dotenv
import face_recognition
import numpy as np
import shutil
from datetime import datetime, timedelta, timezone
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment
from pymongo import MongoClient
from gridfs import GridFS
import logging
import traceback
import sys
import time

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

# MongoDB setup with error handling
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "vmeet")
MONGODB_ATTENDANCE_COLLECTION = os.getenv("MONGODB_ATTENDANCE_COLLECTION", "attendance")

if not MONGODB_URI:
    logger.error("MONGODB_URI environment variable is not set!")
    raise ValueError("MONGODB_URI environment variable is required")

try:
    logger.info(f"Connecting to MongoDB at {MONGODB_URI}")
    mongo_client = MongoClient(MONGODB_URI)
    # Test the connection
    mongo_client.server_info()
    mongo_db = mongo_client[MONGODB_DB_NAME]
    attendance_collection = mongo_db[MONGODB_ATTENDANCE_COLLECTION]
    fs = GridFS(mongo_db)
    logger.info("Successfully connected to MongoDB")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {str(e)}")
    logger.error(traceback.format_exc())
    raise

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
async def health_check():
    try:
        # Test MongoDB connection
        mongo_client.server_info()
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
    logger.info(f"User info - Name: {name}, Matric: {matric}, Department: {department}")
    
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            logger.warning(f"Invalid file type: {file.content_type}")
            raise HTTPException(status_code=400, detail="File must be an image")

        # Save uploaded image temporarily
        file_path = os.path.join(UPLOAD_DIR, f"ref_{userId}.jpg")
        logger.info(f"Saving image to: {file_path}")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Verify the image contains a face
        logger.info("Verifying face in image")
        image = face_recognition.load_image_file(file_path)
        face_locations = face_recognition.face_locations(image)
        
        if not face_locations:
            logger.warning("No face detected in image")
            raise HTTPException(status_code=400, detail="No face detected in the image")
        
        logger.info(f"Found {len(face_locations)} faces in image")

        # Remove old image from GridFS if exists
        logger.info("Checking for existing image in GridFS")
        old_files = list(fs.find({"filename": f"ref_{userId}.jpg"}))
        for old in old_files:
            logger.info(f"Removing old image with id: {old._id}")
            fs.delete(old._id)
        
        # Store new image in GridFS
        logger.info("Storing new image in GridFS")
        with open(file_path, "rb") as f:
            file_id = fs.put(f, filename=f"ref_{userId}.jpg", userId=userId)
            logger.info(f"Image stored in GridFS with id: {file_id}")
        
        # Verify the image was stored
        stored_file = fs.find_one({"_id": file_id})
        if not stored_file:
            logger.error("Failed to verify stored image in GridFS")
            raise Exception("Failed to verify stored image")
        
        # Save user info to MongoDB with role
        logger.info("Saving user info to MongoDB")
        result = mongo_db["users"].update_one(
            {"userId": userId},
            {
                "$set": {
                    "userId": userId,
                    "name": name,
                    "matric": matric,
                    "department": department,
                    "role": "student",  # Set role as student
                    "registeredAt": datetime.utcnow(),
                    "lastUpdated": datetime.utcnow(),
                    "hasReferenceImage": True  # Add this flag
                }
            },
            upsert=True
        )
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
            content={"detail": f"Upload failed: {str(e)}"}
        )
    finally:
        # Clean up temporary file
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Cleaned up temporary file: {file_path}")
        except Exception as e:
            logger.error(f"Error cleaning up temporary file: {str(e)}")

@app.post("/verify-face")
async def verify_face(userId: str = Form(...), sessionId: str = Form(...), file: UploadFile = Form(...)):
    try:
        logger.info(f"Processing attendance verification for user {userId} in session {sessionId}")
        
        # Validate sessionId format
        if not sessionId or sessionId == "null":
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid session ID"}
            )

        # Check for existing attendance record with more details
        existing_record = attendance_collection.find_one({
            "userId": userId,
            "sessionId": sessionId
        })
        
        if existing_record:
            logger.warning(f"Duplicate attendance attempt by user {userId} for session {sessionId}")
            taken_at = existing_record.get('timestamp', 'unknown time')
            return JSONResponse(
                status_code=400,
                content={
                    "detail": f"Attendance already marked for this session at {taken_at}",
                    "timestamp": taken_at
                }
            )

        # Save the uploaded image temporarily
        temp_path = os.path.join(UPLOAD_DIR, f"{userId}-{sessionId}.jpg")
        try:
            with open(temp_path, "wb") as f:
                f.write(await file.read())

            uploaded_image = face_recognition.load_image_file(temp_path)
            uploaded_encoding = face_recognition.face_encodings(uploaded_image)
            
            if not uploaded_encoding:
                logger.warning(f"No face detected in uploaded image for user {userId}")
                return JSONResponse(status_code=400, content={"detail": "No face found in uploaded image"})
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        # Get reference image from GridFS
        ref_file_cursor = fs.find({"userId": userId})
        ref_file = next(ref_file_cursor, None)
        if not ref_file:
            logger.warning(f"No reference image found for user {userId}")
            return JSONResponse(status_code=400, content={"detail": "No reference image found. Please register your face first."})

        ref_path = os.path.join(UPLOAD_DIR, f"{userId}-ref.jpg")
        try:
            with open(ref_path, "wb") as f:
                f.write(ref_file.read())

            ref_image = face_recognition.load_image_file(ref_path)
            ref_encoding = face_recognition.face_encodings(ref_image)
            if not ref_encoding:
                logger.warning(f"No face found in reference image for user {userId}")
                return JSONResponse(status_code=400, content={"detail": "No face found in reference image."})

            # Add face distance check for better accuracy
            face_distances = face_recognition.face_distance([ref_encoding[0]], uploaded_encoding[0])
            face_distance = face_distances[0]
            results = face_recognition.compare_faces([ref_encoding[0]], uploaded_encoding[0], tolerance=0.5)
            
            if not results[0]:
                logger.warning(f"Face verification failed for user {userId}. Distance: {face_distance}")
                return JSONResponse(
                    status_code=401, 
                    content={"detail": "Face does not match. Please ensure proper lighting and camera position."}
                )
        finally:
            if os.path.exists(ref_path):
                os.remove(ref_path)

        # Fetch user info
        user_info = mongo_db["users"].find_one({"userId": userId})
        if not user_info:
            logger.warning(f"User info not found for user {userId}")
            return JSONResponse(status_code=400, content={"detail": "User information not found. Please register your face image first."})
            
        name = user_info.get("name", "")
        matric = user_info.get("matric", "")
        department = user_info.get("department", "")
        
        # Convert to Nigeria timezone (UTC+1) with proper timezone handling
        timestamp = datetime.utcnow()
        nigeria_time = timestamp.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
        
        # Save attendance record with proper timestamp and additional metadata
        attendance_record = {
            "userId": userId,
            "name": name,
            "matric": matric,
            "department": department,
            "sessionId": sessionId,
            "timestamp": nigeria_time.isoformat(),
            "created_at": datetime.utcnow(),  # For sorting
            "face_distance": float(face_distance),  # Store confidence score
            "verified": True,
            "device_info": "web"  # Track attendance source
        }
        logger.info(f"Saving attendance record: {attendance_record}")
        
        # Insert into MongoDB with retry mechanism
        max_retries = 3
        for attempt in range(max_retries):
            try:
                result = attendance_collection.insert_one(attendance_record)
                if result.inserted_id:
                    # Verify the record was saved
                    saved_record = attendance_collection.find_one({"_id": result.inserted_id})
                    if saved_record:
                        logger.info(f"Successfully recorded attendance for user {userId} in session {sessionId}")
                        return {
                            "status": "success",
                            "message": "Attendance recorded successfully",
                            "timestamp": nigeria_time.isoformat()
                        }
                break
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                logger.warning(f"Retry {attempt + 1}/{max_retries} failed: {str(e)}")
                time.sleep(1)  # Wait before retrying
            
        return JSONResponse(
            status_code=500,
            content={"detail": "Failed to save attendance record after multiple attempts"}
        )
    except Exception as e:
        logger.error(f"Error in verify-face: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": f"An error occurred: {str(e)}"}
        )

@app.post("/create-attendance-session")
async def create_attendance_session(request: Request):
    try:
        data = await request.json()
        session_id = data.get("sessionId")
        host_id = data.get("hostId")

        if not session_id or not host_id:
            return JSONResponse(
                status_code=400,
                content={"detail": "Missing required fields: sessionId or hostId"}
            )

        # Get host info
        host = mongo_db["users"].find_one({"userId": host_id})
        if not host or host.get("role") != "lecturer":
            return JSONResponse(
                status_code=403,
                content={"detail": "Only lecturers can create attendance sessions"}
            )

        # Check if session already exists
        existing_session = mongo_db["attendance_sessions"].find_one({
            "sessionId": session_id,
            "status": "active"
        })

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
            "startTime": nigeria_time.isoformat(),
            "attendeeCount": 0,
            "created_at": nigeria_time
        }

        result = mongo_db["attendance_sessions"].insert_one(session)
        
        if result.inserted_id:
            logger.info(f"Created attendance session: {session_id}")
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "sessionId": session_id,
                    "message": "Attendance session created successfully"
                }
            )
        else:
            return JSONResponse(
                status_code=500,
                content={"detail": "Failed to create attendance session"}
            )

    except Exception as e:
        logger.error(f"Error creating attendance session: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error creating attendance session: {str(e)}"}
        )

@app.get("/download-attendance/{session_id}")
async def download_attendance(session_id: str):
    try:
        logger.info(f"Fetching attendance records for session: {session_id}")
        # Get all records for this session ordered by timestamp
        records = list(attendance_collection.find(
            {"sessionId": session_id},
            {"_id": 0}  # Exclude MongoDB ID
        ).sort("created_at", 1))  # Sort by creation time
        
        logger.info(f"Found {len(records)} attendance records")
        if records:
            logger.info(f"Sample record: {records[0]}")
        
        if not records:
            logger.info(f"No attendance records yet for session {session_id}")
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "message": "Ready to download when records are available",
                    "records": []
                }
            )
        
        # Create new workbook and set up header
        wb = Workbook()
        ws = wb.active
        ws.title = "Attendance"
        
        # Add session information
        ws.merge_cells('A1:E1')
        ws['A1'] = f"Attendance Records for Session: {session_id}"
        ws['A1'].alignment = Alignment(horizontal='center')
        
        # Add timestamp information
        ws['A2'] = f"Generated at: {datetime.now(timezone(timedelta(hours=1))).strftime('%Y-%m-%d %H:%M:%S %Z')}"
        ws.merge_cells('A2:E2')
          # Set up headers
        headers = ["Name", "Matric Number", "Department", "Time", "Status"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=3, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal='center')
            # Set column width for each header
            ws.column_dimensions[ws.cell(row=3, column=col).column_letter].width = max(15, len(header) + 2)
          # Add records
        for row, record in enumerate(records, start=4):
            ws.cell(row=row, column=1).value = record.get("name", "")
            ws.cell(row=row, column=2).value = record.get("matric", "")
            ws.cell(row=row, column=3).value = record.get("department", "")
            try:
                # Parse and format timestamp in Nigeria timezone
                timestamp = datetime.fromisoformat(record.get("timestamp", ""))
                if not timestamp.tzinfo:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                nigeria_time = timestamp.astimezone(timezone(timedelta(hours=1)))
                formatted_time = nigeria_time.strftime("%Y-%m-%d %I:%M %p")
                ws.cell(row=row, column=4).value = formatted_time
            except Exception as e:
                logger.error(f"Error formatting timestamp in Excel: {e}")
                ws.cell(row=row, column=4).value = record.get("timestamp", "Time not available")
            ws.cell(row=row, column=5).value = "Present"
            
            # Adjust column widths based on content
            for col in range(1, 6):
                cell = ws.cell(row=row, column=col)
                current_width = ws.column_dimensions[cell.column_letter].width
                content_length = len(str(cell.value))
                if content_length + 2 > current_width:
                    ws.column_dimensions[cell.column_letter].width = content_length + 2
        
        # Save to a temporary file in the uploads directory
        temp_file = os.path.join(UPLOAD_DIR, f"attendance_{session_id}_{int(time.time())}.xlsx")
        wb.save(temp_file)
        
        # Create response with file download
        return FileResponse(
            temp_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"attendance_{session_id}.xlsx"
        )
    
    except Exception as e:
        logger.error(f"Error generating attendance report: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error generating attendance report: {str(e)}"}
        )

@app.get("/attendance/{session_id}")
async def get_attendance(session_id: str):
    try:
        logger.info(f"Fetching attendance records for session: {session_id}")
        # Get all records for this session ordered by timestamp
        records = list(attendance_collection.find(
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
                record["formattedTime"] = timestamp.strftime("%Y-%m-%d %H:%M:%S")
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
        user = mongo_db["users"].find_one({"userId": userId})
        if not user:
            return JSONResponse(
                status_code=404,
                content={"detail": "User not found"}
            )
        
        # Return user data including registration status and profile info
        return {
            "role": user.get("role", None),
            "isRegistered": user.get("isRegistered", False),
            "matricNumber": user.get("matricNumber", ""),
            "department": user.get("department", ""),
            "level": user.get("level", ""),
            "name": user.get("name", ""),
            "registeredAt": user.get("registeredAt", None),
            "lastUpdated": user.get("lastUpdated", None)
        }
    except Exception as e:
        logger.error(f"Error getting user role: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error retrieving user role: {str(e)}"}
        )

@app.post("/set-user-role")
async def set_user_role(request: Request):
    try:
        data = await request.json()
        userId = data.get("userId")
        email = data.get("email")
        name = data.get("name")
        role = data.get("role")

        if not all([userId, email, name, role]):
            return JSONResponse(
                status_code=400,
                content={"detail": "Missing required fields"}
            )

        if role not in ["lecturer", "student"]:
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid role"}
            )

        result = mongo_db["users"].update_one(
            {"userId": userId},
            {
                "$set": {
                    "userId": userId,
                    "email": email,
                    "name": name,
                    "role": role,
                    "registeredAt": datetime.utcnow(),
                    "lastUpdated": datetime.utcnow()
                }
            },
            upsert=True
        )

        return {"status": "success", "role": role}
    except Exception as e:
        logger.error(f"Error setting user role: {str(e)}")
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

        # Get session info
        session = mongo_db["attendance_sessions"].find_one({"sessionId": session_id, "status": "active"})
        if not session:
            return JSONResponse(status_code=404, content={"detail": "No active session found with this ID"})        # Update session status with proper timezone handling
        records = list(attendance_collection.find({"sessionId": session_id}).sort("created_at", 1))
        # Set endTime in Nigeria timezone (UTC+1)
        nigeria_time = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
        mongo_db["attendance_sessions"].update_one(
            {"sessionId": session_id},
            {
                "$set": {
                    "status": "completed",
                    "endTime": nigeria_time.isoformat(),
                    "attendeeCount": len(records),
                    "downloadUrl": f"/download-attendance/{session_id}"
                }
            }
        )

        logger.info(f"Ended attendance session: {session_id} with {len(records)} records")
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Attendance session ended successfully",
                "downloadUrl": f"/download-attendance/{session_id}",
                "recordCount": len(records)
            }
        )

    except Exception as e:
        logger.error(f"Error ending attendance session: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(status_code=500, content={"detail": f"Error ending attendance session: {str(e)}"})

@app.get("/get-attendance-records")
async def get_attendance_records(userId: str):
    try:
        logger.info(f"Fetching attendance records for user: {userId}")
        user = mongo_db["users"].find_one({"userId": userId})
        if not user:
            return JSONResponse(status_code=404, content={"detail": "User not found"})

        if user.get("role") == "lecturer":
            sessions = list(mongo_db["attendance_sessions"].find({"hostId": userId}, {"_id": 0}).sort("created_at", -1))
            for session in sessions:
                session["attendeeCount"] = attendance_collection.count_documents({"sessionId": session["sessionId"]})
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
            records = list(attendance_collection.find({"userId": userId}, {"_id": 0}).sort("created_at", -1))
            for record in records:
                session = mongo_db["attendance_sessions"].find_one({"sessionId": record["sessionId"]})
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

        if not all([user_id, matric_number, department, level, name]):
            return JSONResponse(
                status_code=400,
                content={"detail": "Missing required fields"}
            )

        # Check if this is an update operation
        is_update = data.get("isUpdate", False)
        existing_user = mongo_db["users"].find_one({"userId": user_id})
        
        # Validate registration status
        if not is_update and existing_user and existing_user.get("isRegistered"):
            return JSONResponse(
                status_code=400,
                content={"detail": "User is already registered"}
            )
        if is_update and (not existing_user or not existing_user.get("isRegistered")):
            return JSONResponse(
                status_code=400,
                content={"detail": "User must be registered before updating"}
            )        # Prepare update document
        update_doc = {
            "userId": user_id,
            "level": level,  # Only level can be updated
            "lastUpdated": datetime.utcnow()
        }
        
        # For new registrations, include all fields
        if not is_update:
            update_doc.update({
                "matricNumber": matric_number,
                "department": department,
                "name": name,
                "role": "student",
                "isRegistered": True
            })
        
        # For new registrations, add registeredAt
        if not is_update:
            update_doc["registeredAt"] = datetime.utcnow()
        
        # Update/create user document
        result = mongo_db["users"].update_one(
            {"userId": user_id},
            {"$set": update_doc},
            upsert=True
        )

        if result.modified_count > 0 or result.upserted_id:
            return {
                "status": "success",
                "message": "Student registration completed successfully"
            }
        else:
            return JSONResponse(
                status_code=500,
                content={"detail": "Failed to update user record"}
            )

    except Exception as e:
        logger.error(f"Error in register_student: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": f"Registration failed: {str(e)}"}
        )

@app.get("/check-reference-image")
async def check_reference_image(userId: str):
    try:
        logger.info(f"Checking reference image for user: {userId}")
        
        # Check if user has a reference image in GridFS
        ref_file = fs.find_one({"filename": f"ref_{userId}.jpg"})
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
        
        # Find active session
        session = mongo_db["attendance_sessions"].find_one({
            "sessionId": sessionId,
            "status": "active"
        })
        
        if not session:
            logger.warning(f"No active session found with ID: {sessionId}")
            return {
                "status": "inactive",
                "message": "Session not found or not active"
            }
        
        logger.info(f"Found active session: {sessionId}")
        return {
            "status": "active",
            "sessionId": sessionId,
            "startTime": session.get("startTime"),
            "hostName": session.get("hostName", "Unknown")
        }
        
    except Exception as e:
        logger.error(f"Error checking session status: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error checking session status: {str(e)}"}
        )
