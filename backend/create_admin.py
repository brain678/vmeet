"""Create a VMeet admin account using a hidden local password prompt."""
import getpass
import argparse
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

from admin_passwords import hash_password


def create_admin(email: str, name: str, reset_existing: bool = False) -> int:
    load_dotenv()
    mongo_uri = os.getenv("MONGODB_URI")
    if not mongo_uri:
        raise RuntimeError("MONGODB_URI is not configured")

    database_name = os.getenv("MONGODB_DB_NAME", "vmeet")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command("ping")
        admins = client[database_name]["admins"]
        normalized_email = email.strip().lower()
        existing_admin = admins.find_one({"email": normalized_email})
        if existing_admin and not reset_existing:
            raise ValueError(f"An admin account already exists for {normalized_email}")

        password = getpass.getpass("New admin password (input hidden): ")
        confirmation = getpass.getpass("Confirm new admin password: ")
        if password != confirmation:
            raise ValueError("Passwords did not match")
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long")

        password_hash = hash_password(password)
        if existing_admin:
            admins.update_one(
                {"_id": existing_admin["_id"]},
                {"$set": {
                    "password": password_hash,
                    "passwordUpdatedAt": datetime.now(timezone.utc).isoformat(),
                }},
            )
            print(f"Admin password reset in database '{database_name}': {normalized_email}")
        else:
            admin = {
                "email": normalized_email,
                "password": password_hash,
                "name": name.strip() or "Administrator",
                "role": "admin",
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "lastLogin": None,
                "isActive": True,
            }
            try:
                result = admins.insert_one(admin)
            except DuplicateKeyError as error:
                raise ValueError(f"An admin account already exists for {normalized_email}") from error
            print(f"Admin created in database '{database_name}': {normalized_email} (id: {result.inserted_id})")
        return 0
    finally:
        client.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Create or reset an admin account with a hidden password prompt.")
    parser.add_argument("--email", default="admin@gmail.com")
    parser.add_argument("--name", default="Administrator")
    parser.add_argument("--reset-existing", action="store_true", help="Reset the password of an existing admin account")
    args = parser.parse_args()
    try:
        return create_admin(args.email, args.name, args.reset_existing)
    except Exception as error:
        print(f"Admin creation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
