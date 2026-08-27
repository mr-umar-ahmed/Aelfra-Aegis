import sys
import unittest

from aegis.core.telemetry import (
    TelemetryBackend,
    TelemetryManager,
    LinuxEBPFBackend,
    WindowsNativeBackend,
    MockTelemetryBackend,
)


class TestTelemetryManager(unittest.TestCase):
    def test_mock_backend_dispatch(self):
        received = []

        def cb(event):
            received.append(event)

        mock_backend = MockTelemetryBackend(callback=cb)
        self.assertTrue(mock_backend.is_available())
        self.assertEqual(mock_backend.name(), "Mock Telemetry Stream")

        status = mock_backend.get_status()
        self.assertEqual(status["capability_level"], "MOCK")

        event = {"event_type": "file_open", "filename": ".env"}
        mock_backend.dispatch_event(event)

        self.assertEqual(len(received), 1)
        self.assertIn("timestamp", received[0])
        self.assertEqual(received[0]["filename"], ".env")

    def test_windows_native_backend_availability(self):
        backend = WindowsNativeBackend()
        if sys.platform == "win32":
            self.assertTrue(backend.is_available())
            self.assertEqual(backend.name(), "Windows Native Telemetry (Win32 API)")
            status = backend.get_status()
            self.assertEqual(status["capability_level"], "READY")
        else:
            self.assertFalse(backend.is_available())

    def test_linux_ebpf_backend_availability(self):
        backend = LinuxEBPFBackend()
        if sys.platform.startswith("linux"):
            pass  # May or may not have BCC installed
        else:
            self.assertFalse(backend.is_available())

    def test_telemetry_manager_auto_selection(self):
        tm = TelemetryManager()
        selected = tm.select_best_backend()
        self.assertIsNotNone(selected)

        status = tm.get_status()
        self.assertIn("selected_backend", status)
        self.assertIn("active", status)
        self.assertIn("all_backends", status)

        if sys.platform == "win32":
            self.assertEqual(selected.name(), "Windows Native Telemetry (Win32 API)")


if __name__ == "__main__":
    unittest.main()
