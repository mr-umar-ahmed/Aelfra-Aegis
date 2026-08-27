"""
Aelfra Aegis — TelemetryManager
Runtime capability auto-detector that selects the highest-capability supported backend (Linux eBPF > Windows Native > Mock).
"""

import sys
from typing import Any, Callable, Dict, List, Optional

from aegis.core.telemetry.base import TelemetryBackend
from aegis.core.telemetry.linux_ebpf import LinuxEBPFBackend
from aegis.core.telemetry.windows_native import WindowsNativeBackend
from aegis.core.telemetry.mock import MockTelemetryBackend


class TelemetryManager:
    def __init__(self, callback: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.callback = callback
        self.active_backend: Optional[TelemetryBackend] = None
        self.available_backends: List[TelemetryBackend] = []
        self._initialize_backends()

    def _initialize_backends(self) -> None:
        """Instantiates all candidate backends for detection."""
        self.available_backends = [
            LinuxEBPFBackend(callback=self.callback),
            WindowsNativeBackend(callback=self.callback),
            MockTelemetryBackend(callback=self.callback)
        ]

    def select_best_backend(self) -> TelemetryBackend:
        """
        Evaluates system capabilities and selects the strongest available backend.
        Linux + eBPF -> LinuxEBPFBackend
        Windows -> WindowsNativeBackend
        Fallback -> MockTelemetryBackend
        """
        for backend in self.available_backends:
            if backend.is_available():
                return backend
        return self.available_backends[-1]  # Mock fallback

    def start(self) -> bool:
        """Selects and starts the optimal telemetry backend."""
        self.active_backend = self.select_best_backend()
        print(f"[TELEMETRY MANAGER] Selected active backend: {self.active_backend.name()}", flush=True)
        return self.active_backend.start()

    def stop(self) -> None:
        if self.active_backend:
            self.active_backend.stop()

    def get_status(self) -> Dict[str, Any]:
        """Returns comprehensive telemetry status across all candidate backends."""
        active = self.active_backend or self.select_best_backend()
        active_status = active.get_status()
        
        all_statuses = [b.get_status() for b in self.available_backends]
        
        return {
            "selected_backend": active.name(),
            "active": active_status,
            "all_backends": all_statuses,
            "platform": sys.platform
        }
