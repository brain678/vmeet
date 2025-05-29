from fastapi import FastAPI, UploadFile, Form, HTTPException
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
    try:
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

        # Remove old image from GridFS if exists
        logger.debug("Checking for existing image in GridFS")
        for old in fs.find({"filename": f"ref_{userId}.jpg"}):
            logger.debug(f"Removing old image with id: {old._id}")
            fs.delete(old._id)
        
        # Store new image in GridFS
        logger.debug("Storing new image in GridFS")
        with open(file_path, "rb") as f:
            file_id = fs.put(f, filename=f"ref_{userId}.jpg", userId=userId)
            logger.info(f"Image stored in GridFS with id: {file_id}")
        
        # Save user info to MongoDB
        logger.debug("Saving user info to MongoDB")
        result = mongo_db["users"].update_one(
            {"userId": userId},
            {
                "$set": {
                    "userId": userId,
                    "name": name,
                    "matric": matric,
                    "department": department,
                    "registeredAt": datetime.utcnow(),
                    "lastUpdated": datetime.utcnow()
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
        ref_file = fs.find_one({"userId": userId})
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
        for col, header in enumerate(headers, start=1):
            cell = ws.cell(row=3, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal='center')
        
        # Add records
        for row, record in enumerate(records, start=4):
            ws.cell(row=row, column=1).value = record.get("name", "")
            ws.cell(row=row, column=2).value = record.get("matric", "")
            ws.cell(row=row, column=3).value = record.get("department", "")
            ws.cell(row=row, column=4).value = datetime.fromisoformat(record.get("timestamp")).strftime("%Y-%m-%d %H:%M:%S")
            ws.cell(row=row, column=5).value = "Present"
        
        # Auto-adjust column widths
        for column in ws.columns:
            max_length = 0
            column = list(column)
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = (max_length + 2)
            ws.column_dimensions[column[0].column_letter].width = adjusted_width
        
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
