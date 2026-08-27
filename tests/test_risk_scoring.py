import unittest

from aegis.core.daemon import compute_risk_score


class TestRiskScoring(unittest.TestCase):
    def test_risk_score_clean(self):
        score = compute_risk_score(
            comm="node",
            ppid=1000,
            event_type="file_open",
            dest_port=80,
            fname="/app/index.js"
        )
        self.assertEqual(score, 0)

    def test_risk_score_credential_access(self):
        score = compute_risk_score(
            comm="node",
            ppid=1000,
            event_type="file_open",
            dest_port=0,
            fname="/app/.env"
        )
        self.assertGreaterEqual(score, 50)

    def test_risk_score_shell_spawn(self):
        score = compute_risk_score(
            comm="bash",
            ppid=1234,
            event_type="exec_spawn",
            dest_port=0,
            fname="bash -c id"
        )
        self.assertGreaterEqual(score, 35)

    def test_risk_score_non_standard_port(self):
        score = compute_risk_score(
            comm="python",
            ppid=1000,
            event_type="network",
            dest_port=9999,
            fname=""
        )
        self.assertGreaterEqual(score, 25)  # non-standard port 9999 (25)

    def test_risk_score_max_cap(self):
        score = compute_risk_score(
            comm="bash",
            ppid=1000,
            event_type="exec_spawn",
            dest_port=9999,
            fname="/app/.env"
        )
        self.assertEqual(score, 100)


if __name__ == "__main__":
    unittest.main()
