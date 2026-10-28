from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from pymongo.errors import DuplicateKeyError
from datetime import datetime, timedelta, timezone
import hmac
import json
import logging
import os

from database import db
from admin_passwords import hash_password, verify_password
from admin_auth import get_admin_session, issue_admin_session, revoke_admin_session

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/admin/register")
async def register_admin(request: Request):
    """Create a new admin account"""
    try:
        registration_key = os.getenv("ADMIN_REGISTRATION_KEY", "")
        provided_key = request.headers.get("X-Admin-Registration-Key", "")
        if not registration_key or not hmac.compare_digest(provided_key, registration_key):
            return JSONResponse(
                status_code=403,
                content={"status": "error", "message": "Admin registration is disabled or unauthorized"},
            )

        data = await request.json()
        email = data.get("email", "").strip()
        password = data.get("password", "").strip()
        name = data.get("name", "").strip()

        # Validate input
        if not all([email, password, name]):
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "message": "Email, password, and name are required"
                }
            )

        if len(password) < 12:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "message": "Password must be at least 12 characters long"
                }
            )

        # Check if email already exists
        existing_admin = db.admins.find_one({"email": email})
        if existing_admin:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "message": "Email already registered"
                }
            )

        # Hash password and create admin
        nigeria_time = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
        
        admin_data = {
            "email": email,
            "password": hash_password(password),
            "name": name,
            "role": "admin",
            "createdAt": nigeria_time.isoformat(),
            "lastLogin": None,
            "isActive": True
        }

        result = db.admins.insert_one(admin_data)

        logger.info(f"Admin created successfully: {email}")
        return JSONResponse(
            status_code=201,
            content={
                "status": "success",
                "message": "Admin account created successfully",
                "adminId": str(result.inserted_id),
                "email": email,
                "name": name
            }
        )

    except DuplicateKeyError:
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "message": "Email already registered"
            }
        )
    except Exception as e:
        logger.error(f"Error registering admin: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Error registering admin: {str(e)}"
            }
        )


@router.post("/admin/login")
async def login_admin(request: Request):
    """Login admin with email and password"""
    try:
        data = await request.json()
        email = data.get("email", "").strip()
        password = data.get("password", "").strip()

        if not email or not password:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "message": "Email and password are required"
                }
            )

        # Find admin by email
        admin = db.admins.find_one({"email": email})
        if not admin:
            return JSONResponse(
                status_code=401,
                content={
                    "status": "error",
                    "message": "Invalid email or password"
                }
            )

        # Verify password
        if not verify_password(password, admin.get("password", "")):
            return JSONResponse(
                status_code=401,
                content={
                    "status": "error",
                    "message": "Invalid email or password"
                }
            )

        if not admin.get("isActive", True):
            return JSONResponse(
                status_code=403,
                content={
                    "status": "error",
                    "message": "Admin account is inactive"
                }
            )

        # Update last login
        nigeria_time = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
        db.admins.update_one(
            {"_id": admin["_id"]},
            {"$set": {"lastLogin": nigeria_time.isoformat()}}
        )
        token, expires_at = issue_admin_session(db.admins, admin["_id"])

        logger.info(f"Admin login successful: {email}")
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Login successful",
                "token": token,
                "expiresAt": expires_at.isoformat(),
                "admin": {
                    "id": str(admin["_id"]),
                    "email": admin["email"],
                    "name": admin["name"],
                    "role": admin["role"]
                }
            }
        )

    except Exception as e:
        logger.error(f"Error logging in admin: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Error logging in: {str(e)}"
            }
        )


@router.get("/admin/verify")
async def verify_admin(request: Request):
    """Verify the current admin bearer session."""
    try:
        authorization = request.headers.get("Authorization", "")
        token = authorization.removeprefix("Bearer ") if authorization.startswith("Bearer ") else ""
        admin = get_admin_session(db.admins, token)
        if not admin:
            return JSONResponse(
                status_code=401,
                content={"status": "error", "message": "Not authenticated"},
            )

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "admin": {
                    "id": str(admin["_id"]),
                    "email": admin["email"],
                    "name": admin["name"],
                    "role": admin["role"]
                }
            }
        )

    except Exception as e:
        logger.error(f"Error verifying admin: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Error verifying admin: {str(e)}"
            }
        )


@router.post("/admin/logout")
async def logout_admin(request: Request):
    authorization = request.headers.get("Authorization", "")
    token = authorization.removeprefix("Bearer ") if authorization.startswith("Bearer ") else ""
    admin = get_admin_session(db.admins, token)
    if not admin:
        return JSONResponse(status_code=401, content={"status": "error", "message": "Not authenticated"})
    revoke_admin_session(db.admins, admin["_id"])
    return JSONResponse(status_code=200, content={"status": "success", "message": "Logged out"})
