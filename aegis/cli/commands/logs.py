"""
Aelfra Aegis — aegis logs command
Tails and formats SIEM-compatible JSON Lines (.jsonl) audit logs.
"""

import argparse
import json
import os
import sys
import time
from typing import Optional

from aegis.core.paths import get_audit_dir


def run_logs(args: Optional[argparse.Namespace] = None) -> int:
    audit_dir = get_audit_dir()
    if not os.path.exists(audit_dir):
        print(f"ℹ️  No audit logs found at {audit_dir}")
        return 0

    log_files = sorted([f for f in os.listdir(audit_dir) if f.endswith(".jsonl")])
    if not log_files:
        print(f"ℹ️  No JSONL log files found in {audit_dir}")
        return 0

    latest_file = os.path.join(audit_dir, log_files[-1])
    tail_count = getattr(args, "tail", 20) if args else 20

    print(f"📋 Reading latest audit trail: {latest_file}\n")
    try:
        with open(latest_file, "r", encoding="utf-8") as f:
            lines = f.readlines()

        slice_lines = lines[-tail_count:] if len(lines) > tail_count else lines
        for line in slice_lines:
            try:
                record = json.loads(line.strip())
                ts = record.get("timestamp", "").split("T")[-1].replace("Z", "")
                sev = record.get("severity", "INFO")
                pid = record.get("pid", "")
                proc = record.get("process_name", "")
                rule = record.get("rule_id", "GENERAL")
                detail = record.get("detail", "")
                action = record.get("action_taken", "")

                print(f"[{ts}] [{sev:8}] PID:{pid:<5} ({proc:<8}) | Rule:{rule:<8} | Action:{action:<7} | {detail}")
            except Exception:
                print(line.strip())

    except Exception as e:
        print(f"❌ Error reading logs: {e}")
        return 1

    return 0
