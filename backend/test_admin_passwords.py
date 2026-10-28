import hashlib
import unittest

from admin_passwords import hash_password, verify_password


class AdminPasswordTests(unittest.TestCase):
    def test_new_hash_uses_salt_and_verifies(self):
        password = "a-long-test-password-2026"
        first_hash = hash_password(password)
        second_hash = hash_password(password)

        self.assertTrue(first_hash.startswith("pbkdf2_sha256$310000$"))
        self.assertNotEqual(first_hash, second_hash)
        self.assertTrue(verify_password(password, first_hash))
        self.assertFalse(verify_password("wrong-password", first_hash))

    def test_legacy_sha256_hash_remains_valid(self):
        password = "legacy-password"
        legacy_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()

        self.assertTrue(verify_password(password, legacy_hash))
        self.assertFalse(verify_password("wrong-password", legacy_hash))

    def test_malformed_pbkdf2_hash_is_rejected(self):
        self.assertFalse(verify_password("password", "pbkdf2_sha256$bad$salt$hash"))


if __name__ == "__main__":
    unittest.main()
