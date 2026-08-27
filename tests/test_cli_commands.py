import io
import sys
import unittest
from unittest.mock import patch

from aegis.cli.main import main


class TestCLICommands(unittest.TestCase):
    def test_cli_doctor(self):
        with patch.object(sys, "argv", ["aegis", "doctor"]):
            f = io.StringIO()
            with patch("sys.stdout", f):
                try:
                    main()
                except SystemExit as e:
                    self.assertEqual(e.code, 0)
            output = f.getvalue()
            self.assertIn("AELFRA AEGIS SYSTEM DIAGNOSTICS", output)

    def test_cli_report(self):
        with patch.object(sys, "argv", ["aegis", "report"]):
            f = io.StringIO()
            with patch("sys.stdout", f):
                try:
                    main()
                except SystemExit as e:
                    self.assertEqual(e.code, 0)
            output = f.getvalue()
            self.assertIn("Clean Security State", output)

    def test_cli_scan_dry_run(self):
        with patch.object(sys, "argv", ["aegis", "scan", "--dry-run", "package.json"]):
            f = io.StringIO()
            with patch("sys.stdout", f):
                try:
                    main()
                except SystemExit as e:
                    self.assertEqual(e.code, 0)
            output = f.getvalue()
            self.assertIn("Would scan 1 packages", output)


if __name__ == "__main__":
    unittest.main()
