#!/usr/bin/env python3
"""
Script to create admin accounts for VMeet Admin Panel

Usage:
    python create-admin.py --email admin@vmeet.com --password SecurePassword123 --name "Admin Name"

Or run interactively:
    python create-admin.py
"""

import os
import sys
import argparse
import hashlib
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables from backend/.env
backend_env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
load_dotenv(backend_env_path)

# MongoDB configuration
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "vmeet")

if not MONGODB_URI:
    print("Error: MONGODB_URI environment variable is not set.")
    print("Please add MONGODB_URI to your .env file")
    sys.exit(1)


def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()


def connect_to_db():
    """Connect to MongoDB"""
    try:
        client = MongoClient(
            MONGODB_URI,
            maxPoolSize=50,
            waitQueueTimeoutMS=2500,
            connectTimeoutMS=5000,
            serverSelectionTimeoutMS=5000,
            retryWrites=True
        )
        client.server_info()
        db = client[DB_NAME]
        return db, client
    except Exception as e:
        print(f"Error connecting to MongoDB: {str(e)}")
        sys.exit(1)


def create_admin(db, email: str, password: str, name: str, force: bool = False) -> bool:
    """Create a new admin account"""
    
    # Validate inputs
    if not all([email, password, name]):
        print("Error: Email, password, and name are required.")
        return False
    
    if len(password) < 6:
        print("Error: Password must be at least 6 characters long.")
        return False
    
    # Check if email already exists
    existing_admin = db.admins.find_one({"email": email})
    if existing_admin and not force:
        print(f"Error: Admin with email '{email}' already exists.")
        response = input("Do you want to update this admin? (y/n): ").lower()
        if response != 'y':
            return False
    
    # Hash password
    hashed_password = hash_password(password)
    
    # Create admin data
    nigeria_time = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=1)))
    
    admin_data = {
        "email": email,
        "password": hashed_password,
        "name": name,
        "role": "admin",
        "createdAt": nigeria_time.isoformat(),
        "lastLogin": None,
        "isActive": True
    }
    
    try:
        if existing_admin and force:
            # Update existing admin
            result = db.admins.update_one(
                {"email": email},
                {"$set": admin_data}
            )
            print(f"✓ Admin '{email}' updated successfully!")
            return True
        else:
            # Create new admin
            result = db.admins.insert_one(admin_data)
            print(f"✓ Admin '{email}' created successfully!")
            print(f"  Admin ID: {result.inserted_id}")
            print(f"  Name: {name}")
            print(f"  Role: admin")
            return True
    except Exception as e:
        print(f"Error creating admin: {str(e)}")
        return False


def interactive_mode():
    """Create admin in interactive mode"""
    print("\n" + "="*50)
    print("  VMeet Admin Account Creator")
    print("="*50 + "\n")
    
    email = input("Enter admin email: ").strip()
    if not email:
        print("Error: Email cannot be empty.")
        return False
    
    name = input("Enter admin name: ").strip()
    if not name:
        print("Error: Name cannot be empty.")
        return False
    
    while True:
        password = input("Enter password (min 6 characters): ").strip()
        if len(password) < 6:
            print("Error: Password must be at least 6 characters.")
            continue
        
        password_confirm = input("Confirm password: ").strip()
        if password != password_confirm:
            print("Error: Passwords do not match.")
            continue
        break
    
    db, client = connect_to_db()
    try:
        success = create_admin(db, email, password, name)
        return success
    finally:
        client.close()


def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description="Create admin accounts for VMeet Admin Panel",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python create-admin.py --email admin@vmeet.com --password SecurePassword123 --name "Admin Name"
  python create-admin.py  # Interactive mode
  python create-admin.py --email admin@vmeet.com --password NewPassword123 --name "Admin" --force  # Update existing
        """
    )
    
    parser.add_argument('--email', type=str, help='Admin email address')
    parser.add_argument('--password', type=str, help='Admin password')
    parser.add_argument('--name', type=str, help='Admin name')
    parser.add_argument('--force', action='store_true', help='Force create/update admin account')
    
    args = parser.parse_args()
    
    # If any command line args provided, use them
    if args.email or args.password or args.name:
        if not all([args.email, args.password, args.name]):
            print("Error: When using command line arguments, all of --email, --password, and --name are required.")
            sys.exit(1)
        
        db, client = connect_to_db()
        try:
            success = create_admin(db, args.email, args.password, args.name, args.force)
            sys.exit(0 if success else 1)
        finally:
            client.close()
    else:
        # Interactive mode
        success = interactive_mode()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
