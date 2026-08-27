"""
Aelfra Aegis — aegis report command
Lists and displays forensic incident reports generated during threat blocks.
"""

import argparse
import json
import os
import sys
from typing import Optional

from aegis.core.paths import get_incidents_dir


def run_report(args: Optional[argparse.Namespace] = None) -> int:
    incidents_dir = get_incidents_dir()
    if not os.path.exists(incidents_dir):
        print(f"ℹ️  No incidents recorded at {incidents_dir}")
        return 0

    files = sorted([f for f in os.listdir(incidents_dir) if f.endswith(".json")], reverse=True)
    if not files:
        print("✅ Clean Security State: Zero incident reports on record.")
        return 0

    target_id = getattr(args, "id", None) if args else None

    if target_id:
        # Show specific incident
        target_file = None
        for f in files:
            if target_id.lower() in f.lower():
                target_file = os.path.join(incidents_dir, f)
                break
        if not target_file:
            print(f"❌ Incident not found: {target_id}")
            return 1

        with open(target_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        print(json.dumps(data, indent=2))
        return 0

    print(f"📋 Recorded Threat Incidents ({len(files)} total in {incidents_dir}):\n")
    print(f"{'INCIDENT ID':<18} {'SEVERITY':<10} {'RULE ID':<10} {'PROCESS':<12} {'PID':<8} {'ACTION':<10} {'TIME'}")
    print("─" * 80)

    for f in files:
        try:
            with open(os.path.join(incidents_dir, f), "r", encoding="utf-8") as file:
                data = json.load(file)
            inc_id = data.get("incident_id", "AGS-UNKNOWN")
            sev = data.get("severity", "CRITICAL")
            rule = data.get("rule_id", "UNKNOWN")
            proc = data.get("process_name", "unknown")
            pid = str(data.get("pid", ""))
            action = data.get("action_taken", "SIGKILL")
            ts = data.get("timestamp", "").split(".")[0]

            print(f"{inc_id:<18} {sev:<10} {rule:<10} {proc:<12} {pid:<8} {action:<10} {ts}")
        except Exception:
            pass

    print("\n💡 View full details: aegis report --id <INCIDENT_ID>")
    return 0
