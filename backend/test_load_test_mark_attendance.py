import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from tools.load_test_mark_attendance import cleanup_test_marks


class LoadTestCleanupTests(unittest.TestCase):
    def test_cleanup_deletes_only_selected_test_users_and_decrements_present_count(self):
        database = SimpleNamespace(
            attendance=MagicMock(),
            sessions=MagicMock(),
        )
        database.attendance.count_documents.return_value = 2
        database.attendance.delete_many.return_value = SimpleNamespace(deleted_count=3)
        database.sessions.update_one.return_value = SimpleNamespace(matched_count=1)
        test_users = ["load-test-1", "load-test-2", "load-test-3"]

        deleted_count, present_count = cleanup_test_marks(database, "geo-test-session", test_users)

        self.assertEqual((deleted_count, present_count), (3, 2))
        database.attendance.delete_many.assert_called_once_with({
            "sessionId": "geo-test-session",
            "userId": {"$in": test_users},
        })
        update = database.sessions.update_one.call_args
        self.assertEqual(update.args[0], {"sessionId": "geo-test-session"})
        self.assertEqual(update.args[1]["$inc"]["attendeeCount"], -2)
        self.assertIn("lastUpdated", update.args[1]["$set"])


if __name__ == "__main__":
    unittest.main()
