"""
Aelfra Aegis Telemetry Module
Modular telemetry system supporting Linux eBPF, Windows Native (Win32 API), and Mock fallbacks.
"""

from aegis.core.telemetry.base import TelemetryBackend
from aegis.core.telemetry.linux_ebpf import LinuxEBPFBackend
from aegis.core.telemetry.windows_native import WindowsNativeBackend
from aegis.core.telemetry.mock import MockTelemetryBackend
from aegis.core.telemetry.manager import TelemetryManager

__all__ = [
    "TelemetryBackend",
    "LinuxEBPFBackend",
    "WindowsNativeBackend",
    "MockTelemetryBackend",
    "TelemetryManager",
]
