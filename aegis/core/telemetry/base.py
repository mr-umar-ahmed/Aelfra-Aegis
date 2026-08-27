"""
Aelfra Aegis — TelemetryBackend Abstract Base Class
Defines common interface for system monitoring backends (Linux eBPF, Windows Native, Mock).
"""

from abc import ABC, abstractmethod
import datetime
from typing import Any, Callable, Dict, Optional


class TelemetryBackend(ABC):
    def __init__(self, callback: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.callback = callback
        self.is_running = False

    @abstractmethod
    def name(self) -> str:
        """Returns the human-readable name of the telemetry backend."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Returns True if the underlying kernel/OS capabilities exist for this backend."""
        pass

    @abstractmethod
    def start(self) -> bool:
        """Initializes and starts event collection thread/probes."""
        pass

    @abstractmethod
    def stop(self) -> None:
        """Stops event collection cleanly."""
        pass

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """Returns diagnostic details regarding backend health and privileges."""
        pass

    def dispatch_event(self, event: Dict[str, Any]) -> None:
        """Normalizes and sends an event to the registered callback."""
        if not event.get("timestamp"):
            event["timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z"
        
        if self.callback:
            try:
                self.callback(event)
            except Exception:
                pass
