#!/usr/bin/env python3
"""
Aelfra Aegis SIEM-Compatible Structured Logger (Industry Upgrade 3)
Emits self-contained, append-only JSON Lines (JSONL) events to /data/audit/aegis-YYYY-MM-DD.jsonl.
Zero external dependencies, automatic daily UTC rotation, and unbuffered disk writes.
"""

import datetime
import json
import os
import socket
import threading
from typing import Any, Dict, Optional

MITRE_TACTICS: Dict[str, str] = {
    "T1552.001": "Credential Access",
    "T1059.004": "Execution",
    "T1059.006": "Execution",
    "T1071.001": "Command and Control",
    "T1020": "Exfiltration",
    "T1078": "Defense Evasion",
    "T1496": "Impact",
    "T1036.005": "Defense Evasion",
    "T1082": "Discovery",
    "T1546": "Persistence",
}


class StructuredLogger:
    def __init__(self, audit_dir: Optional[str] = None):
        if audit_dir is None:
            audit_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "audit"
            )
        self.audit_dir = os.path.abspath(audit_dir)
        os.makedirs(self.audit_dir, exist_ok=True)
        self.hostname = socket.gethostname()
        self.aegis_version = "1.0.0"
        self._lock = threading.Lock()

    def _get_current_log_path(self) -> str:
        """
        Dynamically derives the target log file path based on the current UTC date.
        Rotates automatically when UTC midnight passes without needing cron or timers.
        """
        date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        return os.path.join(self.audit_dir, f"aegis-{date_str}.jsonl")

    def _write_record(self, record: Dict[str, Any]):
        filepath = self._get_current_log_path()
        line = json.dumps(record, ensure_ascii=False) + "\n"
        with self._lock:
            with open(filepath, "a", encoding="utf-8") as f:
                f.write(line)
                f.flush()  # Zero buffering: guarantees write survival on sudden kill/crash

    def log_event(
        self,
        event: Dict[str, Any],
        rule_match: Optional[Dict[str, Any]] = None,
        action_taken: str = "alert",
    ):
        """
        Logs a standard kernel security event with MITRE ATT&CK taxonomy tags.
        """
        now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        mitre_tech = ""
        mitre_tactic = "Execution"
        rule_id = "GENERAL"
        rule_name = "Kernel Syscall Event"
        severity = event.get("severity", "LOW").upper()
        confidence = 80

        if rule_match:
            rule_id = rule_match.get("rule_id", "GENERAL")
            rule_name = rule_match.get("rule_name", rule_match.get("description", "Security Alert"))
            severity = rule_match.get("severity", severity).upper()
            mitre_tech = rule_match.get("mitre_technique", "")
            mitre_tactic = MITRE_TACTICS.get(mitre_tech, "Initial Access")
            confidence = rule_match.get("confidence", 85)

        detail = event.get("filename") or event.get("detail") or ""
        if event.get("event_type") in ("network", "tcp_connect") and event.get("dest_ip"):
            detail = f"{event.get('dest_ip')}:{event.get('dest_port', 0)}"

        record = {
            "schema_version": "1.0",
            "source": "aegis-daemon",
            "host": self.hostname,
            "timestamp": now_utc,
            "severity": severity,
            "event_type": event.get("event_type", "unknown"),
            "rule_id": rule_id,
            "rule_name": rule_name,
            "mitre_technique": mitre_tech,
            "mitre_tactic": mitre_tactic,
            "pid": event.get("pid", 0),
            "ppid": event.get("ppid", 0),
            "process_name": event.get("comm", "unknown"),
            "parent_process": event.get("parent_comm", "unknown"),
            "detail": detail,
            "action_taken": action_taken,
            "confidence": confidence,
            "aegis_version": self.aegis_version,
        }

        self._write_record(record)

    def log_lifecycle(self, lifecycle_event: str, **kwargs):
        """
        Logs daemon boot, shutdown, and config change events.
        """
        now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        record = {
            "schema_version": "1.0",
            "source": "aegis-daemon",
            "host": self.hostname,
            "timestamp": now_utc,
            "severity": "INFO",
            "event_type": lifecycle_event,
            "rule_id": "SYSTEM",
            "rule_name": f"Aegis Daemon Lifecycle ({lifecycle_event})",
            "mitre_technique": "N/A",
            "mitre_tactic": "Management",
            "pid": os.getpid(),
            "ppid": os.getppid(),
            "process_name": "aegis-daemon",
            "parent_process": "systemd/shell",
            "detail": f"Daemon state change: {lifecycle_event}",
            "action_taken": "logged",
            "confidence": 100,
            "aegis_version": self.aegis_version,
        }
        record.update(kwargs)
        self._write_record(record)
