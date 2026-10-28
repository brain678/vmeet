"""Short-lived bearer sessions for the admin dashboard."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

SESSION_HOURS = 12


def issue_admin_session(admins: Any, admin_id: Any) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)
    result = admins.update_one(
        {"_id": admin_id, "isActive": {"$ne": False}},
        {"$set": {
            "sessionTokenHash": token_hash,
            "sessionExpiresAt": expires_at,
        }},
    )
    if result.matched_count != 1:
        raise ValueError("Admin is inactive or no longer exists")
    return token, expires_at


def get_admin_session(admins: Any, token: str, now: datetime | None = None) -> dict[str, Any] | None:
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    admin = admins.find_one({
        "sessionTokenHash": token_hash,
        "isActive": {"$ne": False},
    })
    if not admin:
        return None
    expires_at = admin.get("sessionExpiresAt")
    if not isinstance(expires_at, datetime):
        return None
    now = now or datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        return None
    return admin


def revoke_admin_session(admins: Any, admin_id: Any) -> bool:
    result = admins.update_one(
        {"_id": admin_id},
        {"$unset": {"sessionTokenHash": "", "sessionExpiresAt": ""}},
    )
    return result.matched_count == 1
