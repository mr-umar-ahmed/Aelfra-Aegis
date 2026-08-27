"""
Aelfra Aegis — aegis protect <command>
Supervises and monitors the execution of an arbitrary command (e.g. npm install, pip install).
Ensures Aegis runtime monitoring is active, forwards signals/exit codes, and reports any triggered threats.
"""

import os
import signal
import subprocess
import sys
import time
from typing import List, Optional

from aegis.core.paths import get_incidents_dir, get_global_data_dir
from aegis.core.doctor import check_daemon_running
from aegis.core.process_manager import start_daemon


def run_protect(command_args: List[str]) -> int:
    if not command_args:
        print("❌ Error: No command specified to protect.")
        print("Usage: aegis protect <command> [args...]")
        print("Example: aegis protect npm install")
        return 2

    # 1. Ensure Aegis daemon is running
    status = check_daemon_running()
    started_by_us = False
    if not status.get("running"):
        print("🛡️  Starting background Aegis runtime monitor...")
        start_res = start_daemon(mode="headless", threshold=90, background=True)
        if start_res.get("success"):
            started_by_us = True
            time.sleep(0.5)

    incidents_dir = get_incidents_dir()
    start_time = time.time()

    cmd_str = " ".join(command_args)
    print(f"🛡️  [AEGIS SUPERVISOR] Running protected command: {cmd_str}\n")

    # 2. Run target command, forwarding stdio and environment
    child_proc = None
    exit_code = 0

    def sigint_handler(sig, frame):
        if child_proc and child_proc.poll() is None:
            try:
                child_proc.send_signal(sig)
            except Exception:
                pass

    old_sigint = signal.signal(signal.SIGINT, sigint_handler)

    try:
        child_proc = subprocess.Popen(command_args)
        exit_code = child_proc.wait()
    except FileNotFoundError:
        print(f"❌ Error: Command not found: {command_args[0]}")
        return 127
    except Exception as e:
        print(f"❌ Error executing command: {e}")
        return 1
    finally:
        signal.signal(signal.SIGINT, old_sigint)

    # 3. Check if any new incidents were recorded during this execution
    new_incidents = []
    if os.path.exists(incidents_dir):
        for f in os.listdir(incidents_dir):
            if f.endswith(".json"):
                fpath = os.path.join(incidents_dir, f)
                if os.path.getmtime(fpath) >= start_time - 1.0:
                    try:
                        import json
                        with open(fpath, "r", encoding="utf-8") as inc_f:
                            new_incidents.append(json.load(inc_f))
                    except Exception:
                        pass

    # 4. Report results
    print(f"\n────────────────────────────────────────────────────────────────")
    if new_incidents:
        print("🚨 [AEGIS SECURITY ALERT] Security threats were detected during execution!")
        for inc in new_incidents:
            print(f"   • [{inc.get('incident_id')}] {inc.get('rule_name')} (Rule: {inc.get('rule_id')} | MITRE: {inc.get('mitre_technique')})")
            print(f"     Action: {inc.get('action_taken')} on PID {inc.get('pid')} ({inc.get('process_name')})")
        print("────────────────────────────────────────────────────────────────")
        # Fail the execution if threats were found
        return 1 if exit_code == 0 else exit_code
    else:
        print("✅ [AEGIS SUPERVISOR] Command execution finished. Zero security anomalies detected.")
        print("────────────────────────────────────────────────────────────────")
        return exit_code
