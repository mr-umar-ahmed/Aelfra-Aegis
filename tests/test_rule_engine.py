import datetime
import json
import os
import tempfile
import unittest

from aegis.core.rule_engine import RuleEngine


class TestRuleEngine(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.TemporaryDirectory()
        self.rules_file = os.path.join(self.test_dir.name, "rules.json")
        sample_rules = {
            "version": "1.0",
            "rules": [
                {
                    "id": "TEST_CRED_001",
                    "name": "Test Credential Read",
                    "description": "Detects reading sensitive files",
                    "severity": "CRITICAL",
                    "event_type": "file",
                    "mitre_technique": "T1552.001",
                    "action": "alert",
                    "confidence": 90,
                    "conditions": {
                        "fname_contains_any": [".env", "id_rsa"],
                        "comm_not_in": ["cat"]
                    }
                },
                {
                    "id": "TEST_EXEC_001",
                    "name": "Test Shell Execution",
                    "description": "Detects spawning bash",
                    "severity": "HIGH",
                    "event_type": "exec",
                    "mitre_technique": "T1059.004",
                    "action": "alert",
                    "confidence": 85,
                    "conditions": {
                        "fname_contains_any": ["bash", "sh"]
                    }
                },
                {
                    "id": "TEST_CHAIN_001",
                    "name": "Test Credential Theft Chain",
                    "description": "Detects credential read followed by shell spawn",
                    "severity": "CRITICAL",
                    "event_type": "chain",
                    "mitre_technique": "T1020",
                    "action": "kill",
                    "confidence": 98,
                    "conditions": {
                        "requires_sequence": ["TEST_CRED_001", "TEST_EXEC_001"],
                        "within_seconds": 30
                    }
                }
            ]
        }
        with open(self.rules_file, "w", encoding="utf-8") as f:
            json.dump(sample_rules, f)

        self.engine = RuleEngine(rules_path=self.rules_file)

    def tearDown(self):
        self.test_dir.cleanup()

    def test_load_rules(self):
        self.assertEqual(len(self.engine.rules), 3)
        self.assertIn("TEST_CRED_001", self.engine.rules_by_id)

    def test_evaluate_single_event_match(self):
        event = {
            "event_type": "file_open",
            "filename": "/app/.env",
            "comm": "node",
            "pid": 1234
        }
        matches = self.engine.evaluate_event(event)
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["rule_id"], "TEST_CRED_001")
        self.assertEqual(matches[0]["severity"], "CRITICAL")

    def test_evaluate_single_event_excluded_comm(self):
        event = {
            "event_type": "file_open",
            "filename": "/app/.env",
            "comm": "cat",
            "pid": 1234
        }
        matches = self.engine.evaluate_event(event)
        self.assertEqual(len(matches), 0)

    def test_evaluate_chain_match(self):
        now = datetime.datetime.now(datetime.timezone.utc)
        ts1 = now.isoformat() + "Z"
        ts2 = (now + datetime.timedelta(seconds=5)).isoformat() + "Z"

        pid_events = [
            {
                "timestamp": ts1,
                "event_type": "file_open",
                "filename": "/app/.env",
                "comm": "node",
                "pid": 5000
            },
            {
                "timestamp": ts2,
                "event_type": "exec_spawn",
                "filename": "bash -c id",
                "comm": "bash",
                "pid": 5000
            }
        ]

        chain_matches = self.engine.evaluate_chain(pid_events)
        self.assertEqual(len(chain_matches), 1)
        self.assertEqual(chain_matches[0]["rule_id"], "TEST_CHAIN_001")
        self.assertEqual(chain_matches[0]["action"], "kill")


if __name__ == "__main__":
    unittest.main()
