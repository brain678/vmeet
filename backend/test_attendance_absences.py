import unittest
from types import SimpleNamespace
from unittest.mock import ANY, MagicMock

from attendance_utils import (
    count_present_attendance,
    increment_session_attendee_count,
    mark_course_roster_absences,
    present_attendance_query,
)


class AttendanceAbsenceTests(unittest.TestCase):
    def setUp(self):
        self.database = SimpleNamespace(
            courses=MagicMock(),
            schedules=MagicMock(),
            users=MagicMock(),
            attendance=MagicMock(),
            sessions=MagicMock(),
        )
        self.database.courses.find_one.return_value = {"_id": "course-id"}
        self.database.users.find.return_value = [{
            "userId": "student-1",
            "name": "Student One",
            "matricNumber": "MAT-001",
        }]
        self.database.attendance.count_documents.return_value = 1

    def test_inserts_absent_record_for_enrolled_student(self):
        inserted = mark_course_roster_absences(
            self.database,
            {"sessionId": "geo-123", "courseCode": "CSC101"},
            "2026-10-17T12:00:00+01:00",
        )

        self.assertEqual(inserted, 1)
        operations = self.database.attendance.bulk_write.call_args.args[0]
        self.assertEqual(len(operations), 1)
        self.assertEqual(operations[0]._filter, {"sessionId": "geo-123", "userId": "student-1"})
        self.assertEqual(operations[0]._doc["$setOnInsert"]["attendanceStatus"], "absent")
        self.assertEqual(operations[0]._doc["$setOnInsert"]["matric"], "MAT-001")
        self.assertNotIn("$set", operations[0]._doc)
        self.assertFalse(self.database.attendance.bulk_write.call_args.kwargs["ordered"])

    def test_existing_session_record_is_not_overwritten(self):
        inserted = mark_course_roster_absences(
            self.database,
            {"sessionId": "session-123", "courseCode": "CSC101"},
            "2026-10-17T12:00:00+01:00",
        )

        self.assertEqual(inserted, 1)
        operations = self.database.attendance.bulk_write.call_args.args[0]
        self.assertEqual(operations[0]._doc["$setOnInsert"]["attendanceStatus"], "absent")
        self.assertNotIn("$set", operations[0]._doc)

    def test_session_without_course_does_not_mark_students(self):
        inserted = mark_course_roster_absences(
            self.database,
            {"sessionId": "session-123"},
            "2026-10-17T12:00:00+01:00",
        )

        self.assertIsNone(inserted)
        self.database.users.find.assert_not_called()

    def test_large_roster_is_split_into_bounded_batches(self):
        self.database.users.find.return_value = [
            {"userId": f"student-{index}", "name": f"Student {index}"}
            for index in range(501)
        ]
        self.database.attendance.count_documents.return_value = 501

        absent_count = mark_course_roster_absences(
            self.database,
            {"sessionId": "session-123", "courseCode": "CSC101"},
            "2026-10-17T12:00:00+01:00",
        )

        self.assertEqual(absent_count, 501)
        self.assertEqual(self.database.attendance.bulk_write.call_count, 2)
        batch_sizes = [len(call.args[0]) for call in self.database.attendance.bulk_write.call_args_list]
        self.assertEqual(batch_sizes, [500, 1])

    def test_present_query_includes_legacy_records(self):
        self.assertEqual(
            present_attendance_query("session-123"),
            {
                "sessionId": "session-123",
                "$or": [
                    {"attendanceStatus": {"$exists": False}},
                    {"attendanceStatus": "present"},
                ],
            },
        )

    def test_present_count_uses_status_filter(self):
        self.database.attendance.count_documents.return_value = 3

        count = count_present_attendance(self.database, "session-123")

        self.assertEqual(count, 3)
        self.database.attendance.count_documents.assert_called_once_with(present_attendance_query("session-123"))

    def test_session_counter_uses_atomic_increment(self):
        increment_session_attendee_count(self.database, "session-123")

        self.database.sessions.update_one.assert_called_once_with(
            {"sessionId": "session-123"},
            {
                "$inc": {"attendeeCount": 1},
                "$set": {"lastUpdated": ANY},
            },
        )


if __name__ == "__main__":
    unittest.main()