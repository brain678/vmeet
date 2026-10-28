import csv
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import tools.attendance_load_fixture as fixture_tool


class AttendanceLoadFixtureTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_fixture_dir = fixture_tool.FIXTURE_DIR
        fixture_tool.FIXTURE_DIR = Path(self.temp_dir.name) / "fixtures"
        self.database = SimpleNamespace(
            attendance=MagicMock(),
            courses=MagicMock(),
            sessions=MagicMock(),
            users=MagicMock(),
        )

    def tearDown(self):
        fixture_tool.FIXTURE_DIR = self.original_fixture_dir
        self.temp_dir.cleanup()

    def test_create_fixture_makes_enrolled_users_and_no_time_limit_session(self):
        manifest_path, manifest = fixture_tool.create_fixture(
            self.database,
            "vmeet_staging",
            "http://localhost:8000",
            3,
            6.5,
            3.4,
        )

        course = self.database.courses.insert_one.call_args.args[0]
        students = self.database.users.insert_many.call_args.args[0]
        session = self.database.sessions.insert_one.call_args.args[0]
        with Path(manifest["studentsCsv"]).open(newline="", encoding="utf-8") as csv_file:
            csv_rows = list(csv.DictReader(csv_file))

        self.assertTrue(manifest_path.exists())
        self.assertEqual(len(students), 3)
        self.assertEqual(students[0]["courses"], [course["_id"]])
        self.assertEqual(session["courseCode"], course["code"])
        self.assertEqual(session["status"], "active")
        self.assertNotIn("timeLimit", session)
        self.assertEqual(len(csv_rows), 3)
        self.assertTrue(all(row["userId"].startswith(f"loadtest_{manifest['fixtureId']}_") for row in csv_rows))

    def test_cleanup_removes_fixture_docs_and_files(self):
        manifest_path, manifest = fixture_tool.create_fixture(
            self.database,
            "vmeet_staging",
            "http://localhost:8000",
            2,
            6.5,
            3.4,
        )
        self.database.attendance.delete_many.return_value = SimpleNamespace(deleted_count=2)
        self.database.sessions.delete_one.return_value = SimpleNamespace(deleted_count=1)
        self.database.users.delete_many.return_value = SimpleNamespace(deleted_count=2)
        self.database.courses.delete_one.return_value = SimpleNamespace(deleted_count=1)

        deleted = fixture_tool.cleanup_from_manifest(self.database, "vmeet_staging", manifest_path)

        self.assertEqual(deleted, {"attendance": 2, "sessions": 1, "students": 2, "courses": 1})
        self.database.attendance.delete_many.assert_called_once_with({"sessionId": manifest["sessionId"]})
        self.database.sessions.delete_one.assert_called_once_with({
            "sessionId": manifest["sessionId"],
            "loadTestFixtureId": manifest["fixtureId"],
        })
        self.assertFalse(manifest_path.exists())
        self.assertFalse(Path(manifest["studentsCsv"]).exists())

    def test_refuses_non_test_database_name(self):
        with self.assertRaises(ValueError):
            fixture_tool.require_staging_database("vmeet")


if __name__ == "__main__":
    unittest.main()
