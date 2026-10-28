"""Create and remove an isolated MongoDB fixture for attendance load tests.

The configured database name must include `test`, `stage`, or `load`. This tool
never prints the MongoDB URI. Run only against a disposable staging database.
"""
import argparse
import csv
import json
import os
import re
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

FIXTURE_DIR = Path(__file__).resolve().parent / ".load-test-fixtures"


def require_staging_database(database_name):
    if not re.search(r"test|stage|load", database_name, re.IGNORECASE):
        raise ValueError("Refusing to write: MONGODB_DB_NAME must include 'test', 'stage', or 'load'")


def connect_database(database_name):
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    configured_name = os.environ.get("MONGODB_DB_NAME", "vmeet")
    if configured_name != database_name:
        raise ValueError("--database-name must match MONGODB_DB_NAME configured for the backend")
    require_staging_database(database_name)
    mongo_uri = os.environ.get("MONGODB_URI")
    if not mongo_uri:
        raise ValueError("MONGODB_URI is required; it is never displayed by this tool")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")
    return client, client[database_name]


def fixture_ids(fixture_id):
    return f"geo-loadtest-{fixture_id}", f"LOAD{fixture_id[:8].upper()}"


def delete_fixture_documents(database, fixture_id, session_id, course_code):
    expected_session_id, expected_course_code = fixture_ids(fixture_id)
    if session_id != expected_session_id or course_code != expected_course_code:
        raise ValueError("Fixture identifiers do not match the generated load-test namespace")

    attendance_deleted = database.attendance.delete_many({"sessionId": session_id}).deleted_count
    session_deleted = database.sessions.delete_one({
        "sessionId": session_id,
        "loadTestFixtureId": fixture_id,
    }).deleted_count
    users_deleted = database.users.delete_many({"loadTestFixtureId": fixture_id}).deleted_count
    course_deleted = database.courses.delete_one({
        "code": course_code,
        "loadTestFixtureId": fixture_id,
    }).deleted_count
    return {
        "attendance": attendance_deleted,
        "sessions": session_deleted,
        "students": users_deleted,
        "courses": course_deleted,
    }


def create_fixture(database, database_name, backend_url, student_count, latitude, longitude):
    fixture_id = uuid.uuid4().hex
    session_id, course_code = fixture_ids(fixture_id)
    course_id = ObjectId()
    now = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=1)))
    now_iso = now.isoformat()
    course = {
        "_id": course_id,
        "code": course_code,
        "title": f"Attendance Load Test {fixture_id[:8]}",
        "departmentName": "Load Test",
        "levelCode": "TEST",
        "createdAt": now_iso,
        "loadTestFixtureId": fixture_id,
    }
    students = [{
        "userId": f"loadtest_{fixture_id}_{index:04d}",
        "role": "student",
        "name": f"Load Test Student {index:04d}",
        "matric": f"LT{fixture_id[:8].upper()}{index:04d}",
        "matricNumber": f"LT{fixture_id[:8].upper()}{index:04d}",
        "department": "Load Test",
        "level": "100",
        "courses": [course_id],
        "isRestricted": False,
        "loadTestFixtureId": fixture_id,
    } for index in range(1, student_count + 1)]
    session = {
        "sessionId": session_id,
        "sessionCode": "0000",
        "hostId": f"loadtest-host-{fixture_id}",
        "courseCode": course_code,
        "classTitle": course["title"],
        "latitude": latitude,
        "longitude": longitude,
        "radius": 100,
        "status": "active",
        "isActive": True,
        "startTime": now_iso,
        "created_at": now_iso,
        "attendeeCount": 0,
        "loadTestFixtureId": fixture_id,
    }

    manifest_path = FIXTURE_DIR / f"{fixture_id}.json"
    csv_path = FIXTURE_DIR / f"{fixture_id}.csv"
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)

    try:
        database.courses.insert_one(course)
        database.users.insert_many(students, ordered=True)
        database.sessions.insert_one(session)
        with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
            writer = csv.writer(csv_file)
            writer.writerow(["userId"])
            writer.writerows([[student["userId"]] for student in students])
        manifest = {
            "fixtureId": fixture_id,
            "databaseName": database_name,
            "backendUrl": backend_url.rstrip("/"),
            "sessionId": session_id,
            "courseCode": course_code,
            "studentsCsv": str(csv_path.resolve()),
            "studentCount": student_count,
            "latitude": latitude,
            "longitude": longitude,
        }
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        return manifest_path, manifest
    except Exception:
        delete_fixture_documents(database, fixture_id, session_id, course_code)
        for path in (csv_path, manifest_path):
            path.unlink(missing_ok=True)
        raise


def cleanup_from_manifest(database, database_name, manifest_path):
    manifest_path = Path(manifest_path).resolve()
    if manifest_path.parent != FIXTURE_DIR.resolve():
        raise ValueError("Refusing to read or remove a manifest outside the fixture directory")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("databaseName") != database_name:
        raise ValueError("Manifest database does not match --database-name")
    fixture_id = manifest.get("fixtureId", "")
    if not re.fullmatch(r"[a-f0-9]{32}", fixture_id):
        raise ValueError("Manifest contains an invalid fixture ID")
    csv_path = Path(manifest["studentsCsv"]).resolve()
    if csv_path.parent != FIXTURE_DIR.resolve():
        raise ValueError("Refusing to delete a CSV outside the fixture directory")
    deleted = delete_fixture_documents(
        database,
        fixture_id,
        manifest.get("sessionId", ""),
        manifest.get("courseCode", ""),
    )
    csv_path.unlink(missing_ok=True)
    manifest_path.unlink(missing_ok=True)
    return deleted


def main():
    parser = argparse.ArgumentParser(description="Manage disposable attendance-load-test Mongo fixtures.")
    parser.add_argument("--database-name", required=True, help="Must match MONGODB_DB_NAME and include test/stage/load")
    parser.add_argument("--confirm-staging", action="store_true", help="Confirm this is a disposable non-production database")
    commands = parser.add_subparsers(dest="command", required=True)

    create = commands.add_parser("create", help="Create a test course, active session, and synthetic students")
    create.add_argument("--backend-url", required=True)
    create.add_argument("--students", type=int, default=1000)
    create.add_argument("--latitude", type=float, required=True)
    create.add_argument("--longitude", type=float, required=True)

    cleanup = commands.add_parser("cleanup", help="Delete one fixture using its generated manifest")
    cleanup.add_argument("--manifest", required=True)

    args = parser.parse_args()
    if not args.confirm_staging:
        parser.error("Refusing database writes without --confirm-staging")
    if args.command == "create" and args.students < 1:
        parser.error("--students must be positive")

    client = None
    try:
        client, database = connect_database(args.database_name)
        if args.command == "create":
            manifest_path, manifest = create_fixture(
                database,
                args.database_name,
                args.backend_url,
                args.students,
                args.latitude,
                args.longitude,
            )
            print(f"Fixture created: {manifest_path}")
            print(json.dumps(manifest, indent=2))
            print("The session has no time limit; keep it active until the load test and cleanup finish.")
        else:
            deleted = cleanup_from_manifest(database, args.database_name, args.manifest)
            print(f"Fixture cleanup complete: {deleted}")
        return 0
    except Exception as error:
        print(f"Fixture operation failed: {error}")
        return 1
    finally:
        if client:
            client.close()


if __name__ == "__main__":
    sys.exit(main())
