import datetime
import json
import os
import tempfile
import unittest

from aegis.core.structured_logger import StructuredLogger


class TestStructuredLogger(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.TemporaryDirectory()
        self.logger = StructuredLogger(audit_dir=self.test_dir.name)

    def tearDown(self):
        self.test_dir.cleanup()

    def test_log_event(self):
        event = {
            "event_type": "file_open",
            "filename": "/home/user/.env",
            "pid": 1234,
            "ppid": 1000,
            "comm": "node",
            "parent_comm": "npm"
        }
        rule_match = {
            "rule_id": "CRED_001",
            "rule_name": "Credential Access",
            "severity": "CRITICAL",
            "mitre_technique": "T1552.001",
            "confidence": 95
        }

        self.logger.log_event(event, rule_match=rule_match, action_taken="SIGKILL")

        log_files = os.listdir(self.test_dir.name)
        self.assertEqual(len(log_files), 1)
        self.assertTrue(log_files[0].startswith("aegis-"))
        self.assertTrue(log_files[0].endswith(".jsonl"))

        filepath = os.path.join(self.test_dir.name, log_files[0])
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()

        self.assertEqual(len(lines), 1)
        record = json.loads(lines[0])
        self.assertEqual(record["rule_id"], "CRED_001")
        self.assertEqual(record["severity"], "CRITICAL")
        self.assertEqual(record["mitre_technique"], "T1552.001")
        self.assertEqual(record["mitre_tactic"], "Credential Access")
        self.assertEqual(record["action_taken"], "SIGKILL")
        self.assertEqual(record["process_name"], "node")

    def test_log_lifecycle(self):
        self.logger.log_lifecycle("BOOT", mode="headless")

        log_files = os.listdir(self.test_dir.name)
        self.assertEqual(len(log_files), 1)

        filepath = os.path.join(self.test_dir.name, log_files[0])
        with open(filepath, "r", encoding="utf-8") as f:
            record = json.loads(f.readline())

        self.assertEqual(record["event_type"], "BOOT")
        self.assertEqual(record["rule_id"], "SYSTEM")
        self.assertEqual(record["mode"], "headless")


if __name__ == "__main__":
    unittest.main()
