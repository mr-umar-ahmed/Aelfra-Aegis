"""
Aelfra Aegis — Packaged eBPF Security Daemon & Autonomous Defense Engine
Integrates BCC ring buffer / kprobes with a JSON policy rule engine,
SIEM-compatible structured JSONL audit logger, Grafana Loki log shipper,
real-time WebSocket bridge, and autonomous headless SIGKILL blocking.
"""

import argparse
import asyncio
import datetime
import json
import os
import signal
import socket
import sqlite3
import struct
import sys
import threading
import time
import urllib.parse
import urllib.request
from collections import deque
from typing import Any, Dict, List, Optional, Set

# Ensure UTF-8 output encoding across Windows/Linux terminals
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from aegis.core.paths import (
    get_package_asset_path,
    get_global_data_dir,
    get_audit_dir,
    get_incidents_dir,
    get_db_path,
    get_pid_file_path,
)
from aegis.core.config import AegisConfig
from aegis.core.rule_engine import RuleEngine
from aegis.core.structured_logger import StructuredLogger
from aegis.core.loki_shipper import LokiShipper
from aegis.core.telemetry import TelemetryManager

try:
    from bcc import BPF  # type: ignore
except ImportError:
    BPF = None

try:
    import websockets
except ImportError:
    websockets = None

# Global runtime state
connected_clients: Set[Any] = set()
event_queue: Optional[asyncio.Queue] = None
main_loop: Optional[asyncio.AbstractEventLoop] = None
b_instance = None

DAEMON_MODE = "interactive"  # interactive | headless | audit
AUTO_KILL_THRESHOLD = 90
RULES_ENGINE: Optional[RuleEngine] = None
STRUCTURED_LOGGER: Optional[StructuredLogger] = None
LOKI_SHIPPER: Optional[LokiShipper] = None
INCIDENT_COUNTER = 0

# Track per-PID history for multi-stage temporal chain correlation
pid_event_history: Dict[int, List[Dict[str, Any]]] = {}
pid_last_seen: Dict[int, float] = {}

# Baseline syscall profiles for clean npm/pip packages
CLEAN_BASELINES = {
    "npm": {"file_reads": (10, 50), "network_calls": (1, 5), "exec_spawns": (0, 2)},
    "pip": {"file_reads": (5, 30), "network_calls": (1, 3), "exec_spawns": (0, 1)},
    "node": {"file_reads": (20, 100), "network_calls": (0, 10), "exec_spawns": (0, 5)},
}


def init_db(db_path: str):
    """Initializes SQLite database schema for forensic indexing."""
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            pid INTEGER,
            ppid INTEGER,
            comm TEXT,
            detail TEXT,
            event_type TEXT,
            attack_type TEXT,
            rule_id TEXT,
            mitre_technique TEXT,
            confidence INTEGER,
            risk_score INTEGER
        )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS narrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            pid INTEGER,
            text TEXT,
            attack_type TEXT
        )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            pid INTEGER,
            attack_type TEXT,
            rule_id TEXT,
            risk_score INTEGER,
            status TEXT
        )"""
        )
        conn.commit()


def save_event_to_db(db_path: str, event: Dict[str, Any]):
    try:
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                """INSERT INTO events 
                (timestamp, pid, ppid, comm, detail, event_type, attack_type, rule_id, mitre_technique, confidence, risk_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    event.get("timestamp", datetime.datetime.utcnow().isoformat() + "Z"),
                    event.get("pid"),
                    event.get("ppid"),
                    event.get("comm"),
                    event.get("filename") or str(event.get("dest_port", "")),
                    event.get("event_type"),
                    event.get("attack_type"),
                    event.get("rule_id", ""),
                    event.get("mitre_technique", ""),
                    event.get("confidence", 0),
                    event.get("risk_score", 0),
                ),
            )
            conn.commit()
    except Exception:
        pass


def compute_risk_score(comm: str, ppid: int, event_type: str, dest_port: int, fname: str) -> int:
    score = 0
    fname_lower = (fname or "").lower()
    if any(s in fname_lower for s in [".env", "id_rsa", ".aws", "credentials", "secrets.json", "token.json"]):
        score += 50
    if comm in ["bash", "sh", "zsh", "dash", "nc", "netcat", "curl", "wget"]:
        score += 35
    if dest_port and dest_port not in [80, 443, 8080]:
        score += 25
    if comm in ["node", "python", "python3"] and event_type == "exec_spawn":
        score += 20
    return min(100, max(0, score))


def write_headless_incident_report(
    incidents_dir: str,
    incident_id: str,
    rule_match: Dict[str, Any],
    event: Dict[str, Any],
    chain_events: List[Dict[str, Any]],
    latency_ms: float,
):
    timestamp_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_file = os.path.join(incidents_dir, f"{timestamp_str}-{incident_id}.json")

    report_data = {
        "incident_id": incident_id,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
        "severity": rule_match.get("severity", "CRITICAL"),
        "rule_id": rule_match.get("rule_id", "UNKNOWN"),
        "rule_name": rule_match.get("rule_name", "Supply Chain Threat"),
        "mitre_technique": rule_match.get("mitre_technique", "T1059"),
        "pid": event.get("pid"),
        "ppid": event.get("ppid"),
        "process_name": event.get("comm"),
        "parent_process": event.get("parent_comm", "unknown"),
        "action_taken": "SIGKILL",
        "confidence": rule_match.get("confidence", 95),
        "latency_ms": round(latency_ms, 2),
        "chain": [
            {
                "timestamp": e.get("timestamp"),
                "event_type": e.get("event_type"),
                "detail": e.get("filename") or f"{e.get('dest_ip')}:{e.get('dest_port')}",
                "comm": e.get("comm"),
            }
            for e in chain_events
        ]
        if chain_events
        else [
            {
                "timestamp": event.get("timestamp"),
                "event_type": event.get("event_type"),
                "detail": event.get("filename") or str(event.get("dest_port")),
                "comm": event.get("comm"),
            }
        ],
    }

    try:
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2)
        print(f"[HEADLESS INCIDENT REPORT] Written to {report_file}", flush=True)
    except Exception as e:
        print(f"[ERROR] Failed to write incident report: {e}", flush=True)


def handle_security_event(
    event: Dict[str, Any],
    db_path: str,
    incidents_dir: str,
    queue_ref: Optional[asyncio.Queue],
    loop_ref: Optional[asyncio.AbstractEventLoop],
):
    global INCIDENT_COUNTER, pid_event_history, pid_last_seen

    pid = event.get("pid", 0)
    now_ts = time.time()
    start_eval_time = time.time()

    # Track temporal event history
    if pid not in pid_event_history:
        pid_event_history[pid] = []
    pid_event_history[pid].append(event)
    pid_last_seen[pid] = now_ts

    # Clean up history for stale PIDs (> 60s)
    stale_pids = [p for p, last in pid_last_seen.items() if now_ts - last > 60]
    for sp in stale_pids:
        pid_event_history.pop(sp, None)
        pid_last_seen.pop(sp, None)

    # 1. Evaluate single event against Policy Rule Engine
    rule_matches = RULES_ENGINE.evaluate_event(event) if RULES_ENGINE else []
    
    # 2. Evaluate temporal multi-stage attack chains for this PID
    chain_matches = RULES_ENGINE.evaluate_chain(pid_event_history[pid]) if RULES_ENGINE else []

    top_match = None
    if chain_matches:
        top_match = chain_matches[0]
    elif rule_matches:
        top_match = rule_matches[0]

    # Enrich event with rule match metadata
    if top_match:
        event["rule_id"] = top_match.get("rule_id")
        event["attack_type"] = top_match.get("rule_name")
        event["severity"] = top_match.get("severity", "CRITICAL").lower()
        event["mitre_technique"] = top_match.get("mitre_technique")
        event["confidence"] = top_match.get("confidence", 90)

    # Save to SQLite and SIEM loggers
    save_event_to_db(db_path, event)
    if STRUCTURED_LOGGER:
        STRUCTURED_LOGGER.log_event(event, rule_match=top_match, action_taken=top_match.get("action", "alert") if top_match else "logged")
    if LOKI_SHIPPER:
        LOKI_SHIPPER.ship(event)

    # 3. Mode Action Handling
    if DAEMON_MODE == "headless" and top_match:
        action = top_match.get("action", "alert")
        confidence = top_match.get("confidence", 0)

        if action == "kill" and confidence >= AUTO_KILL_THRESHOLD:
            eval_latency = (time.time() - start_eval_time) * 1000.0
            INCIDENT_COUNTER += 1
            inc_id = f"AGS-{datetime.datetime.utcnow().year}-{INCIDENT_COUNTER:03d}"

            print(
                f"\n[⚡ AEGIS AUTONOMOUS BLOCK] Triggered rule {top_match.get('rule_id')} ({top_match.get('rule_name')})",
                flush=True,
            )
            print(
                f"   [SIGKILL] Terminating malicious process PID {pid} ({event.get('comm')}) | Confidence: {confidence}% (Latency: {eval_latency:.2f}ms)",
                flush=True,
            )

            try:
                os.kill(pid, signal.SIGKILL)
                print(f"   ✅ Successfully terminated PID {pid} via SIGKILL", flush=True)
            except ProcessLookupError:
                print(f"   ⚠️ Process PID {pid} exited before SIGKILL could be delivered", flush=True)
            except Exception as e:
                print(f"   ❌ Failed to deliver SIGKILL to PID {pid}: {e}", flush=True)

            write_headless_incident_report(
                incidents_dir,
                inc_id,
                top_match,
                event,
                pid_event_history.get(pid, []),
                eval_latency,
            )

    elif DAEMON_MODE == "audit":
        if top_match:
            print(
                f"[AUDIT LOG] THREAT DETECTED: Rule {top_match.get('rule_id')} ({top_match.get('rule_name')}) on PID {pid} ({event.get('comm')})",
                flush=True,
            )
        else:
            print(f"[AUDIT LOG] {event.get('event_type')}: PID {pid} ({event.get('comm')})", flush=True)

    else:
        # Interactive mode: forward to WebSocket
        print(f"[DAEMON EVENT] {json.dumps(event)}", flush=True)
        if queue_ref and loop_ref:
            try:
                loop_ref.call_soon_threadsafe(queue_ref.put_nowait, event)
            except Exception:
                pass


def run_mock_event_stream(db_path: str, incidents_dir: str):
    """Fallback mock generator for Windows/macOS/non-root development."""
    print("[NOTICE] Running in Mock Event Mode (Windows/macOS or non-root).", flush=True)
    counter = 0
    while True:
        time.sleep(4.0)
        counter += 1
        mock_event = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
            "pid": 5820 + (counter % 5),
            "ppid": 1200,
            "comm": "node",
            "parent_comm": "npm",
            "event_type": "file_open" if counter % 2 == 0 else "exec_spawn",
            "filename": ".env" if counter % 3 == 0 else "install.js",
            "severity": "critical" if counter % 3 == 0 else "medium",
            "risk_score": 90 if counter % 3 == 0 else 30,
        }
        handle_security_event(mock_event, db_path, incidents_dir, event_queue, main_loop)


async def ws_handler(websocket, path):
    connected_clients.add(websocket)
    print(f"[WEBSOCKET] Client connected. Total: {len(connected_clients)}", flush=True)
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                action = data.get("action")
                pid = data.get("pid")
                if action == "kill" and pid:
                    print(f"[KILL SWITCH] Received kill request for PID {pid}", flush=True)
                    try:
                        os.kill(int(pid), signal.SIGKILL)
                        status_msg = {"type": "kill_ack", "pid": pid, "status": "success"}
                    except ProcessLookupError:
                        status_msg = {"type": "kill_ack", "pid": pid, "status": "not_found"}
                    except Exception as e:
                        status_msg = {"type": "kill_ack", "pid": pid, "status": "error", "message": str(e)}
                    await websocket.send(json.dumps(status_msg))
            except Exception:
                pass
    finally:
        connected_clients.discard(websocket)


async def broadcast_events():
    while True:
        if event_queue:
            event = await event_queue.get()
            if connected_clients:
                msg = json.dumps(event)
                await asyncio.gather(
                    *[ws.send(msg) for ws in connected_clients], return_exceptions=True
                )


def run_daemon(
    mode: str = "interactive",
    threshold: int = 90,
    ws_host: str = "0.0.0.0",
    ws_port: int = 8765,
    custom_rules_file: Optional[str] = None,
    custom_rules: Optional[List[Dict[str, Any]]] = None,
    data_dir: Optional[str] = None,
    loki_url: Optional[str] = None,
):
    global DAEMON_MODE, AUTO_KILL_THRESHOLD, RULES_ENGINE, STRUCTURED_LOGGER, LOKI_SHIPPER
    global event_queue, main_loop

    DAEMON_MODE = mode
    AUTO_KILL_THRESHOLD = threshold

    # Setup directories
    resolved_data_dir = data_dir or get_global_data_dir()
    audit_dir = get_audit_dir(resolved_data_dir)
    incidents_dir = get_incidents_dir(resolved_data_dir)
    db_path = get_db_path(resolved_data_dir)
    pid_file = get_pid_file_path()

    init_db(db_path)

    # Write PID file
    try:
        with open(pid_file, "w") as f:
            f.write(str(os.getpid()))
    except Exception:
        pass

    # Initialize engines
    RULES_ENGINE = RuleEngine(rules_path=custom_rules_file, custom_rules=custom_rules)
    STRUCTURED_LOGGER = StructuredLogger(audit_dir=audit_dir)
    STRUCTURED_LOGGER.log_lifecycle("daemon_start", mode=DAEMON_MODE, threshold=AUTO_KILL_THRESHOLD)

    if loki_url:
        LOKI_SHIPPER = LokiShipper(loki_url=loki_url)

    # Print Mode Banner
    if DAEMON_MODE == "headless":
        print(
            f"""
╔══════════════════════════════════════════════════════════════╗
║                AEGIS DAEMON v1.0 — HEADLESS                  ║
║  Mode: AUTONOMOUS THREAT RESPONSE (Instant SIGKILL Active)   ║
║  Auto-kill threshold: {AUTO_KILL_THRESHOLD}%                                     ║
║  Incident Reports   : {incidents_dir}                        ║
║  Audit Log          : {audit_dir}                            ║
╚══════════════════════════════════════════════════════════════╝
""",
            flush=True,
        )
    elif DAEMON_MODE == "audit":
        print(
            f"""
╔══════════════════════════════════════════════════════════════╗
║                 AEGIS DAEMON v1.0 — AUDIT                    ║
║  Mode: PASSIVE COMPLIANCE LOGGING (No SIGKILL Executed)      ║
║  Audit Log: {audit_dir}                                      ║
╚══════════════════════════════════════════════════════════════╝
""",
            flush=True,
        )
    else:
        print(
            f"""
╔══════════════════════════════════════════════════════════════╗
║              AEGIS DAEMON v1.0 — INTERACTIVE                 ║
║  Mode: REAL-TIME WEBSOCKET BRIDGE (ws://{ws_host}:{ws_port})      ║
║  Kill Switch: ENABLED (Human-in-the-Loop)                    ║
╚══════════════════════════════════════════════════════════════╝
""",
            flush=True,
        )

    # Clean shutdown handler
    def cleanup(*args):
        if STRUCTURED_LOGGER:
            STRUCTURED_LOGGER.log_lifecycle("daemon_shutdown")
        try:
            if os.path.exists(pid_file):
                os.remove(pid_file)
        except Exception:
            pass
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    # Initialize Telemetry Backend via TelemetryManager
    def on_telemetry_event(event: Dict[str, Any]):
        handle_security_event(event, db_path, incidents_dir, event_queue, main_loop)

    telemetry_manager = TelemetryManager(callback=on_telemetry_event)
    telemetry_manager.start()

    if DAEMON_MODE == "interactive" and websockets is not None:
        async def main_async():
            global event_queue, main_loop
            main_loop = asyncio.get_running_loop()
            event_queue = asyncio.Queue()
            async with websockets.serve(ws_handler, ws_host, ws_port):
                print(f"[WEBSOCKET] Serving telemetry bridge on ws://{ws_host}:{ws_port}", flush=True)
                await broadcast_events()

        try:
            asyncio.run(main_async())
        except KeyboardInterrupt:
            cleanup()
    else:
        # Headless or Audit mode: keep main thread alive
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            cleanup()


def main():
    parser = argparse.ArgumentParser(description="Aelfra Aegis eBPF Security Daemon")
    parser.add_argument("--mode", choices=["interactive", "headless", "audit"], default="interactive")
    parser.add_argument("--threshold", type=int, default=90)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--rules", type=str, default=None)
    parser.add_argument("--data-dir", type=str, default=None)
    args = parser.parse_args()

    run_daemon(
        mode=args.mode,
        threshold=args.threshold,
        ws_port=args.port,
        custom_rules_file=args.rules,
        data_dir=args.data_dir,
    )


if __name__ == "__main__":
    main()
