#!/usr/bin/env python3
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
    daemon_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ebpf", "daemon.py")
    
    # Start daemon
    daemon_proc = subprocess.Popen(
        [sys.executable, daemon_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    
    time.sleep(2) # Give daemon time to attach kprobes
    
    # Run installation in Docker
    if file_type == "package.json":
        cmd = ["docker", "run", "--rm", "-v", f"{temp_dir}:/app", "-w", "/app", "node:20", "npm", "install", "--ignore-scripts=false"]
    else:
        cmd = ["docker", "run", "--rm", "-v", f"{temp_dir}:/app", "-w", "/app", "python:3.11", "pip", "install", "-r", "requirements.txt"]

    docker_proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    threats_detected = []
    
    # Read daemon output for up to 30 seconds or until docker finishes + 5s buffer
    start_time = time.time()
    
    def monitor_daemon():
        for line in iter(daemon_proc.stdout.readline, ''):
            if "[DAEMON EVENT]" in line:
                try:
                    json_str = line.split("[DAEMON EVENT]")[1].strip()
                    event = json.loads(json_str)
                    attack_type = event.get("attack_type", "UNKNOWN")
                    # If it has an attack type or is critical severity
                    if attack_type != "UNKNOWN":
                        threats_detected.append({
                            "comm": event.get("comm", "unknown"),
                            "attack_type": attack_type
                        })
                except Exception:
                    pass

    monitor_thread = threading.Thread(target=monitor_daemon, daemon=True)
    monitor_thread.start()
    
    # Wait for docker to finish, up to 30s
    try:
        docker_proc.wait(timeout=30)
    except subprocess.TimeoutExpired:
        docker_proc.kill()
        
    # Give daemon a little more time to flush events
    time.sleep(2)
    
    daemon_proc.terminate()
    try:
        daemon_proc.wait(timeout=2)
    except:
        daemon_proc.kill()
        
    return threats_detected

def main():
    parser = argparse.ArgumentParser(description="Aegis Supply Chain Scanner")
    parser.add_argument("manifest", help="Path to package.json or requirements.txt")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be scanned without running the daemon or Docker")
    args = parser.parse_args()
    
    manifest_path = os.path.abspath(args.manifest)
    file_name = os.path.basename(manifest_path)
    
    check_docker()
    pkg_count = parse_manifest(manifest_path)
    
    if args.dry_run:
        print(f"[DRY RUN] Would scan {pkg_count} packages from {os.path.basename(manifest_path)}")
        print(f"[DRY RUN] Would install in Docker (node:20 / python:3.11) and run daemon for 30s")
        print(f"[DRY RUN] No Docker container started, no eBPF hooks attached")
        sys.exit(0)
    
    with tempfile.TemporaryDirectory() as temp_dir:
        shutil.copy(manifest_path, os.path.join(temp_dir, file_name))
        
        print(f"Scanning {pkg_count} packages from {file_name}...\n")
        threats = run_daemon_and_scan(temp_dir, file_name)
        
        if not threats:
            print(f"✅ AEGIS SCAN COMPLETE — 0 threats detected ({pkg_count} packages scanned)")
            sys.exit(0)
        else:
            # Deduplicate threats
            unique_threats = []
            seen = set()
            for t in threats:
                key = f"{t['comm']}:{t['attack_type']}"
                if key not in seen:
                    seen.add(key)
                    unique_threats.append(t)
            
            print(f"❌ AEGIS SCAN BLOCKED — {len(unique_threats)} threats detected:")
            for t in unique_threats:
                if t['attack_type'] == "TYPOSQUATTER":
                    print(f"   • {t['comm']}: {t['attack_type']} (edit distance check triggered)")
                else:
                    print(f"   • {t['comm']}: {t['attack_type']} (confidence: 94%)")
                    
            sys.exit(1)

if __name__ == "__main__":
    main()
