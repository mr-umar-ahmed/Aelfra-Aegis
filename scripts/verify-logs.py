#!/usr/bin/env python3
"""
Aelfra Aegis SIEM Log Hygiene & Verification Tool
Scans and validates SIEM-compatible JSONL audit logs in /data/audit/.
Checks JSON syntax integrity, schema compliance, and outputs telemetry metrics.
Usage: python3 scripts/verify-logs.py [path/to/logfile.jsonl]
"""

import collections
import json
import os
import sys

# Ensure UTF-8 stdout on all platforms including Windows terminals
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REQUIRED_FIELDS = [
    "schema_version",
    "source",
    "host",
    "timestamp",
    "severity",
    "event_type",
    "rule_id",
    "action_taken",
    "confidence",
]


def find_latest_audit_log(audit_dir: str) -> str:
    if not os.path.exists(audit_dir):
        print(f"[ERROR] Audit directory not found at {audit_dir}")
        sys.exit(1)

    jsonl_files = [
        os.path.join(audit_dir, f) for f in os.listdir(audit_dir) if f.endswith(".jsonl")
    ]
    if not jsonl_files:
        print(f"[NOTICE] No JSONL audit log files found in {audit_dir}")
        sys.exit(0)

    jsonl_files.sort(key=os.path.getmtime, reverse=True)
    return jsonl_files[0]


def verify_log_file(filepath: str):
    print(f"[*] Analyzing Aegis SIEM Audit Log: {os.path.abspath(filepath)}")
    print("=" * 65)

    total_lines = 0
    valid_lines = 0
    errors = []

    severity_counts = collections.Counter()
    rule_counts = collections.Counter()
    tactic_counts = collections.Counter()
    action_counts = collections.Counter()

    with open(filepath, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            total_lines += 1

            try:
                record = json.loads(stripped)
                missing = [f for f in REQUIRED_FIELDS if f not in record]
                if missing:
                    errors.append(f"Line {idx}: Missing required fields {missing}")
                    continue

                valid_lines += 1
                severity_counts[record.get("severity", "UNKNOWN")] += 1
                rule_counts[record.get("rule_id", "UNKNOWN")] += 1
                tactic_counts[record.get("mitre_tactic", "Uncategorized")] += 1
                action_counts[record.get("action_taken", "unknown")] += 1

            except json.JSONDecodeError as e:
                errors.append(f"Line {idx}: Invalid JSON syntax — {e}")

    print(f"[METRICS] Total Events Analyzed : {total_lines}")
    print(f"[STATUS]  Validated JSON Lines  : {valid_lines} ({(valid_lines/total_lines*100) if total_lines else 0:.1f}%)")

    if errors:
        print(f"\n[!] Validation Errors ({len(errors)}):")
        for err in errors[:10]:
            print(f"   • {err}")
        if len(errors) > 10:
            print(f"   ... and {len(errors) - 10} more errors")

    print("\n[+] Severity Breakdown:")
    for sev, count in severity_counts.most_common():
        print(f"   • {sev:<12} : {count:>4} events")

    print("\n[+] Detection Rule Breakdown:")
    for rule, count in rule_counts.most_common():
        print(f"   • {rule:<12} : {count:>4} events")

    print("\n[+] MITRE ATT&CK Tactic Breakdown:")
    for tactic, count in tactic_counts.most_common():
        print(f"   • {tactic:<20} : {count:>4} events")

    print("\n[+] Action Taken Breakdown:")
    for act, count in action_counts.most_common():
        print(f"   • {act:<12} : {count:>4} events")

    print("=" * 65)
    if errors:
        print("[-] Log verification failed with formatting errors.")
        sys.exit(1)
    else:
        print("[+] Log verification passed with 100% SIEM compliance!")
        sys.exit(0)


def main():
    if len(sys.argv) > 1:
        target_file = sys.argv[1]
    else:
        default_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "audit"
        )
        target_file = find_latest_audit_log(default_dir)

    verify_log_file(target_file)


if __name__ == "__main__":
    main()
