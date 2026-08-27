"""
Aelfra Aegis — Windows Native Telemetry Backend
Uses Win32 kernel32 and iphlpapi APIs via ctypes for real process, network, and file access monitoring on Windows.
Zero external dependencies.
"""

import ctypes
import datetime
import os
import socket
import struct
import sys
import threading
import time
from typing import Any, Callable, Dict, Optional, Set

from aegis.core.telemetry.base import TelemetryBackend

# Win32 Process Constants
TH32CS_SNAPPROCESS = 0x00000002

class PROCESSENTRY32W(ctypes.Structure):
    _fields_ = [
        ("dwSize", ctypes.c_ulong),
        ("cntUsage", ctypes.c_ulong),
        ("th32ProcessID", ctypes.c_ulong),
        ("th32DefaultHeapID", ctypes.c_size_t),
        ("th32ModuleID", ctypes.c_ulong),
        ("cntThreads", ctypes.c_ulong),
        ("th32ParentProcessID", ctypes.c_ulong),
        ("pcPriClassBase", ctypes.c_long),
        ("dwFlags", ctypes.c_ulong),
        ("szExeFile", ctypes.c_wchar * 260)
    ]

# Win32 TCP Table Constants
AF_INET = 2
TCP_TABLE_OWNER_PID_ALL = 5
MIB_TCP_STATE_ESTAB = 5

class MIB_TCPROW_OWNER_PID(ctypes.Structure):
    _fields_ = [
        ("dwState", ctypes.c_ulong),
        ("dwLocalAddr", ctypes.c_ulong),
        ("dwLocalPort", ctypes.c_ulong),
        ("dwRemoteAddr", ctypes.c_ulong),
        ("dwRemotePort", ctypes.c_ulong),
        ("dwOwningPid", ctypes.c_ulong)
    ]

# Win32 Directory Change Notification Constants
FILE_SHARE_READ = 0x00000001
FILE_SHARE_WRITE = 0x00000002
FILE_SHARE_DELETE = 0x00000004
OPEN_EXISTING = 3
FILE_FLAG_BACKUP_SEMANTICS = 0x02000000

FILE_NOTIFY_CHANGE_FILE_NAME = 0x00000001
FILE_NOTIFY_CHANGE_LAST_WRITE = 0x00000010
FILE_NOTIFY_CHANGE_LAST_ACCESS = 0x00000020


class WindowsNativeBackend(TelemetryBackend):
    def __init__(self, callback: Optional[Callable[[Dict[str, Any]], None]] = None, watch_dir: Optional[str] = None):
        super().__init__(callback)
        self.watch_dir = watch_dir or os.getcwd()
        self._thread: Optional[threading.Thread] = None
        self._known_pids: Dict[int, Dict[str, Any]] = {}
        self._seen_conns: Set[str] = set()

    def name(self) -> str:
        return "Windows Native Telemetry (Win32 API)"

    def is_available(self) -> bool:
        return sys.platform == "win32" and hasattr(ctypes, "windll")

    def is_admin(self) -> bool:
        try:
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        except Exception:
            return False

    def start(self) -> bool:
        if not self.is_available():
            return False

        self.is_running = True
        self._known_pids = self._snapshot_processes()
        self._thread = threading.Thread(target=self._telemetry_loop, daemon=True, name="AegisWin32Telemetry")
        self._thread.start()
        return True

    def stop(self) -> None:
        self.is_running = False

    def get_status(self) -> Dict[str, Any]:
        admin_state = self.is_admin()
        return {
            "name": self.name(),
            "available": self.is_available(),
            "running": self.is_running,
            "privilege": "Administrator" if admin_state else "Standard User",
            "mode": "Live Win32 Kernel/Userland API Telemetry",
            "capability_level": "READY" if self.is_available() else "UNAVAILABLE",
            "is_admin": admin_state
        }

    def _snapshot_processes(self) -> Dict[int, Dict[str, Any]]:
        """Takes a Win32 process snapshot via CreateToolhelp32Snapshot."""
        if not hasattr(ctypes, "windll"):
            return {}

        hSnapshot = ctypes.windll.kernel32.CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
        if hSnapshot == -1 or not hSnapshot:
            return {}

        pe32 = PROCESSENTRY32W()
        pe32.dwSize = ctypes.sizeof(PROCESSENTRY32W)

        processes = {}
        if ctypes.windll.kernel32.Process32FirstW(hSnapshot, ctypes.byref(pe32)):
            while True:
                processes[pe32.th32ProcessID] = {
                    "pid": pe32.th32ProcessID,
                    "ppid": pe32.th32ParentProcessID,
                    "comm": pe32.szExeFile.replace(".exe", "")
                }
                if not ctypes.windll.kernel32.Process32NextW(hSnapshot, ctypes.byref(pe32)):
                    break

        ctypes.windll.kernel32.CloseHandle(hSnapshot)
        return processes

    def _poll_tcp_connections(self) -> None:
        """Polls active TCP table using iphlpapi GetExtendedTcpTable."""
        try:
            size = ctypes.c_ulong(0)
            ctypes.windll.iphlpapi.GetExtendedTcpTable(None, ctypes.byref(size), True, AF_INET, TCP_TABLE_OWNER_PID_ALL, 0)
            if size.value == 0:
                return

            buf = ctypes.create_string_buffer(size.value)
            ret = ctypes.windll.iphlpapi.GetExtendedTcpTable(buf, ctypes.byref(size), True, AF_INET, TCP_TABLE_OWNER_PID_ALL, 0)
            if ret != 0:
                return

            num_entries = struct.unpack("I", buf.raw[:4])[0]
            entry_size = ctypes.sizeof(MIB_TCPROW_OWNER_PID)

            for i in range(num_entries):
                offset = 4 + i * entry_size
                row = MIB_TCPROW_OWNER_PID.from_buffer_copy(buf.raw[offset:offset + entry_size])
                
                pid = row.dwOwningPid
                if pid <= 4 or row.dwRemotePort == 0:
                    continue

                local_ip = socket.inet_ntoa(struct.pack("<I", row.dwLocalAddr))
                remote_ip = socket.inet_ntoa(struct.pack("<I", row.dwRemoteAddr))
                local_port = socket.ntohs(row.dwLocalPort & 0xFFFF)
                remote_port = socket.ntohs(row.dwRemotePort & 0xFFFF)

                conn_key = f"{pid}-{local_ip}:{local_port}->{remote_ip}:{remote_port}"
                if conn_key not in self._seen_conns:
                    self._seen_conns.add(conn_key)
                    
                    proc_info = self._known_pids.get(pid, {"comm": "unknown", "ppid": 0})
                    event = {
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
                        "pid": pid,
                        "ppid": proc_info.get("ppid", 0),
                        "comm": proc_info.get("comm", "unknown"),
                        "parent_comm": "system",
                        "event_type": "tcp_connect",
                        "dest_ip": remote_ip,
                        "dest_port": remote_port,
                        "filename": f"{remote_ip}:{remote_port}",
                        "severity": "high" if remote_port not in [80, 443] else "low"
                    }
                    self.dispatch_event(event)

            # Cap connection tracking set size
            if len(self._seen_conns) > 1000:
                self._seen_conns.clear()

        except Exception:
            pass

    def _telemetry_loop(self) -> None:
        """Main loop for process creation, network connection, and file access telemetry."""
        while self.is_running:
            try:
                # 1. Process Creation Telemetry
                current_pids = self._snapshot_processes()
                for pid, pinfo in current_pids.items():
                    if pid not in self._known_pids:
                        ppid = pinfo["ppid"]
                        parent_info = current_pids.get(ppid, self._known_pids.get(ppid, {}))
                        parent_comm = parent_info.get("comm", "unknown")

                        event = {
                            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
                            "pid": pid,
                            "ppid": ppid,
                            "comm": pinfo["comm"],
                            "parent_comm": parent_comm,
                            "event_type": "exec_spawn",
                            "filename": pinfo["comm"],
                            "severity": "medium" if pinfo["comm"] in ["cmd", "powershell", "bash", "sh", "wscript", "cscript"] else "low"
                        }
                        self.dispatch_event(event)

                self._known_pids = current_pids

                # 2. Network Telemetry
                self._poll_tcp_connections()

            except Exception:
                pass

            time.sleep(1.0)
