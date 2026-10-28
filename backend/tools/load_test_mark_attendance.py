"""Opt-in load test for the physical /mark-attendance-by-course endpoint.

Use only against a disposable staging database and a no-time-limit test session.
Keep the session active until the script finishes cleanup. Each request writes
a real attendance record. Example:
    python backend/tools/load_test_mark_attendance.py --url https://staging.example.com \
        --session-id geo-test-123 --course-code TEST101 --students-csv test-students.csv \
        --latitude 6.5244 --longitude 3.3792 --confirm-write

The CSV must contain a `userId` header and enough distinct enrolled test users.
"""
import argparse
import csv
import json
import math
import os
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv
from pymongo import MongoClient

try:
    from .attendance_load_fixture import cleanup_from_manifest
except ImportError:
    from attendance_load_fixture import cleanup_from_manifest


def connect_database():
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    mongo_uri = os.environ.get("MONGODB_URI")
    if not mongo_uri:
        raise RuntimeError("MONGODB_URI is required to verify and clean the test records")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")
    database = client[os.environ.get("MONGODB_DB_NAME", "vmeet")]
    return client, database, database_name


def load_user_ids(csv_path, request_count):
    with Path(csv_path).open(newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        if not reader.fieldnames or "userId" not in reader.fieldnames:
            raise ValueError("CSV must include a 'userId' column")
        user_ids = [row.get("userId", "").strip() for row in reader]

    user_ids = [user_id for user_id in user_ids if user_id]
    if len(user_ids) < request_count:
        raise ValueError(f"CSV has {len(user_ids)} user IDs; {request_count} are required")
    selected_ids = user_ids[:request_count]
    if len(set(selected_ids)) != request_count:
        raise ValueError("The selected CSV rows must contain distinct user IDs")
    return selected_ids


def submit_attendance(url, payload, timeout):
    started_at = time.perf_counter()
    try:
        response = requests.post(url, json=payload, timeout=timeout)
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        return response.status_code, elapsed_ms, response.text[:300]
    except requests.RequestException as error:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        return None, elapsed_ms, str(error)


def verify_test_target(database, backend_url, session_id, course_code, user_ids):
    session = database.sessions.find_one({"sessionId": session_id, "status": "active"})
    selected_session = database.sessions.find_one({"courseCode": course_code, "status": "active"})
    if not session or not selected_session or selected_session.get("sessionId") != session_id:
        raise ValueError("The specified session must be the active session selected for this course")
    if session.get("timeLimit"):
        raise ValueError("Use a test session without a time limit so automatic completion cannot race cleanup")

    course = database.courses.find_one({"code": course_code})
    if not course:
        raise ValueError(f"Course {course_code} was not found in the configured MongoDB database")
    course_refs = {course_code, str(course.get("_id", ""))}
    students = list(database.users.find(
        {"role": "student", "userId": {"$in": user_ids}},
        {"_id": 0, "userId": 1, "courses": 1},
    ))
    students_by_id = {student.get("userId"): student for student in students}
    missing = [user_id for user_id in user_ids if user_id not in students_by_id]
    unenrolled = [
        user_id for user_id in user_ids
        if user_id in students_by_id
        and not course_refs.intersection(str(course_ref) for course_ref in students_by_id[user_id].get("courses", []))
    ]
    if missing or unenrolled:
        raise ValueError(f"Test set must contain enrolled student accounts (missing={len(missing)}, unenrolled={len(unenrolled)})")

    existing = database.attendance.find_one({"sessionId": session_id, "userId": {"$in": user_ids}})
    if existing:
        raise ValueError("At least one test student already has an attendance row in this session; use fresh test accounts/session")

    response = requests.get(
        f"{backend_url.rstrip('/')}/get-session-course-code",
        params={"sessionId": session_id},
        timeout=10,
    )
    response.raise_for_status()
    api_session = response.json()
    if api_session.get("courseCode") != course_code:
        raise ValueError("The backend API and MONGODB_URI do not agree on the test session/course")


def cleanup_test_marks(database, session_id, user_ids):
    present_test_count = database.attendance.count_documents({
        "sessionId": session_id,
        "userId": {"$in": user_ids},
        "$or": [
            {"attendanceStatus": {"$exists": False}},
            {"attendanceStatus": "present"},
        ],
    })
    result = database.attendance.delete_many({
        "sessionId": session_id,
        "userId": {"$in": user_ids},
    })
    update = database.sessions.update_one(
        {"sessionId": session_id},
        {
            "$inc": {"attendeeCount": -present_test_count},
            "$set": {"lastUpdated": datetime.utcnow()},
        },
    )
    if update.matched_count != 1:
        raise RuntimeError("Attendance rows were removed, but the session counter could not be restored")
    return result.deleted_count, present_test_count


def main():
    parser = argparse.ArgumentParser(description="Load-test physical attendance with distinct test students.")
    parser.add_argument("--url", help="Backend base URL, e.g. https://staging.example.com")
    parser.add_argument("--session-id", help="Active disposable session ID for --course-code")
    parser.add_argument("--course-code")
    parser.add_argument("--students-csv", help="CSV containing a userId column")
    parser.add_argument("--latitude", type=float, help="Coordinates inside the active test session geofence")
    parser.add_argument("--longitude", type=float, help="Coordinates inside the active test session geofence")
    parser.add_argument("--requests", type=int, default=1000, help="Number of distinct student submissions (default: 1000)")
    parser.add_argument("--concurrency", type=int, default=50, help="Maximum concurrent HTTP requests (default: 50)")
    parser.add_argument("--deadline-seconds", type=float, default=60, help="Total completion deadline (default: 60s)")
    parser.add_argument("--p95-ms", type=float, default=2000, help="p95 response-time target (default: 2000ms)")
    parser.add_argument("--timeout-seconds", type=float, default=15)
    parser.add_argument("--confirm-write", action="store_true", help="Required acknowledgement that this writes attendance records")
    parser.add_argument("--keep-data", action="store_true", help="Do not clean test marks after the run")
    parser.add_argument("--fixture-manifest", help="Also delete the generated course/session/users after the run")
    args = parser.parse_args()

    if not args.confirm_write:
        parser.error("Refusing to write attendance data without --confirm-write; use a disposable staging session")
    if args.requests < 1 or args.concurrency < 1:
        parser.error("--requests and --concurrency must be positive")

    if args.fixture_manifest:
        try:
            args.fixture_manifest = str(Path(args.fixture_manifest).resolve())
            manifest = json.loads(Path(args.fixture_manifest).read_text(encoding="utf-8"))
            for argument, field in (
                ("url", "backendUrl"),
                ("session_id", "sessionId"),
                ("course_code", "courseCode"),
                ("students_csv", "studentsCsv"),
                ("latitude", "latitude"),
                ("longitude", "longitude"),
            ):
                manifest_value = manifest.get(field)
                if argument == "students_csv" and manifest_value:
                    manifest_value = str(Path(manifest_value).resolve())
                supplied_value = getattr(args, argument)
                if supplied_value is not None and supplied_value != manifest_value:
                    parser.error(f"--{argument.replace('_', '-')} does not match the fixture manifest")
                setattr(args, argument, manifest_value)
        except (OSError, ValueError, json.JSONDecodeError) as error:
            parser.error(f"Unable to read fixture manifest: {error}")
    elif not all((args.url, args.session_id, args.course_code, args.students_csv, args.latitude is not None, args.longitude is not None)):
        parser.error("Provide --fixture-manifest or all of --url, --session-id, --course-code, --students-csv, --latitude, and --longitude")

    try:
        user_ids = load_user_ids(args.students_csv, args.requests)
    except (OSError, ValueError) as error:
        parser.error(str(error))

    endpoint = f"{args.url.rstrip('/')}/mark-attendance-by-course"
    payloads = [
        {
            "userId": user_id,
            "courseCode": args.course_code,
            "latitude": args.latitude,
            "longitude": args.longitude,
        }
        for user_id in user_ids
    ]

    client = None
    preflight_passed = False
    fixture_validated = False
    exit_code = 2
    try:
        client, database, database_name = connect_database()
        if args.fixture_manifest:
            manifest = json.loads(Path(args.fixture_manifest).read_text(encoding="utf-8"))
            expected_values = {
                "databaseName": database_name,
                "backendUrl": args.url.rstrip("/"),
                "sessionId": args.session_id,
                "courseCode": args.course_code,
                "studentsCsv": str(Path(args.students_csv).resolve()),
                "latitude": args.latitude,
                "longitude": args.longitude,
            }
            for field, expected in expected_values.items():
                actual = manifest.get(field)
                if field == "studentsCsv" and actual:
                    actual = str(Path(actual).resolve())
                if actual != expected:
                    raise ValueError(f"Fixture manifest does not match --{field}")
            fixture_validated = True
        verify_test_target(database, args.url, args.session_id, args.course_code, user_ids)
        preflight_passed = True
        print(f"Submitting {args.requests} distinct students to {endpoint}")
        print(f"Concurrency cap: {args.concurrency}; target: {args.deadline_seconds:.1f}s total, p95 < {args.p95_ms:.0f}ms")

        results = []
        started_at = time.perf_counter()
        with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
            futures = [executor.submit(submit_attendance, endpoint, payload, args.timeout_seconds) for payload in payloads]
            for future in as_completed(futures):
                results.append(future.result())
        total_seconds = time.perf_counter() - started_at

        statuses = Counter(str(status) if status is not None else "network-error" for status, _, _ in results)
        successful = [elapsed for status, elapsed, _ in results if status == 200]
        sorted_success = sorted(successful)
        p95_ms = sorted_success[max(0, math.ceil(len(sorted_success) * 0.95) - 1)] if sorted_success else float("inf")
        throughput = len(results) / total_seconds if total_seconds else 0

        print(f"Completed: {len(successful)}/{args.requests} successful; status counts: {dict(statuses)}")
        print(f"Elapsed: {total_seconds:.2f}s; throughput: {throughput:.2f} requests/s; successful p95: {p95_ms:.1f}ms")
        failures = [(status, elapsed, body) for status, elapsed, body in results if status != 200]
        for status, elapsed, body in failures[:10]:
            print(f"Failure {status}: {body} ({elapsed:.1f}ms)")
        if len(failures) > 10:
            print("Further failure details omitted.")

        passed = len(successful) == args.requests and total_seconds <= args.deadline_seconds and p95_ms < args.p95_ms
        print("TARGET PASSED" if passed else "TARGET NOT MET")
        exit_code = 0 if passed else 1
    except Exception as error:
        print(f"Load test failed: {error}")
    finally:
        if client:
            try:
                if preflight_passed and not args.keep_data:
                    try:
                        deleted, present_count = cleanup_test_marks(database, args.session_id, user_ids)
                        print(f"Cleanup complete: removed {deleted} test rows; decremented attendeeCount by {present_count}.")
                    except Exception as cleanup_error:
                        print(f"Attendance-row cleanup warning: {cleanup_error}")
                        exit_code = 3
                if fixture_validated and not args.keep_data:
                    try:
                        deleted_fixture = cleanup_from_manifest(database, database_name, args.fixture_manifest)
                        print(f"Fixture cleanup complete: {deleted_fixture}")
                    except Exception as cleanup_error:
                        print(f"FIXTURE CLEANUP FAILED: {cleanup_error}")
                        exit_code = 3
                elif args.keep_data:
                    print("Test rows and fixture kept by --keep-data.")
            except Exception as cleanup_error:
                print(f"CLEANUP FAILED: {cleanup_error}. Do not reuse these test users until their session rows are removed.")
                exit_code = 3
            finally:
                client.close()
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
