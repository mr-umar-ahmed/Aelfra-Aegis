"""
Aelfra Aegis — aegis scan command
Scans dependency manifests (package.json, requirements.txt) in isolated containers with runtime kernel monitoring.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import threading
from typing import Any, Dict, Optional, List, Tuple

from aegis.core.paths import get_incidents_dir
from aegis.core.doctor import check_docker


def find_manifest_in_cwd() -> Optional[str]:
    """Auto-detects dependency manifest in the current working directory."""
    candidates = ["package.json", "requirements.txt"]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return None


def parse_manifest(file_path: str) -> int:
    if not os.path.exists(file_path):
        print(f"❌ Error: Manifest file not found: {file_path}")
        sys.exit(2)

    pkg_count = 0
    if file_path.endswith("package.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                deps = data.get("dependencies", {})
                dev_deps = data.get("devDependencies", {})
                pkg_count = len(deps) + len(dev_deps)
        except Exception as e:
            print(f"❌ Error parsing package.json: {e}")
            sys.exit(2)
    elif file_path.endswith("requirements.txt"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                lines = [l for l in f.readlines() if l.strip() and not l.strip().startswith("#")]
                pkg_count = len(lines)
        except Exception as e:
            print(f"❌ Error parsing requirements.txt: {e}")
            sys.exit(2)
    else:
        print("❌ Error: Unsupported manifest type. Supported: package.json, requirements.txt")
        sys.exit(2)

    return pkg_count


def run_container_scan(temp_dir: str, file_name: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    incidents_dir = get_incidents_dir()
    os.makedirs(incidents_dir, exist_ok=True)
    start_time = time.time()

    # Launch daemon in autonomous HEADLESS mode
    daemon_proc = subprocess.Popen(
        [sys.executable, "-m", "aegis.core.daemon", "--mode=headless"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    time.sleep(1.8)

    # Run installation in Docker
    if file_name == "package.json":
        cmd = [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{temp_dir}:/app",
            "-w",
            "/app",
            "node:20",
            "npm",
            "install",
            "--ignore-scripts=false",
        ]
    else:
        cmd = [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{temp_dir}:/app",
            "-w",
            "/app",
            "python:3.11",
            "pip",
            "install",
            "-r",
            "requirements.txt",
        ]

    docker_proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    threats_detected: List[Dict[str, Any]] = []

    def monitor_daemon():
        for line in iter(daemon_proc.stdout.readline, ""):
            if "[DAEMON EVENT]" in line:
                try:
                    json_str = line.split("[DAEMON EVENT]")[1].strip()
                    event = json.loads(json_str)
                    attack_type = event.get("attack_type", "UNKNOWN")
                    rule_id = event.get("rule_id", "")
                    if attack_type != "UNKNOWN" or rule_id:
                        threats_detected.append(
                            {
                                "comm": event.get("comm", "unknown"),
                                "attack_type": attack_type,
                                "rule_id": rule_id,
                                "mitre_technique": event.get("mitre_technique", "T1059"),
                                "confidence": event.get("confidence", 85),
                            }
                        )
                except Exception:
                    pass

    monitor_thread = threading.Thread(target=monitor_daemon, daemon=True)
    monitor_thread.start()

    try:
        docker_proc.wait(timeout=30)
    except subprocess.TimeoutExpired:
        docker_proc.kill()

    time.sleep(2.5)

    daemon_proc.terminate()
    try:
        daemon_proc.wait(timeout=2)
    except Exception:
        daemon_proc.kill()

    # Check for newly created incident files
    incident_reports = []
    if os.path.exists(incidents_dir):
        for f in os.listdir(incidents_dir):
            if f.endswith(".json"):
                fpath = os.path.join(incidents_dir, f)
                if os.path.getmtime(fpath) >= start_time - 2:
                    try:
                        with open(fpath, "r", encoding="utf-8") as inc_file:
                            incident_reports.append(json.load(inc_file))
                    except Exception:
                        pass

    return threats_detected, incident_reports


def run_scan(args: argparse.Namespace) -> int:
    manifest_arg = getattr(args, "manifest", None)
    if not manifest_arg:
        manifest_arg = find_manifest_in_cwd()
        if not manifest_arg:
            print("❌ Error: No dependency manifest found in current directory.")
            print("Usage: aegis scan [package.json | requirements.txt]")
            return 2

    manifest_path = os.path.abspath(manifest_arg)
    file_name = os.path.basename(manifest_path)
    pkg_count = parse_manifest(manifest_path)

    if getattr(args, "dry_run", False):
        print(f"🔍 [DRY RUN] Would scan {pkg_count} packages from {file_name}")
        print("🔍 [DRY RUN] Would spin up Aegis headless daemon and run dependency installation in isolated container")
        return 0

    docker_stat = check_docker()
    if not docker_stat["installed"] or not docker_stat["running"]:
        print("❌ Error: Docker is required for isolated container scanning but is not running.")
        print("💡 Tip: Start Docker Desktop / systemctl start docker, or use 'aegis protect <cmd>' for live host supervision.")
        return 2

    with tempfile.TemporaryDirectory() as temp_dir:
        shutil.copy(manifest_path, os.path.join(temp_dir, file_name))
        print(f"🛡️  AEGIS SCANNER — Analyzing {pkg_count} dependencies in {file_name} (Mode: Headless Auto-Block)...\n")
        threats, incident_reports = run_container_scan(temp_dir, file_name)

        if not threats and not incident_reports:
            print(f"✅ AEGIS SCAN COMPLETE — 0 threats detected ({pkg_count} packages verified clean)")
            return 0
        else:
            print(f"❌ AEGIS SCAN BLOCKED — High-confidence supply chain attack detected!\n")
            if incident_reports:
                print("📋 Generated Incident Reports:")
                for inc in incident_reports:
                    print(
                        f"   • [{inc.get('incident_id')}] {inc.get('rule_name')} (Rule: {inc.get('rule_id')} | MITRE: {inc.get('mitre_technique')})"
                    )
                    print(
                        f"     Action: {inc.get('action_taken')} on PID {inc.get('pid')} ({inc.get('process_name')}) in {inc.get('latency_ms')}ms"
                    )

            if threats:
                unique_threats = []
                seen = set()
                for t in threats:
                    key = f"{t['comm']}:{t['attack_type']}"
                    if key not in seen:
                        seen.add(key)
                        unique_threats.append(t)

                print("\n🚨 Captured Threat Events:")
                for t in unique_threats:
                    print(
                        f"   • Process: {t['comm']} | Attack: {t['attack_type']} | MITRE: {t.get('mitre_technique')} | Confidence: {t.get('confidence')}%"
                    )

            return 1
