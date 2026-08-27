"""
Aelfra Aegis — Mock Telemetry Backend
Generates synthetic event streams for CI, development, and unsupported environments.
"""

import datetime
import threading
import time
from typing import Any, Callable, Dict, Optional

from aegis.core.telemetry.base import TelemetryBackend


class MockTelemetryBackend(TelemetryBackend):
    def __init__(self, callback: Optional[Callable[[Dict[str, Any]], None]] = None):
        super().__init__(callback)
        self._thread: Optional[threading.Thread] = None

    def name(self) -> str:
        return "Mock Telemetry Stream"

    def is_available(self) -> bool:
        return True

    def start(self) -> bool:
        self.is_running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="AegisMockTelemetry")
        self._thread.start()
        return True

    def stop(self) -> None:
        self.is_running = False

    def get_status(self) -> Dict[str, Any]:
        return {
            "name": self.name(),
            "available": True,
            "running": self.is_running,
            "privilege": "Standard User",
            "mode": "Synthetic Stream",
            "capability_level": "MOCK"
        }

    def _loop(self) -> None:
        counter = 0
        while self.is_running:
            time.sleep(4.0)
            counter += 1
            mock_event = {
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
                "pid": 5820 + (counter % 5),
                "ppid": 1200,
                "comm": "node",
                "parent_comm": "npm",
                "event_type": "file_open" if counter % 2 == 0 else "exec_spawn",
                "filename": ".env" if counter % 3 == 0 else "install.js",
                "severity": "critical" if counter % 3 == 0 else "medium",
                "risk_score": 90 if counter % 3 == 0 else 30,
            }
            self.dispatch_event(mock_event)
