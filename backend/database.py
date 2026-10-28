from pymongo import MongoClient, ASCENDING, ReturnDocument
from pymongo.errors import ConnectionFailure, OperationFailure
from gridfs import GridFS
import logging
import os
from datetime import datetime
import time
from typing import Optional
from dotenv import load_dotenv

# Configure logging
logger = logging.getLogger(__name__)

load_dotenv()

class DatabaseManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatabaseManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self.MONGODB_URI = os.getenv("MONGODB_URI")
        self.DB_NAME = os.getenv("MONGODB_DB_NAME", "vmeet")
        self.ATTENDANCE_COLLECTION = os.getenv("MONGODB_ATTENDANCE_COLLECTION", "attendance")
        
        if not self.MONGODB_URI:
            raise ValueError("MONGODB_URI environment variable is required")
            
        self._connect_with_retry()
        self._initialized = True
    
    def _connect_with_retry(self, max_retries=3, delay=1):
        """Establish MongoDB connection with retry mechanism"""
        attempt = 0
        last_error = None
        
        while attempt < max_retries:
            try:
                self.client = MongoClient(
                    self.MONGODB_URI,
                    maxPoolSize=50,  # Increased pool size for better concurrency
                    waitQueueTimeoutMS=2500,  # Wait queue timeout
                    connectTimeoutMS=5000,  # Connection timeout
                    serverSelectionTimeoutMS=5000,  # Server selection timeout
                    retryWrites=True  # Enable automatic retries for write operations
                )
                # Test connection
                self.client.server_info()
                
                # Initialize database and collections
                self.db = self.client[self.DB_NAME]
                self.attendance = self.db[self.ATTENDANCE_COLLECTION]
                self.users = self.db["users"]
                self.sessions = self.db["sessions"]
                self.schedules = self.db["schedules"]  # New schedules collection
                self.admins = self.db["admins"]
                self.departments = self.db["departments"]
                self.levels = self.db["levels"]
                self.courses = self.db["courses"]
                self.fs = GridFS(self.db)
                
                # Create indexes
                self._create_indexes()
                logger.info("Successfully connected to MongoDB")
                return
                
            except Exception as e:
                last_error = e
                attempt += 1
                if attempt < max_retries:
                    time.sleep(delay * attempt)  # Exponential backoff
                    logger.warning(f"Retrying MongoDB connection (attempt {attempt+1}/{max_retries})")
                else:
                    logger.error(f"Failed to connect to MongoDB after {max_retries} attempts")
                    raise ConnectionFailure(f"Could not connect to MongoDB: {str(last_error)}")
    
    def _create_indexes(self):
        """Create necessary indexes for better query performance"""
        try:
            # Basic indexes first (non-unique)
            self.attendance.create_index([("created_at", ASCENDING)])
            self.attendance.create_index([("sessionId", ASCENDING)])
            self.users.create_index([("email", ASCENDING)])
            self.users.create_index([("role", ASCENDING)])
            self.users.create_index([("role", ASCENDING), ("courses", ASCENDING)])
            self.sessions.create_index([("hostId", ASCENDING)])
            self.sessions.create_index([("hostId", ASCENDING), ("created_at", -1)])
            self.sessions.create_index([("status", ASCENDING)])
            self.sessions.create_index([("courseCode", ASCENDING), ("status", ASCENDING)])
            self.sessions.create_index([
                ("status", ASCENDING),
                ("absenceFinalizationStatus", ASCENDING),
                ("absenceFinalizationNextAttemptAt", ASCENDING),
            ])
            self.sessions.create_index([("created_at", ASCENDING)])
            self.admins.create_index([("email", ASCENDING)])
            
            # Departments indexes
            self.departments.create_index([("name", ASCENDING)])
            self.departments.create_index([("createdAt", ASCENDING)])
            self._ensure_unique_index(self.departments, "code")
            
            # Levels indexes
            self.levels.create_index([("code", ASCENDING)])
            self.levels.create_index([("yearOfStudy", ASCENDING)])
            self.levels.create_index([("createdAt", ASCENDING)])
            
            # Courses indexes
            self.courses.create_index([("code", ASCENDING)])
            self.courses.create_index([("title", ASCENDING)])
            self.courses.create_index([("departmentId", ASCENDING)])
            self.courses.create_index([("levelId", ASCENDING)])
            self.courses.create_index([("createdAt", ASCENDING)])
            self.courses.create_index([("departmentName", ASCENDING)])
            self.courses.create_index([("levelCode", ASCENDING)])
            
            # Schedules indexes
            self.schedules.create_index([("scheduleId", ASCENDING)])
            self.schedules.create_index([("lecturerId", ASCENDING)])
            self.schedules.create_index([("courseCode", ASCENDING)])
            self.schedules.create_index([("status", ASCENDING)])
            self.schedules.create_index([("scheduledDateTime", ASCENDING)])
            self.schedules.create_index([("createdAt", ASCENDING)])

            # Handle unique indexes carefully
            self._ensure_unique_index(self.users, "userId")
            self._ensure_unique_index(self.sessions, "sessionId")
            self._ensure_unique_index(self.schedules, "scheduleId")
            self._ensure_unique_index(self.admins, "email")
            self._ensure_unique_index(self.courses, "code")
            self._ensure_unique_attendance_index()

        except Exception as e:
            logger.warning(f"Index creation warning (non-critical): {str(e)}")

    def _ensure_unique_index(self, collection, field_name):
        """Safely create a unique index on a single field"""
        try:
            collection.create_index([(field_name, ASCENDING)], unique=True, background=True)
        except OperationFailure as e:
            if e.code != 85:  # If error is not "index already exists"
                logger.warning(f"Unable to create unique index on {field_name}: {str(e)}")

    def _ensure_unique_attendance_index(self):
        """Safely create unique compound index for attendance records"""
        try:
            # Check for duplicates first
            pipeline = [
                {"$group": {
                    "_id": {"userId": "$userId", "sessionId": "$sessionId"},
                    "count": {"$sum": 1},
                    "docs": {"$push": "$_id"}
                }},
                {"$match": {"count": {"$gt": 1}}}
            ]
            
            duplicates = list(self.attendance.aggregate(pipeline))
            
            # If duplicates exist, keep only the first record for each group
            for dup in duplicates:
                # Keep the first document, remove others
                docs_to_remove = dup["docs"][1:]
                if docs_to_remove:
                    self.attendance.delete_many({"_id": {"$in": docs_to_remove}})
            
            # Now create the unique index
            self.attendance.create_index(
                [("userId", ASCENDING), ("sessionId", ASCENDING)],
                unique=True,
                background=True
            )
        except Exception as e:
            logger.warning(f"Unable to create unique attendance index: {str(e)}")
    
    def ping(self) -> bool:
        """Check if database connection is alive"""
        try:
            self.client.admin.command('ping')
            return True
        except Exception as e:
            logger.error(f"Database ping failed: {str(e)}")
            return False
    
    def retry_operation(self, operation, max_retries=3):
        """Retry a database operation with exponential backoff"""
        attempt = 0
        last_error = None
        
        while attempt < max_retries:
            try:
                return operation()
            except (ConnectionFailure, OperationFailure) as e:
                last_error = e
                attempt += 1
                if attempt < max_retries:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    logger.warning(f"Retrying operation (attempt {attempt+1}/{max_retries})")
                else:
                    logger.error(f"Operation failed after {max_retries} attempts: {str(last_error)}")
                    raise
    
    def close(self):
        """Close database connection"""
        if hasattr(self, 'client'):
            self.client.close()
            
    # Role Management Methods
    def get_user_by_id(self, user_id: str) -> dict:
        """Get user by ID with role information"""
        return self.users.find_one({"userId": user_id})
    
    def verify_role(self, user_id: str, required_role: str) -> bool:
        """Verify if a user has the required role"""
        user = self.get_user_by_id(user_id)
        return user is not None and user.get("role") == required_role
    
    def get_lecturer_sessions(self, lecturer_id: str, include_inactive: bool = False) -> list:
        """Get all sessions created by a lecturer"""
        query = {"hostId": lecturer_id}
        if not include_inactive:
            query["status"] = "active"
        return list(self.sessions.find(query, {"_id": 0}).sort("created_at", -1))
    
    def get_student_attendance(self, student_id: str) -> list:
        """Get all attendance records for a student"""
        return list(self.attendance.find(
            {"userId": student_id},
            {"_id": 0}
        ).sort("created_at", -1))
    
    def is_lecturer(self, user_id: str) -> bool:
        """Check if user is a lecturer"""
        return self.verify_role(user_id, "lecturer")
    
    def is_student(self, user_id: str) -> bool:
        """Check if user is a student"""
        return self.verify_role(user_id, "student")
            
# Create a global instance
db = DatabaseManager()
