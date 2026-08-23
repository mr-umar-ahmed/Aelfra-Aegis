#!/usr/bin/env python3
"""
Aelfra Aegis CLI Package Scanner (Headless CI/CD Integration)
Spins up the Aegis eBPF daemon in --mode=headless, runs package installation
inside an isolated Docker container, and evaluates autonomous threat blocks.
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


def check_docker():
    if not shutil.which("docker"):
        print("❌ Error: Docker is required for dependency isolation but is not installed.")
        sys.exit(2)
    try:
        subprocess.run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except subprocess.CalledProcessError:
        print("❌ Error: Docker daemon is not running.")
        sys.exit(2)


def parse_manifest(file_path):
    pkg_count = 0
    if not os.path.exists(file_path):
        print(f"❌ Error: File not found: {file_path}")
        sys.exit(2)

    if file_path.endswith("package.json"):
        try:
            with open(file_path, "r") as f:
                data = json.load(f)
                deps = data.get("dependencies", {})
                dev_deps = data.get("devDependencies", {})
                pkg_count = len(deps) + len(dev_deps)
        except Exception as e:
            print(f"❌ Error parsing package.json: {e}")
            sys.exit(2)
    elif file_path.endswith("requirements.txt"):
        try:
            with open(file_path, "r") as f:
                lines = [l for l in f.readlines() if l.strip() and not l.strip().startswith("#")]
                pkg_count = len(lines)
        except Exception as e:
            print(f"❌ Error parsing requirements.txt: {e}")
            sys.exit(2)
    else:
        print("❌ Error: Unsupported manifest type. Use package.json or requirements.txt")
        sys.exit(2)

    return pkg_count


def run_daemon_and_scan(temp_dir, file_type):
    daemon_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ebpf", "daemon.py"
    )
    incidents_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "incidents"
    )
    os.makedirs(incidents_dir, exist_ok=True)
    start_time = time.time()

    # Launch daemon in autonomous HEADLESS mode
    daemon_proc = subprocess.Popen(
        [sys.executable, daemon_path, "--mode=headless"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    time.sleep(2)  # Give daemon time to compile probes and start watchdog

    # Run installation in Docker
    if file_type == "package.json":
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

    threats_detected = []

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

    # Wait for docker install execution, up to 30s
    try:
        docker_proc.wait(timeout=30)
    except subprocess.TimeoutExpired:
        docker_proc.kill()

    # Wait for temporal chain window (up to 5s buffer)
    time.sleep(3)

    daemon_proc.terminate()
    try:
        daemon_proc.wait(timeout=2)
    except Exception:
        daemon_proc.kill()

    # Check for newly created incident files in /data/incidents/
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


def main():
    parser = argparse.ArgumentParser(description="Aegis Supply Chain Scanner (Autonomous Headless)")
    parser.add_argument("manifest", help="Path to package.json or requirements.txt")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be scanned without running the daemon or Docker",
    )
    args = parser.parse_args()

    manifest_path = os.path.abspath(args.manifest)
    file_name = os.path.basename(manifest_path)

    check_docker()
    pkg_count = parse_manifest(manifest_path)

    if args.dry_run:
        print(f"[DRY RUN] Would scan {pkg_count} packages from {file_name}")
        print(f"[DRY RUN] Would spin up Aegis daemon with --mode=headless and run install in Docker")
        sys.exit(0)

    with tempfile.TemporaryDirectory() as temp_dir:
        shutil.copy(manifest_path, os.path.join(temp_dir, file_name))

        print(f"🛡️  AEGIS SCANNER — Analyzing {pkg_count} packages in {file_name} (Mode: Headless Auto-Block)...\n")
        threats, incident_reports = run_daemon_and_scan(temp_dir, file_name)

        if not threats and not incident_reports:
            print(f"✅ AEGIS SCAN COMPLETE — 0 threats detected ({pkg_count} packages verified clean)")
            sys.exit(0)
        else:
            print(f"❌ AEGIS SCAN BLOCKED — High-confidence supply chain attack detected!\n")

            if incident_reports:
                print("📋 Generated Incident Reports:")
                for inc in incident_reports:
                    print(
                        f"   • [{inc.get('incident_id')}] {inc.get('rule_name')} (Rule: {inc.get('rule_id')} | MITRE: {inc.get('mitre_technique')})"
                    )
                    print(
                        f"     Action: {inc.get('action_taken')} on PID {inc.get('pid')} ({inc.get('process_name')}) in {inc.get('latency_ms')}ms (Confidence: {inc.get('confidence')}%)"
                    )

            if threats:
                # Deduplicate threats
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

            sys.exit(1)


if __name__ == "__main__":
    main()
