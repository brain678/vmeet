# --- PATCH: Add time limit support to session creation and enforce in get-session-status ---
import time
import os
import sys
import shutil
import logging
import traceback
import random
import requests
import cv2
from fastapi import FastAPI, UploadFile, Form, HTTPException, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from gridfs import GridFS
from database import db
from attendance_utils import (
    count_present_attendance,
    increment_session_attendee_count,
    present_attendance_query,
)
from face_verification import get_face_verifier
import io
import base64
from routes.attendance import router as attendance_router
from routes.admin_sessions import router as admin_sessions_router
from routes.courses import router as courses_router
from routes.schedule import router as schedule_router
from scheduler import initialize_scheduler

from fastapi import FastAPI

app = FastAPI()


def has_embedding(val) -> bool:
    """Safe check whether an embedding-like value is present.
    Avoids evaluating NumPy arrays directly in boolean context.
    """
    try:
        if val is None:
            return False
        # If value has length, treat non-empty as present
        if hasattr(val, "__len__"):
            return len(val) > 0
        return True
    except Exception:
        return True

@app.post("/start-geofence-session")
async def start_geofence_session(request: Request):
    try:
        data = await request.json()
        host_id = data.get("hostId")
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        time_limit = data.get("timeLimit")
        course_code = data.get("courseCode")

        if not host_id or latitude is None or longitude is None or not course_code:
            raise HTTPException(status_code=400, detail="Missing required fields")

        # Generate unique session ID and 4-digit code
        session_id = f"geo-{int(time.time())}"
        session_code = "{:04d}".format(random.randint(0, 9999))
        nigeria_time = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))

        session = {
            "sessionId": session_id,
            "sessionCode": session_code,
            "hostId": host_id,
            "courseCode": course_code,
            "latitude": latitude,
            "longitude": longitude,
            "radius": 100,  # Changed from 200 to 100 meters
            "status": "active",
            "isActive": True,
            "startTime": nigeria_time.isoformat(),
            "attendeeCount": 0,
            "created_at": nigeria_time.isoformat(),  # Use nigeria_time for created_at
            "createdAt": nigeria_time.isoformat()  # Include both formats for compatibility
        }
        
        if time_limit is not None and str(time_limit).strip() != '':
            try:
                session["timeLimit"] = int(time_limit)
            except Exception as e:
                logger.error(f"Invalid timeLimit value: {time_limit} | Error: {e}")
                
        logger.info(f"Creating new session with data: {session}")
        db.sessions.insert_one(session)
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "sessionId": session_id,
                "sessionCode": session_code,
                "courseCode": course_code
            }
        )
    except Exception as e:
        logger.error(f"Error starting geofence session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# --- PATCH: Enforce time limit in get-session-status ---
# (No duplicate definition; keep only one get_session_status endpoint)

def add_verify_face_no_session(app):
    @app.post("/verify-face-no-session")
    async def verify_face_no_session(userId: str = Form(...), file: UploadFile = Form(...)):
        try:
            # Read uploaded verification image into memory
            image_bytes = await file.read()

            # Retrieve reference image record
            def get_reference_image():
                return db.fs.find_one({"filename": f"ref_{userId}.jpg"})

            ref_file = db.retry_operation(get_reference_image)
            if not ref_file:
                return JSONResponse(status_code=404, content={"status": "error", "reason": "reference_missing", "message": "Reference image not found"})

            # Prefer cached embedding on user document
            user_doc = db.users.find_one({"userId": userId})
            fv = get_face_verifier()

            ref_embedding = None
            import time as _time
            if user_doc and has_embedding(user_doc.get("faceEmbedding")):
                ref_embedding = user_doc.get("faceEmbedding")
            else:
                # Read reference bytes from GridFS and compute embedding in-memory
                ref_bytes = db.fs.get(ref_file._id).read()
                _start_ref = _time.perf_counter()
                ref_embedding = fv.get_embedding_from_image_bytes(ref_bytes)
                _ref_time = (_time.perf_counter() - _start_ref) * 1000.0
                logger.info(f"verify_face_no_session: reference embedding time: {_ref_time:.1f}ms for user {userId}")
                # Cache embedding back to user document
                if ref_embedding is not None:
                    try:
                        db.users.update_one({"userId": userId}, {"$set": {"faceEmbedding": ref_embedding}})
                        logger.info(f"verify_face_no_session: cached reference embedding for user {userId}")
                    except Exception as _e:
                        logger.warning(f"verify_face_no_session: failed to cache reference embedding for user {userId}: {_e}")

            _start_verify = _time.perf_counter()
            verify_embedding = fv.get_embedding_from_image_bytes(image_bytes)
            _verify_time = (_time.perf_counter() - _start_verify) * 1000.0
            logger.info(f"verify_face_no_session: verification embedding time: {_verify_time:.1f}ms for user {userId}")
            if ref_embedding is None or verify_embedding is None:
                try:
                    ref_present = has_embedding(ref_embedding)
                    verify_present = has_embedding(verify_embedding)
                except Exception:
                    ref_present = ref_embedding is not None
                    verify_present = verify_embedding is not None
                logger.warning(f"verify_face_no_session: ref_embedding_present={ref_present}, verify_embedding_present={verify_present}")
                return JSONResponse(status_code=400, content={"status": "error", "reason": "no_face_detected", "message": "No face detected in one of the images"})

            cosine_threshold = float(os.getenv('FACE_COSINE_THRESHOLD', '0.4'))
            comparison = fv.compare_embeddings(ref_embedding, verify_embedding, cosine_threshold=cosine_threshold)
            if comparison.get("match"):
                return JSONResponse(status_code=200, content={"status": "success", "message": "Face verified successfully"})
            else:
                return JSONResponse(status_code=401, content={"status": "error", "reason": "identity_mismatch", "message": "Face does not match reference image"})

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in verify_face_no_session: {str(e)}")
            logger.error(traceback.format_exc())
            return JSONResponse(status_code=500, content={"status": "error", "reason": "internal_error", "message": f"Error verifying face: {str(e)}"})

import time
from fastapi import FastAPI, UploadFile, Form, HTTPException, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
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
import numpy as np
from routes.attendance import router as attendance_router
from routes.auth import router as auth_router
from routes.auto_scheduler import start_auto_scheduler, auto_start_scheduled_sessions, auto_complete_sessions
import asyncio

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
# app is already created above, so this is redundant and should be removed.
load_dotenv()

# Clerk configuration
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CLERK_API_URL = "https://api.clerk.com/v1"

def delete_clerk_user(clerk_user_id: str) -> bool:
    """Delete a user from Clerk"""
    if not CLERK_SECRET_KEY:
        logger.warning("CLERK_SECRET_KEY not configured, skipping Clerk user deletion")
        return False
    
    try:
        headers = {
            "Authorization": f"Bearer {CLERK_SECRET_KEY}",
            "Content-Type": "application/json"
        }
        response = requests.delete(
            f"{CLERK_API_URL}/users/{clerk_user_id}",
            headers=headers
        )
        
        if response.status_code == 204:
            logger.info(f"Successfully deleted Clerk user: {clerk_user_id}")
            return True
        elif response.status_code == 404:
            logger.warning(f"Clerk user not found: {clerk_user_id}")
            return True  # User doesn't exist, consider it successful
        else:
            logger.error(f"Error deleting Clerk user {clerk_user_id}: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        logger.error(f"Exception deleting Clerk user {clerk_user_id}: {str(e)}")
        return False

app = FastAPI()
app = FastAPI()

add_verify_face_no_session(app)

# Configure CORS
allowed_origins = [
    "https://vmeetnew.vercel.app",  # Add your Vercel domain here
    "http://192.168.0.118:3000",    # Add your LAN IP for frontend
    "http://192.168.0.114:3000",    # Add other LAN IPs if needed
    "https://cool-snapper-hip.ngrok-free.app",  # Your static ngrok HTTPS domain
    "*"  # Allow all origins for development (remove in production)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize session scheduler on startup
@app.on_event("startup")
async def startup_event():
    """Initialize background schedulers for automatic session management"""
    try:
        scheduler = initialize_scheduler()
        if scheduler:
            logger.info("Background session scheduler initialized on startup")
        else:
            logger.warning("Failed to initialize session scheduler")
        
        # Start auto-scheduler for automatically starting scheduled sessions
        try:
            asyncio.create_task(auto_start_scheduled_sessions())
            logger.info("Auto-start scheduler for scheduled sessions initialized")
        except Exception as e:
            logger.error(f"Error starting auto-scheduler: {str(e)}")
        
        # Start auto-complete scheduler for automatically ending sessions when time limit expires
        try:
            asyncio.create_task(auto_complete_sessions())
            logger.info("Auto-complete scheduler for session time limits initialized")
        except Exception as e:
            logger.error(f"Error starting auto-complete scheduler: {str(e)}")
    except Exception as e:
        logger.error(f"Error during startup scheduler initialization: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up scheduler on shutdown"""
    try:
        from scheduler import SessionScheduler
        scheduler = SessionScheduler()
        scheduler.stop()
        logger.info("Session scheduler stopped on shutdown")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")

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

@app.post("/upload-profile-image")
async def upload_profile_image(
    userId: str = Form(...),
    file: UploadFile = Form(...)
):
    """Store a lecturer/student profile photo without running face-verification checks."""
    logger.info(f"Received profile image upload request for user: {userId}")

    try:
        if not userId:
            raise HTTPException(status_code=400, detail="User ID is required")

        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")

        image_bytes = await file.read()
        mime_type = file.content_type or 'image/jpeg'
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        data_url = f"data:{mime_type};base64,{base64_image}"

        def update_user():
            return db.users.update_one(
                {"userId": userId},
                {"$set": {
                    "profilePicture": data_url,
                    "lastProfilePicUpdate": datetime.utcnow(),
                    "lastUpdated": datetime.utcnow()
                }},
                upsert=True
            )

        result = db.retry_operation(update_user)
        logger.info(f"Profile photo stored for user {userId}: modified={result.modified_count}, upserted={result.upserted_id is not None}")

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Profile photo uploaded successfully",
                "userId": userId,
                "profilePicture": data_url
            }
        )

    except HTTPException as he:
        logger.error(f"HTTP exception in upload_profile_image: {str(he)}")
        raise he
    except Exception as e:
        logger.error(f"Error in upload_profile_image: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"An error occurred while uploading the profile photo: {str(e)}"
            }
        )


@app.post("/upload-face-image")
async def upload_face_image(
    userId: str = Form(...),
    name: str = Form(""),
    matric: str = Form(""),
    department: str = Form(""),
    file: UploadFile = Form(...)
):
    logger.info(f"Received face image upload request for user: {userId}")
    face_verifier = get_face_verifier()
    
    try:
        # Validate required input
        if not userId:
            raise HTTPException(status_code=400, detail="User ID is required")
            
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")

        # Read uploaded image into memory (avoid disk I/O)
        image_bytes = await file.read()

        # Verify face quality with enhanced security checks using in-memory bytes
        logger.debug("Verifying face quality and liveness (in-memory)...")
        verification_result = face_verifier.verify_face_quality_from_bytes(image_bytes)
        
        if not verification_result.get("valid", False):
            logger.warning(f"Face verification failed: {verification_result.get('reason')}")
            raise HTTPException(
                status_code=400, 
                detail=f"Face verification failed: {verification_result.get('reason')}"
            )
        
        # Check confidence score
        confidence = verification_result.get("confidence", 0)
        if confidence < 0.55:  # Lowered from 0.65 due to frontend liveness verification
            logger.warning(f"Face confidence too low: {confidence}")
            raise HTTPException(
                status_code=400,
                detail=f"Face quality not sufficient. Please ensure good lighting and clear face. (Confidence: {confidence:.2%})"
            )
        
        logger.info(f"Face verified successfully. Confidence: {confidence:.2%}, Spoof Score: {verification_result.get('spoof_score', 0):.2%}")

        # Compute and cache embedding for the reference image to avoid reprocessing later
        try:
            import time as _time
            _start_up_emb = _time.perf_counter()
            embedding = face_verifier.get_embedding_from_image_bytes(image_bytes)
            _emb_time = (_time.perf_counter() - _start_up_emb) * 1000.0
            logger.info(f"upload_face_image: embedding extraction time: {_emb_time:.1f}ms for user {userId}")
            if embedding is None:
                logger.warning("upload_face_image: embedding could not be computed for reference image")
        except Exception as e:
            logger.warning(f"upload_face_image: error computing embedding: {e}")
            embedding = None
        def store_in_gridfs():
            # Remove old image from GridFS if exists
            for old in db.fs.find({"filename": f"ref_{userId}.jpg"}):
                db.fs.delete(old._id)

            # Store new image in GridFS using in-memory bytes
            bio = io.BytesIO(image_bytes)
            file_id = db.fs.put(bio, filename=f"ref_{userId}.jpg", userId=userId, uploadedAt=datetime.utcnow())
            stored_file = db.fs.find_one({"_id": file_id})
            if not stored_file:
                raise Exception("Failed to verify stored image")
            return file_id

        # Retry GridFS operation if needed
        file_id = db.retry_operation(store_in_gridfs)
        
        # Save user info to MongoDB with verification metadata
        def update_user():
            update_doc = {
                "userId": userId,
                "name": name,
                "matric": matric,
                "department": department,
                "role": "student",
                "registeredAt": datetime.utcnow(),
                "lastUpdated": datetime.utcnow(),
                "hasReferenceImage": True,
                "faceVerification": {
                    "verified": True,
                    "confidence": confidence,
                    "verifiedAt": datetime.utcnow(),
                    "lightingQuality": verification_result.get("lighting_quality", 0),
                    "spoofScore": verification_result.get("spoof_score", 0)
                }
            }
            if embedding is not None:
                update_doc["faceEmbedding"] = embedding

            return db.users.update_one(
                {"userId": userId},
                {"$set": update_doc},
                upsert=True
            )

        result = db.retry_operation(update_user)
        logger.info(f"MongoDB update result - Modified: {result.modified_count}, Upserted: {result.upserted_id is not None}")
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Face image verified and uploaded successfully",
                "userId": userId,
                "name": name,
                "verification": {
                    "confidence": confidence,
                    "lightingQuality": verification_result.get("lighting_quality", 0),
                    "spoofDetection": "Passed" if verification_result.get("spoof_score", 0) < 0.5 else "Warning"
                }
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
        # Nothing to clean up — we used in-memory buffers
        pass

@app.post("/verify-face")
async def verify_face(userId: str = Form(...), sessionId: str = Form(...), file: UploadFile = Form(...)):
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

        # Read uploaded verification image into memory (avoid disk I/O)
        image_bytes = await file.read()

        # Process verification image using FaceVerifier (in-memory)
        try:
            fv = get_face_verifier()
            logger.debug("verify_face: processing verification image in-memory")
            import time as _time
            _start = _time.perf_counter()
            verify_encoding = fv.get_embedding_from_image_bytes(image_bytes)
            _embed_time = (_time.perf_counter() - _start) * 1000.0
            logger.info(f"verify_face: embedding extraction time: {_embed_time:.1f}ms for user {userId}")
            if verify_encoding is None:
                logger.warning("verify_face: no embedding for verification image")
                raise HTTPException(status_code=400, detail={"status": "error", "reason": "no_face_detected", "message": "No face detected in the verification image"})
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"verify_face: exception during processing verification image: {e}")
            raise HTTPException(status_code=400, detail={"status": "error", "reason": "processing_error", "message": str(e)})

        # Prefer cached embedding from user document to avoid reprocessing reference image
        def get_user_info():
            return db.users.find_one({"userId": userId})

        user_info = db.retry_operation(get_user_info)
        if not user_info:
            raise HTTPException(status_code=404, detail="User information not found")
        ref_encoding = None
        if has_embedding(user_info.get("faceEmbedding")):
            logger.debug("verify_face: using cached faceEmbedding from user document")
            ref_encoding = user_info.get("faceEmbedding")
        else:
            # Fallback: retrieve reference image from GridFS and compute embedding
            def get_reference_image():
                ref_file = db.fs.find_one({"filename": f"ref_{userId}.jpg"})
                if not ref_file:
                    raise HTTPException(status_code=404, detail="No reference image found. Please register first.")
                return ref_file

            ref_file = db.retry_operation(get_reference_image)
            # Retrieve reference image bytes from GridFS and compute embedding in-memory
            try:
                ref_bytes = db.fs.get(ref_file._id).read()
                fv = get_face_verifier()
                import time as _time
                _start_ref = _time.perf_counter()
                ref_encoding = fv.get_embedding_from_image_bytes(ref_bytes)
                _ref_time = (_time.perf_counter() - _start_ref) * 1000.0
                logger.info(f"verify_face: reference embedding extraction time: {_ref_time:.1f}ms for user {userId}")
                if ref_encoding is None:
                    logger.warning("verify_face: no embedding for reference image (GridFS)")
                    raise HTTPException(status_code=500, detail={"status": "error", "reason": "reference_embedding_missing", "message": "Error processing reference image: embedding not found"})
                # Store computed reference embedding back to user document for caching (migration)
                try:
                    db.users.update_one({"userId": userId}, {"$set": {"faceEmbedding": ref_encoding}})
                    logger.info(f"verify_face: cached reference embedding for user {userId}")
                except Exception as _e:
                    logger.warning(f"verify_face: failed to cache reference embedding for user {userId}: {_e}")
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"verify_face: exception during processing reference image: {e}")
                raise HTTPException(status_code=500, detail={"status": "error", "reason": "reference_processing_error", "message": str(e)})

        # Verify face match using embeddings (cosine similarity)
        cosine_threshold = float(os.getenv('FACE_COSINE_THRESHOLD', '0.4'))
        import time as _time
        _start_cmp = _time.perf_counter()
        comparison = fv.compare_embeddings(ref_encoding, verify_encoding, cosine_threshold=cosine_threshold)
        _cmp_time = (_time.perf_counter() - _start_cmp) * 1000.0
        face_distance = comparison.get("distance", 1.0)
        logger.info(f"verify_face: comparison time: {_cmp_time:.1f}ms for user {userId}")

        if not comparison.get("match"):
            return JSONResponse(
                status_code=401,
                content={"status": "error", "reason": "identity_mismatch", "message": "Face verification failed. Identity does not match reference."}
            )

        # user_info was retrieved earlier (and validated); reuse it here

        # Record attendance with timezone handling
        nigeria_time = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
        attendance_record = {
            "userId": userId,
            "name": user_info.get("name", ""),
            "matric": user_info.get("matric", ""),
            "department": user_info.get("department", ""),
            "sessionId": sessionId,
            "attendanceStatus": "present",
            "timestamp": nigeria_time.isoformat(),
            "created_at": datetime.utcnow(),
            "face_distance": float(face_distance),
            "verified": True,
            "device_info": "web"
        }

        # Save attendance record with retry and update session
        def save_attendance():
            # Insert attendance record
            try:
                result = db.attendance.insert_one(attendance_record)
            except DuplicateKeyError:
                raise HTTPException(status_code=400, detail="Attendance already marked for this session")
            if not result.inserted_id:
                raise Exception("Failed to save attendance record")
                
            # Update session with new attendee count
            increment_session_attendee_count(db, sessionId)
                
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
        class_title = data.get("classTitle")

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
            )

        # Create new session with proper timezone handling and class title
        nigeria_time = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
        
        session = {
            "sessionId": session_id,
            "hostId": host_id,
            "hostName": host.get("name", "Unknown"),  # Use the lecturer's name from their profile
            "classTitle": class_title,
            "status": "active",
            "isActive": True,
            "startTime": nigeria_time.isoformat(),
            "attendeeCount": 0,
            "created_at": nigeria_time.isoformat(),
            "createdAt": nigeria_time.isoformat()  # Include both formats for compatibility
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
                "classTitle": class_title,
                "message": "Attendance session created successfully"
            }
        )

    except Exception as e:
        logger.error(f"Error creating attendance session: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Failed to create attendance session: {str(e)}"
            }
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
        present_count = count_present_attendance(db, session_id)
        
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
        ws['A5'] = f"Total Present: {present_count}"
        ws['A6'] = f"Generated at: {datetime.now(timezone(timedelta(hours=1))).strftime('%Y-%m-%d %H:%M:%S %Z')}"
        
        # Start data from row 8
        headers = ["Name", "Matric Number", "Department", "Time", "Status", "Verification Score"]
        for col, header in enumerate(headers, start=1):
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
                if not record.get("timestamp"):
                    raise ValueError("No attendance timestamp")
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
            attendance_status = record.get("attendanceStatus", "present")
            ws.cell(row=row, column=5).value = attendance_status.title()
            face_distance = record.get("face_distance")
            if attendance_status == "present" and face_distance is not None:
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
        last_courses_update = user.get("lastCoursesUpdate")
        registered_at_str = registered_at.isoformat() if registered_at else None
        last_updated_str = last_updated.isoformat() if last_updated else None
        last_courses_update_str = last_courses_update.isoformat() if last_courses_update else None

        has_face_image = db.fs.exists({"filename": f"ref_{userId}.jpg"})
        profile_picture = user.get("profilePicture") or user.get("imageUrl") or ""
        role_data = {}
        
        # Get full course details if user has courses
        courses_data = []
        user_courses = user.get("courses", [])
        if user_courses:
            for course_id in user_courses:
                course = db.courses.find_one({"_id": ObjectId(course_id) if isinstance(course_id, str) and len(course_id) == 24 else course_id})
                if course:
                    courses_data.append({
                        "_id": str(course.get("_id", "")),
                        "code": course.get("code", ""),
                        "title": course.get("title", "")
                    })
        
        if user.get("role") == "student":
            attendance_records = db.get_student_attendance(userId)
            is_registered = user.get("isRegistered", False)
            registration_complete = is_registered and has_face_image
            
            role_data = {
                "attendanceCount": sum(1 for record in attendance_records if record.get("attendanceStatus", "present") == "present"),
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
                "courses": courses_data,
                "registeredAt": registered_at_str,
                "lastUpdated": last_updated_str,
                "lastProfilePicUpdate": last_updated_str,
                "profilePicture": profile_picture,
                "lastCoursesUpdate": last_courses_update_str,
                "roleData": role_data,
                "isRegistered": user.get("isRegistered", False),
                "_id": str(user.get("_id", "")),
                "userId": user.get("userId", ""),
                "isRestricted": user.get("isRestricted", False),
                "onboardingCompleted": user.get("onboardingCompleted", True)
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


@app.get("/onboarding-status")
async def get_onboarding_status(userId: str):
    """Return whether a user should see first-time onboarding."""
    try:
        if not userId:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "detail": "Missing userId"}
            )

        def get_user():
            return db.users.find_one({"userId": userId})

        user = db.retry_operation(get_user)
        if not user:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "detail": "User not found"}
            )

        onboarding_completed = user.get("onboardingCompleted", True)

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "needsOnboarding": onboarding_completed is False,
                "onboardingCompleted": onboarding_completed,
            },
        )
    except Exception as e:
        logger.error(f"Error fetching onboarding status: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Error fetching onboarding status: {str(e)}",
            },
        )


@app.post("/complete-onboarding")
async def complete_onboarding(request: Request):
    """Mark first-time onboarding as completed for a user."""
    try:
        data = await request.json()
        user_id = data.get("userId")

        if not user_id:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "detail": "Missing userId"}
            )

        def mark_complete():
            return db.users.update_one(
                {"userId": user_id},
                {
                    "$set": {
                        "onboardingCompleted": True,
                        "onboardingCompletedAt": datetime.utcnow(),
                        "lastUpdated": datetime.utcnow(),
                    }
                },
            )

        result = db.retry_operation(mark_complete)
        if result.matched_count == 0:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "detail": "User not found"}
            )

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Onboarding completed",
                "onboardingCompleted": True,
            },
        )
    except Exception as e:
        logger.error(f"Error completing onboarding: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Error completing onboarding: {str(e)}",
            },
        )

@app.get("/get-lecturer-courses")
async def get_lecturer_courses(userId: str):
    """Get all courses assigned to a lecturer with course details"""
    try:
        def get_user():
            return db.users.find_one({"userId": userId})

        user = db.retry_operation(get_user)
        if not user:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "detail": "Lecturer not found"}
            )

        if user.get("role") != "lecturer":
            return JSONResponse(
                status_code=403,
                content={"status": "error", "detail": "User is not a lecturer"}
            )

        course_ids = user.get("courses", [])
        courses_list = []
        
        # Fetch full course details for each course ID
        for course_id in course_ids:
            try:
                # Convert string ID to ObjectId if necessary
                obj_id = ObjectId(course_id) if isinstance(course_id, str) else course_id
                course = db.courses.find_one({"_id": obj_id})
                if course:
                    courses_list.append({
                        "code": course.get("code", ""),
                        "title": course.get("title", ""),
                        "id": str(course.get("_id", ""))
                    })
            except Exception as e:
                logger.warning(f"Error fetching course {course_id}: {str(e)}")
                continue
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "courses": courses_list,
                "count": len(courses_list)
            }
        )

    except Exception as e:
        logger.error(f"Error getting lecturer courses: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Error retrieving lecturer courses: {str(e)}"
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
        courses = data.get("courses", [])

        # Log incoming data
        logger.info(f"Received set-user-role request: userId={userId}, role={role}, department={department}, courses={courses}")

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
            "name": name,  # Store the lecturer's name
            "role": role,
            "lastUpdated": datetime.utcnow()
        }

        if department:
            update_doc["department"] = department

        # Handle courses for lecturer registration
        if courses and isinstance(courses, list) and len(courses) > 0:
            update_doc["courses"] = courses
            update_doc["lastCoursesUpdate"] = datetime.utcnow()

        if not existing_user:
            update_doc["registeredAt"] = datetime.utcnow()
            update_doc["onboardingCompleted"] = False
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
            
            # Log the saved data for verification
            logger.info(f"User {userId} registered as {role}")
            logger.info(f"Department: {department}")
            logger.info(f"Courses: {courses}")
            logger.info(f"Saved user data: {updated_user}")
            
            # Convert datetime objects to ISO format
            registered_at = updated_user.get("registeredAt")
            last_updated = updated_user.get("lastUpdated")
            last_courses_update = updated_user.get("lastCoursesUpdate")
            
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
                        "courses": updated_user.get("courses", []),
                        "registeredAt": registered_at.isoformat() if registered_at else None,
                        "lastUpdated": last_updated.isoformat() if last_updated else None,
                        "lastCoursesUpdate": last_courses_update.isoformat() if last_courses_update else None
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

@app.post("/initialize-user-from-google")
async def initialize_user_from_google(request: Request):
    """
    Initialize a user record in MongoDB after Google OAuth signup.
    Called immediately after Clerk authenticates the user with Google.
    This ensures the user exists in our system from the start.
    """
    try:
        data = await request.json()
        userId = data.get("userId")
        email = data.get("email")
        name = data.get("name")
        firstName = data.get("firstName")
        lastName = data.get("lastName")

        # Input validation
        if not userId or not email:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "detail": "userId and email are required"
                }
            )

        # Use provided name, or construct from firstName/lastName
        fullName = name or f"{firstName or ''} {lastName or ''}".strip() or "User"

        # Check if user already exists
        existing_user = db.get_user_by_id(userId)
        if existing_user:
            logger.info(f"User {userId} already exists in MongoDB, skipping initialization")
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "message": "User already initialized",
                    "user": {
                        "userId": userId,
                        "email": email,
                        "name": existing_user.get("name"),
                        "role": existing_user.get("role")
                    }
                }
            )

        # Create initial lightweight user record
        initial_user_doc = {
            "userId": userId,
            "email": email,
            "name": fullName,
            "createdAt": datetime.utcnow(),
            "registeredAt": datetime.utcnow(),
            "lastUpdated": datetime.utcnow(),
            "signupMethod": "google",
            "status": "active",
            "isRegistered": False,  # Not registered until role selection
            "registrationSource": "google-oauth",
            "onboardingCompleted": False,
        }

        logger.info(f"Initializing new Google user: {userId} with email: {email}")

        def create_initial_user():
            return db.users.insert_one(initial_user_doc)

        result = db.retry_operation(create_initial_user)

        if result.inserted_id:
            logger.info(f"Successfully initialized user {userId} in MongoDB after Google OAuth")
            return JSONResponse(
                status_code=201,
                content={
                    "status": "success",
                    "message": "User initialized successfully",
                    "user": {
                        "userId": userId,
                        "email": email,
                        "name": fullName,
                        "createdAt": initial_user_doc["createdAt"].isoformat(),
                        "signupMethod": "google"
                    }
                }
            )
        else:
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "detail": "Failed to initialize user"
                }
            )

    except Exception as e:
        logger.error(f"Error initializing user from Google OAuth: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Error initializing user: {str(e)}"
            }
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
                        "absenceFinalizationStatus": "pending",
                        "absenceFinalizationQueuedAt": nigeria_time,
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
                updated_count = 0;
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
        logger.info(f"Successfully ended attendance session: {session_id}; absence finalization queued")
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Attendance session ended successfully",
                "downloadUrl": f"/download-attendance/{session_id}",
                "recordCount": len(records),
                "absenceFinalizationStatus": "pending",
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
            # Include classTitle in the projection
            sessions = list(db.sessions.find(
                {"hostId": userId}, 
                {
                    "_id": 0,
                    "sessionId": 1,
                    "classTitle": 1,  # Include classTitle
                    "status": 1,
                    "startTime": 1,
                    "endTime": 1,
                    "hostName": 1,
                    "isActive": 1,
                    "attendeeCount": 1
                }
            ).sort("created_at", -1))

            for session in sessions:
                session["attendeeCount"] = count_present_attendance(db, session["sessionId"])
                # Format timestamps if they exist
                if "startTime" in session:
                    try:
                        start_time = datetime.fromisoformat(session["startTime"])
                        nigeria_start_time = start_time.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
                        session["startTime"] = nigeria_start_time.isoformat()
                    except Exception as e:
                        logger.error(f"Error formatting startTime: {e}")
                if "endTime" in session:
                    try:
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
                record.setdefault("attendanceStatus", "present")
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
        courses = data.get("courses", [])  # Get courses array from request

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
            if courses:
                update_doc["courses"] = courses
                # Update the lastCoursesUpdate timestamp when courses change
                update_doc["lastCoursesUpdate"] = datetime.utcnow()
        else:
            # For new registrations, include all fields
            update_doc.update({
                "matricNumber": matric_number,
                "department": department,
                "name": name,
                "level": level,
                "courses": courses,  # Save courses for new registrations
                "role": "student",
                "isRegistered": True,
                "registeredAt": datetime.utcnow(),
                "lastCoursesUpdate": datetime.utcnow(),  # Set lastCoursesUpdate for new registration
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
                        "courses": updated_user.get("courses", []),
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

@app.post("/update-lecturer-profile")
async def update_lecturer_profile(request: Request):
    try:
        data = await request.json()
        user_id = data.get("userId")
        name = data.get("name")
        email = data.get("email")
        department = data.get("department")

        if not user_id:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "detail": "userId is required"
                }
            )

        # Get existing user
        def get_user():
            return db.users.find_one({"userId": user_id})
        
        existing_user = db.retry_operation(get_user)
        
        if not existing_user:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "error",
                    "detail": "User not found"
                }
            )

        if existing_user.get("role") != "lecturer":
            return JSONResponse(
                status_code=403,
                content={
                    "status": "error",
                    "detail": "Only lecturers can use this endpoint"
                }
            )

        # Prepare update document
        update_doc = {
            "lastUpdated": datetime.utcnow()
        }

        if name:
            update_doc["name"] = name
        if email:
            update_doc["email"] = email
        if department:
            update_doc["department"] = department

        def update_user():
            return db.users.update_one(
                {"userId": user_id},
                {"$set": update_doc}
            )
        
        result = db.retry_operation(update_user)

        if result.modified_count > 0:
            updated_user = db.users.find_one({"userId": user_id})
            
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "message": "Lecturer profile updated successfully",
                    "user": {
                        "userId": updated_user.get("userId"),
                        "name": updated_user.get("name"),
                        "email": updated_user.get("email"),
                        "department": updated_user.get("department"),
                        "role": updated_user.get("role")
                    }
                }
            )
        else:
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "message": "No changes made",
                    "user": {
                        "userId": existing_user.get("userId"),
                        "name": existing_user.get("name"),
                        "email": existing_user.get("email"),
                        "department": existing_user.get("department"),
                        "role": existing_user.get("role")
                    }
                }
            )

    except Exception as e:
        logger.error(f"Error updating lecturer profile: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Failed to update profile: {str(e)}"
            }
        )

@app.post("/update-lecturer-courses")
async def update_lecturer_courses(request: Request):
    try:
        data = await request.json()
        user_id = data.get("userId")
        courses = data.get("courses", [])

        if not user_id:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "detail": "userId is required"
                }
            )

        # Get existing user
        def get_user():
            return db.users.find_one({"userId": user_id})
        
        existing_user = db.retry_operation(get_user)
        
        if not existing_user:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "error",
                    "detail": "User not found"
                }
            )

        if existing_user.get("role") != "lecturer":
            return JSONResponse(
                status_code=403,
                content={
                    "status": "error",
                    "detail": "Only lecturers can use this endpoint"
                }
            )

        # Validate that all course IDs exist
        for course_id in courses:
            try:
                obj_id = ObjectId(course_id) if isinstance(course_id, str) else course_id
                course = db.courses.find_one({"_id": obj_id})
                if not course:
                    return JSONResponse(
                        status_code=400,
                        content={
                            "status": "error",
                            "detail": f"Course {course_id} not found"
                        }
                    )
            except Exception as e:
                logger.warning(f"Error validating course {course_id}: {str(e)}")
                return JSONResponse(
                    status_code=400,
                    content={
                        "status": "error",
                        "detail": f"Invalid course ID: {course_id}"
                    }
                )

        # Prepare update document
        update_doc = {
            "courses": courses,
            "lastCoursesUpdate": datetime.utcnow()
        }

        def update_user():
            return db.users.update_one(
                {"userId": user_id},
                {"$set": update_doc}
            )
        
        result = db.retry_operation(update_user)

        if result.modified_count > 0:
            updated_user = db.users.find_one({"userId": user_id})
            
            # Fetch full course details
            courses_list = []
            for course_id in updated_user.get("courses", []):
                try:
                    obj_id = ObjectId(course_id) if isinstance(course_id, str) else course_id
                    course = db.courses.find_one({"_id": obj_id})
                    if course:
                        courses_list.append({
                            "code": course.get("code", ""),
                            "name": course.get("title", ""),
                            "id": str(course.get("_id", "")),
                            "credits": course.get("credits")
                        })
                except Exception as e:
                    logger.warning(f"Error fetching course {course_id}: {str(e)}")
                    continue
            
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "message": "Lecturer courses updated successfully",
                    "courses": courses_list,
                    "count": len(courses_list)
                }
            )
        else:
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "message": "No changes made",
                    "courses": [],
                    "count": 0
                }
            )

    except Exception as e:
        logger.error(f"Error updating lecturer courses: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Failed to update courses: {str(e)}"
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

        # Find session with retry mechanism
        def get_session():
            session = db.sessions.find_one({"sessionId": sessionId})
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

        session_status = session.get("status", "unknown")
        is_active = session_status == "active"
        
        # Get time limit and created_at
        time_limit = session.get("timeLimit")
        created_at = session.get("created_at") or session.get("createdAt")
        now_utc = datetime.utcnow()

        # Calculate session expiry if time limit exists
        if is_active and time_limit is not None and created_at:
            try:
                # Convert created_at to datetime if it's a string
                if isinstance(created_at, str):
                    created_at_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                else:
                    created_at_dt = created_at

                # Calculate expiry time
                expire_time = created_at_dt + timedelta(minutes=int(time_limit))
                
                # If session has expired, end it automatically
                if now_utc >= expire_time:
                    logger.info(f"Session {sessionId} expired by time limit")
                    
                    # Update session status
                    def end_session():
                        # Get final attendance count
                        attendee_count = count_present_attendance(db, sessionId)
                        
                        # Update session document
                        result = db.sessions.update_one(
                            {"sessionId": sessionId},
                            {
                                "$set": {
                                    "status": "completed",
                                    "isActive": False,
                                    "endTime": now_utc.isoformat(),
                                    "endedDueToTimeLimit": True,
                                    "absenceFinalizationStatus": "pending",
                                    "absenceFinalizationQueuedAt": now_utc,
                                    "attendeeCount": attendee_count,
                                    "lastUpdated": now_utc
                                }
                            }
                        )
                        
                        # Update all attendance records for this session
                        db.attendance.update_many(
                            {"sessionId": sessionId},
                            {
                                "$set": {
                                    "sessionEndTime": now_utc.isoformat(),
                                    "status": "completed",
                                    "lastUpdated": now_utc
                                }
                            }
                        )

                        return result.modified_count > 0
                    
                    session_ended = db.retry_operation(end_session)
                    if session_ended:
                        is_active = False
                        session_status = "completed"
                        session = db.retry_operation(get_session)  # Get updated session data
            except Exception as e:
                logger.error(f"Error processing time limit: {str(e)}")
                # Continue with regular session status check

        # If session is not active, return inactive response
        if not is_active:
            def to_iso(val):
                if isinstance(val, datetime):
                    return val.isoformat()
                elif isinstance(val, str):
                    return val
                return None

            return JSONResponse(
                status_code=200,
                content={
                    "status": session_status,
                    "sessionId": sessionId,
                    "hostId": session.get("hostId"),
                    "hostName": session.get("hostName", "Unknown"),
                    "classTitle": session.get("classTitle"),
                    "isActive": False,
                    "startTime": to_iso(session.get("startTime")),
                    "endTime": to_iso(session.get("endTime")),
                    "message": f"Session exists but is not active (status: {session_status})",
                    "endedDueToTimeLimit": session.get("endedDueToTimeLimit", False),
                    "downloadUrl": f"/download-attendance/{sessionId}"
                }
            )

        # Get attendance count for active session
        def get_attendance_count():
            return count_present_attendance(db, sessionId)
        
        attendee_count = db.retry_operation(get_attendance_count)

        # Calculate remaining time if time limit exists
        remaining_time = None
        if time_limit and created_at:
            try:
                if isinstance(created_at, str):
                    created_at_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                else:
                    created_at_dt = created_at
                    
                expire_time = created_at_dt + timedelta(minutes=int(time_limit))
                remaining_time = int((expire_time - now_utc).total_seconds())
            except Exception as e:
                logger.error(f"Error calculating remaining time: {str(e)}")
                # Continue without remaining time if calculation fails

        response_data = {
            "status": "active",
            "sessionId": sessionId,
            "hostId": session.get("hostId"),
            "hostName": session.get("hostName", "Unknown"),
            "startTime": session.get("startTime"),
            "attendeeCount": attendee_count,
            "isActive": True,
            "classTitle": session.get("classTitle"),
            "timeLimit": time_limit,
            "remainingTime": remaining_time,
            "created_at": created_at,
            "downloadUrl": f"/download-attendance/{sessionId}" if attendee_count > 0 else None,
            "endedDueToTimeLimit": session.get("endedDueToTimeLimit", False)
        }
        
        logger.info(f"Session status response prepared for: {sessionId}")
        return JSONResponse(status_code=200, content=response_data)

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
                status_code=200,
                content={
                    "status": "success",
                    "detail": "User not found - needs initialization",
                    "needsRoleSelection": True,
                    "role": None,
                    "roleData": None
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

# Global handler for all OPTIONS requests to support CORS preflight
# --- NEW ENDPOINT: Delete attendance session and records ---
@app.post("/delete-attendance")
async def delete_attendance(request: Request):
    try:
        data = await request.json()
        session_id = data.get("sessionId")
        user_id = data.get("userId")
        if not session_id or not user_id:
            return JSONResponse(status_code=400, content={"status": "error", "detail": "Missing sessionId or userId"})

        # Check user is lecturer and host of session
        user = db.users.find_one({"userId": user_id})
        if not user or user.get("role") != "lecturer":
            return JSONResponse(status_code=403, content={"status": "error", "detail": "Unauthorized: Only lecturers can delete attendance sessions."})

        session = db.sessions.find_one({"sessionId": session_id})
        if not session:
            return JSONResponse(status_code=404, content={"status": "error", "detail": "Session not found."})
        if session.get("hostId") != user_id:
            return JSONResponse(status_code=403, content={"status": "error", "detail": "Unauthorized: Only the host can delete this session."})

        # Delete attendance records
        attendance_result = db.attendance.delete_many({"sessionId": session_id})
        # Delete session
        session_result = db.sessions.delete_one({"sessionId": session_id})

        logger.info(f"Deleted session {session_id} and {attendance_result.deleted_count} attendance records.")
        return JSONResponse(status_code=200, content={
            "status": "success",
            "message": "Attendance session and records deleted successfully",
            "deletedRecords": attendance_result.deleted_count
        })
    except Exception as e:
        logger.error(f"Error deleting attendance: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(status_code=500, content={"status": "error", "detail": f"Error deleting attendance: {str(e)}"})
@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str, request: Request):
    # Allow all CORS preflight requests
    return PlainTextResponse("", status_code=204, headers={
        "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers", "*"),
        "Access-Control-Allow-Credentials": "true"
    })

app.include_router(attendance_router, tags=["attendance"])
app.include_router(admin_sessions_router, tags=["admin", "sessions"])
app.include_router(schedule_router, tags=["schedule"])
app.include_router(auth_router, tags=["auth"])
app.include_router(courses_router, tags=["courses", "departments", "levels"])

from fastapi import Query
from datetime import datetime, timedelta

@app.get("/session-stats")
async def session_stats(sessionId: str = Query(...)):
    try:
        # Get session info first
        session = db.sessions.find_one({"sessionId": sessionId})
        if not session:
            return {
                "activeStudents": 0,
                "recentStudents": [],
                "message": "Session not found"
            }

        # Count active students
        active_students = count_present_attendance(db, sessionId)

        # Get recent students (last 10, or last 5 minutes)
        five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
        recent = list(
            db.attendance.find(
                {**present_attendance_query(sessionId), "timestamp": {"$gte": five_minutes_ago}}
            )
            .sort("timestamp", -1)
            .limit(10)
        )

        # Only show full name present
        recent_students = [
            {"name": r.get("name", "")}
            for r in recent
        ]

        return {
            "activeStudents": active_students,
            "recentStudents": recent_students,
            "classTitle": session.get("classTitle"),  # Include class title in response
            "sessionCode": session.get("sessionCode")  # Include session code
        }
    except Exception as e:
        logger.error(f"Error fetching session stats: {str(e)}")
        return {
            "activeStudents": 0,
            "recentStudents": [],
            "error": str(e)
        }

# ===== ADMIN USER MANAGEMENT ENDPOINTS =====

@app.get("/get-all-users")
async def get_all_users(skip: int = 0, limit: int = 10, role: str = None, search: str = None):
    try:
        query = {}
        
        # Filter by role
        if role and role != "all":
            query["role"] = role
        
        # Filter by search term (searches multiple fields)
        if search and search.strip():
            search_lower = search.strip().lower()
            query["$or"] = [
                {"name": {"$regex": search_lower, "$options": "i"}},
                {"email": {"$regex": search_lower, "$options": "i"}},
                {"userId": {"$regex": search_lower, "$options": "i"}},
                {"department": {"$regex": search_lower, "$options": "i"}},
                {"role": {"$regex": search_lower, "$options": "i"}},
            ]
        
        def count_users():
            return db.users.count_documents(query)
        
        def get_users():
            return list(db.users.find(query).skip(skip).limit(limit))
        
        total = db.retry_operation(count_users)
        users_data = db.retry_operation(get_users)
        
        users_list = []
        for user in users_data:
            registered_at = user.get("registeredAt")
            last_updated = user.get("lastUpdated")
            
            # Convert datetime objects to ISO format strings
            if hasattr(registered_at, 'isoformat'):
                registered_at = registered_at.isoformat()
            if hasattr(last_updated, 'isoformat'):
                last_updated = last_updated.isoformat()
            
            users_list.append({
                "_id": str(user.get("_id", "")),
                "userId": user.get("userId", ""),
                "name": user.get("name", "Unknown"),
                "email": user.get("email", ""),
                "role": user.get("role", "student"),
                "department": user.get("department", ""),
                "isRestricted": user.get("isRestricted", False),
                "registeredAt": registered_at,
                "lastUpdated": last_updated
            })
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "data": users_list,
                "total": total,
                "skip": skip,
                "limit": limit,
                "search": search
            }
        )
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Error retrieving users: {str(e)}"
            }
        )

@app.post("/admin/restrict-user")
async def restrict_user(request: Request):
    try:
        data = await request.json()
        user_id = data.get("userId")
        restrict = data.get("restrict", True)
        
        if not user_id:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "detail": "userId is required"
                }
            )
        
        def get_user():
            return db.users.find_one({"userId": user_id})
        
        user = db.retry_operation(get_user)
        if not user:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "error",
                    "detail": "User not found"
                }
            )
        
        def update_user():
            return db.users.update_one(
                {"userId": user_id},
                {"$set": {
                    "isRestricted": restrict,
                    "lastUpdated": datetime.utcnow()
                }}
            )
        
        result = db.retry_operation(update_user)
        
        action = "restricted" if restrict else "unrestricted"
        logger.info(f"User {user_id} has been {action}")
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": f"User has been {action} successfully",
                "userId": user_id,
                "isRestricted": restrict
            }
        )
    except Exception as e:
        logger.error(f"Error restricting/unrestricting user: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Error updating user: {str(e)}"
            }
        )

@app.post("/admin/delete-user")
async def delete_user(request: Request):
    try:
        data = await request.json()
        user_id = data.get("userId")
        
        if not user_id:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "detail": "userId is required"
                }
            )
        
        def get_user():
            return db.users.find_one({"userId": user_id})
        
        user = db.retry_operation(get_user)
        if not user:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "error",
                    "detail": "User not found"
                }
            )
        
        # Delete user from Clerk if they have a Clerk ID
        clerk_id = user.get("clerkId") or user_id  # Use clerkId if available, otherwise use userId
        delete_clerk_user(clerk_id)
        
        # Delete user from database
        def delete_user_db():
            return db.users.delete_one({"userId": user_id})
        
        result = db.retry_operation(delete_user_db)
        
        # Also delete any face images associated with the user
        try:
            db.fs.delete({"filename": f"ref_{user_id}.jpg"})
        except Exception as e:
            logger.warning(f"Could not delete face image for user {user_id}: {str(e)}")
        
        logger.info(f"User {user_id} has been deleted from both MongoDB and Clerk")
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "User has been deleted successfully",
                "userId": user_id
            }
        )
    except Exception as e:
        logger.error(f"Error deleting user: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": f"Error deleting user: {str(e)}"
            }
        )