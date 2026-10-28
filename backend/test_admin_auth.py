import hashlib
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from admin_auth import get_admin_session, issue_admin_session, revoke_admin_session


class AdminAuthTests(unittest.TestCase):
    def setUp(self):
        self.admins = MagicMock()
        self.admins.update_one.return_value = SimpleNamespace(matched_count=1)
        self.admin_id = "admin-id"

    def test_issued_token_is_hashed_and_verifies_until_expiry(self):
        token, expires_at = issue_admin_session(self.admins, self.admin_id)
        update = self.admins.update_one.call_args.args[1]["$set"]
        token_hash = update["sessionTokenHash"]
        self.assertEqual(token_hash, hashlib.sha256(token.encode("utf-8")).hexdigest())
        self.assertNotEqual(token_hash, token)
        self.assertGreater(expires_at, datetime.now(timezone.utc))

        self.admins.find_one.return_value = {
            "_id": self.admin_id,
            "isActive": True,
            "sessionExpiresAt": expires_at,
        }
        self.assertIsNotNone(get_admin_session(self.admins, token))
        self.assertIsNone(get_admin_session(self.admins, token, now=expires_at + timedelta(seconds=1)))

    def test_revokes_token_session(self):
        self.admins.update_one.return_value = SimpleNamespace(matched_count=1)
        self.assertTrue(revoke_admin_session(self.admins, self.admin_id))
        self.assertIn("$unset", self.admins.update_one.call_args.args[1])

    def test_rejects_missing_and_unknown_tokens(self):
        self.assertIsNone(get_admin_session(self.admins, ""))
        self.admins.find_one.return_value = None
        self.assertIsNone(get_admin_session(self.admins, "invalid-token"))


if __name__ == "__main__":
    unittest.main()
