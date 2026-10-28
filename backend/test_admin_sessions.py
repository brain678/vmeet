import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from routes.admin_sessions import _require_admin, _session_summary, end_admin_session


class AdminSessionTests(unittest.TestCase):
    def test_requires_a_valid_admin_bearer_token(self):
        request = SimpleNamespace(headers={"Authorization": "Bearer invalid"})
        with patch("routes.admin_sessions.db.admins.find_one", return_value=None):
            with self.assertRaises(HTTPException) as error:
                _require_admin(request)
        self.assertEqual(error.exception.status_code, 401)

    def test_session_summary_resolves_host_name_from_user_profile(self):
        session = {"sessionId": "geo-test-2", "hostId": "lecturer-42", "status": "active"}
        with patch("routes.admin_sessions.db.users.find_one", return_value={"userId": "lecturer-42", "name": "Dr Ada"}):
            summary = _session_summary(session)

        self.assertEqual(summary["hostName"], "Dr Ada")
        self.assertEqual(summary["hostId"], "lecturer-42")

    def test_admin_end_sets_completed_and_queues_absence_finalization(self):
        request = SimpleNamespace(headers={"Authorization": "Bearer valid"})
        session = {"sessionId": "geo-test-1", "status": "active", "hostId": "lecturer-1"}
        update_result = SimpleNamespace(modified_count=1)
        with patch("routes.admin_sessions._require_admin"), \
             patch("routes.admin_sessions.db.sessions.find_one", return_value=session), \
             patch("routes.admin_sessions.db.sessions.update_one", return_value=update_result) as update_session, \
             patch("routes.admin_sessions.count_present_attendance", return_value=12), \
             patch("routes.admin_sessions.db.attendance.update_many") as archive_present:
            response = end_admin_session("geo-test-1", request)

        update = update_session.call_args.args[1]["$set"]
        self.assertEqual(update["status"], "completed")
        self.assertEqual(update["attendeeCount"], 12)
        self.assertEqual(update["absenceFinalizationStatus"], "pending")
        self.assertEqual(response["session"]["finalizationStatus"], "pending")
        archive_present.assert_called_once()

    def test_cannot_end_a_nonactive_session(self):
        request = SimpleNamespace(headers={"Authorization": "Bearer valid"})
        with patch("routes.admin_sessions._require_admin"), \
             patch("routes.admin_sessions.db.sessions.find_one", return_value={"status": "completed"}):
            with self.assertRaises(HTTPException) as error:
                end_admin_session("session-1", request)
        self.assertEqual(error.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
