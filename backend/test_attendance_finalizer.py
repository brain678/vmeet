import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

from attendance_finalizer import process_pending_absence_finalizations


class AttendanceFinalizerTests(unittest.TestCase):
    def setUp(self):
        self.session = {
            "_id": "session-doc-id",
            "sessionId": "session-123",
            "status": "completed",
            "courseCode": "CSC101",
            "endTime": "2026-10-17T12:00:00+01:00",
            "absenceFinalizationAttempts": 1,
        }
        self.database = SimpleNamespace(
            sessions=MagicMock(),
            courses=MagicMock(),
            users=MagicMock(),
            attendance=MagicMock(),
        )
        self.database.sessions.find_one_and_update.side_effect = [self.session, None]
        self.database.courses.find_one.return_value = {"_id": "course-id"}
        self.database.users.find.return_value = [{"userId": "student-1", "name": "Student One"}]
        self.database.attendance.count_documents.return_value = 1

    def test_completes_claimed_job_after_bulk_write(self):
        processed = process_pending_absence_finalizations(self.database)

        self.assertEqual(processed, 1)
        self.database.attendance.bulk_write.assert_called_once()
        update = self.database.sessions.update_one.call_args.args[1]["$set"]
        self.assertEqual(update["absenceFinalizationStatus"], "completed")
        self.assertEqual(update["absentCount"], 1)
        self.assertIsInstance(update["absenceFinalizationCompletedAt"], datetime)

    def test_bulk_failure_is_persisted_for_retry(self):
        self.database.attendance.bulk_write.side_effect = RuntimeError("temporary database error")

        processed = process_pending_absence_finalizations(self.database)

        self.assertEqual(processed, 1)
        update = self.database.sessions.update_one.call_args.args[1]["$set"]
        self.assertEqual(update["absenceFinalizationStatus"], "retrying")
        self.assertIn("temporary database error", update["absenceFinalizationLastError"])
        self.assertGreater(update["absenceFinalizationNextAttemptAt"], datetime.utcnow())

    def test_unresolvable_course_is_marked_skipped(self):
        self.session.pop("courseCode")

        processed = process_pending_absence_finalizations(self.database)

        self.assertEqual(processed, 1)
        update = self.database.sessions.update_one.call_args.args[1]["$set"]
        self.assertEqual(update["absenceFinalizationStatus"], "skipped")
        self.assertEqual(update["absenceFinalizationSkipReason"], "Course could not be resolved for session")
        self.database.users.find.assert_not_called()


if __name__ == "__main__":
    unittest.main()
