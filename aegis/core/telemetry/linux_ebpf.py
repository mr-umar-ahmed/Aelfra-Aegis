"""
Aelfra Aegis — Linux eBPF Telemetry Backend
Encapsulates BCC C probe compilation and BPF ring buffer event streaming on Linux.
"""

import datetime
import os
import socket
import struct
import sys
import threading
from typing import Any, Callable, Dict, Optional

from aegis.core.paths import is_root, get_package_asset_path
from aegis.core.telemetry.base import TelemetryBackend

try:
    from bcc import BPF  # type: ignore
except ImportError:
    BPF = None


class LinuxEBPFBackend(TelemetryBackend):
    def __init__(self, callback: Optional[Callable[[Dict[str, Any]], None]] = None):
        super().__init__(callback)
        self.b_instance = None
        self._thread: Optional[threading.Thread] = None

    def name(self) -> str:
        return "Linux Kernel eBPF Probes (BCC)"

    def is_available(self) -> bool:
        probe_c_path = get_package_asset_path("probes.c")
        return BPF is not None and sys.platform.startswith("linux") and os.path.exists(probe_c_path)

    def start(self) -> bool:
        if not self.is_available():
            return False

        probe_c_path = get_package_asset_path("probes.c")
        try:
            with open(probe_c_path, "r", encoding="utf-8") as f:
                c_src = f.read()

            self.b_instance = BPF(text=c_src)
            self.b_instance.attach_kprobe(event="__x64_sys_connect", fn_name="trace_tcp_connect")

            def handle_bpf_event(ctx, data, size):
                try:
                    raw = struct.unpack("IIQI16s16s256sIH", data[:312])
                    pid, ppid, uid, ts_ns = raw[0], raw[1], raw[2], raw[3]
                    comm = raw[4].decode("utf-8", errors="ignore").rstrip("\x00")
                    evt_type = raw[5].decode("utf-8", errors="ignore").rstrip("\x00")
                    filename = raw[6].decode("utf-8", errors="ignore").rstrip("\x00")
                    dest_ip_int, dest_port = raw[7], raw[8]
                    dest_ip = socket.inet_ntoa(struct.pack("!I", socket.ntohl(dest_ip_int))) if dest_ip_int else ""

                    event = {
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
                        "pid": pid,
                        "ppid": ppid,
                        "uid": uid,
                        "comm": comm,
                        "event_type": evt_type,
                        "filename": filename,
                        "dest_ip": dest_ip,
                        "dest_port": dest_port,
                    }
                    self.dispatch_event(event)
                except Exception:
                    pass

            self.b_instance["events"].open_ring_buffer(handle_bpf_event)
            self.is_running = True

            def ring_poll_loop():
                while self.is_running and self.b_instance:
                    self.b_instance.ring_buffer_poll(timeout=100)

            self._thread = threading.Thread(target=ring_poll_loop, daemon=True, name="AegisLinuxEBPFPoller")
            self._thread.start()
            return True

        except Exception:
            self.is_running = False
            return False

    def stop(self) -> None:
        self.is_running = False

    def get_status(self) -> Dict[str, Any]:
        root = is_root()
        avail = self.is_available()
        return {
            "name": self.name(),
            "available": avail,
            "running": self.is_running,
            "privilege": "Root" if root else "Non-Root",
            "mode": "Live Kernel kprobes & Tracepoints",
            "capability_level": "READY" if (avail and root) else "LIMITED",
            "is_root": root
        }
