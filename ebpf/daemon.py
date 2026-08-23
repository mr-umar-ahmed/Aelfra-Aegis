#!/usr/bin/env python3
"""
Aelfra Aegis eBPF Security Daemon
Integrates BCC ring buffer / kprobes with a JSON policy rule engine,
real-time WebSocket bridge (interactive mode), autonomous headless SIGKILL blocking,
and passive audit compliance logging.
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
from typing import Any, Dict, List, Optional

# Add daemon directory for rule_engine import
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "daemon"))
from rule_engine import RuleEngine

try:
    from bcc import BPF  # type: ignore
except ImportError:
    BPF = None

try:
    import websockets
except ImportError:
    websockets = None

C_PROBE_PATH = os.path.join(os.path.dirname(__file__), "probes.c")
DEFAULT_RULES_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "rules.json")
WS_HOST = "0.0.0.0"
WS_PORT = 8765

connected_clients = set()
event_queue: Optional[asyncio.Queue] = None
main_loop: Optional[asyncio.AbstractEventLoop] = None
b = None

# Global runtime configuration
DAEMON_MODE = "interactive"  # interactive | headless | audit
AUTO_KILL_THRESHOLD = 90
RULES_ENGINE: Optional[RuleEngine] = None
INCIDENT_COUNTER = 0

# Load .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip() and not line.startswith("#"):
                key, val = line.strip().split("=", 1)
                os.environ[key] = val.strip(' "\'')

# --- Data Directory Setup ---
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
INCIDENTS_DIR = os.path.join(DATA_DIR, "incidents")
AUDIT_DIR = os.path.join(DATA_DIR, "audit")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(INCIDENTS_DIR, exist_ok=True)
os.makedirs(AUDIT_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "aegis.db")


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
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


init_db()


def db_insert_event(event: dict):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """INSERT INTO events (timestamp, pid, ppid, comm, detail, event_type, attack_type, rule_id, mitre_technique, confidence, risk_score)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                event.get("timestamp", ""),
                event.get("pid"),
                event.get("ppid"),
                event.get("comm", ""),
                event.get("filename", ""),
                event.get("event_type", ""),
                event.get("attack_type", "UNKNOWN"),
                event.get("rule_id", ""),
                event.get("mitre_technique", ""),
                event.get("confidence", 0),
                0,
            ),
        )


def db_insert_narration(payload: dict):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """INSERT INTO narrations (timestamp, pid, text, attack_type)
               VALUES (?, ?, ?, ?)""",
            (payload["timestamp"], payload["pid"], payload["text"], payload["attack_type"]),
        )


def db_insert_incident(pid: int, attack_type: str, events: list, rule_id: str = ""):
    start_time = (
        events[0]["timestamp"] if events else datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
    end_time = (
        events[-1]["timestamp"] if events else datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
    risk_score = compute_risk_score().get("score", 0)
    status = "active"
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """INSERT INTO incidents (start_time, end_time, pid, attack_type, rule_id, risk_score, status)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (start_time, end_time, pid, attack_type, rule_id, risk_score, status),
        )


def get_recent_incidents(limit=50):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT * FROM incidents ORDER BY id DESC LIMIT ?", (limit,))
        incidents = [dict(row) for row in cur.fetchall()]

        for inc in incidents:
            cur = conn.execute(
                "SELECT text FROM narrations WHERE pid = ? ORDER BY id DESC LIMIT 1", (inc["pid"],)
            )
            narration_row = cur.fetchone()
            inc["narration_text"] = narration_row["text"] if narration_row else None

            cur = conn.execute("SELECT * FROM events WHERE pid = ? ORDER BY id ASC", (inc["pid"],))
            inc["events"] = [dict(r) for r in cur.fetchall()]

        return incidents


# --- Autonomous Headless Incident Recording ---
def record_headless_incident(pid: int, matched_rule: dict, triggering_events: list, latency_ms: float):
    global INCIDENT_COUNTER
    INCIDENT_COUNTER += 1
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    ts_str = now_dt.strftime("%Y%m%dT%H%M%SZ")
    incident_id = f"AGS-{now_dt.year}-{INCIDENT_COUNTER:03d}"

    proc_name = "unknown"
    if triggering_events:
        proc_name = triggering_events[-1].get("comm", "unknown")

    incident_payload = {
        "incident_id": incident_id,
        "timestamp": now_dt.isoformat(),
        "severity": matched_rule.get("severity", "CRITICAL"),
        "rule_id": matched_rule.get("rule_id", "UNKNOWN"),
        "rule_name": matched_rule.get("rule_name", "Autonomous Threat Block"),
        "mitre_technique": matched_rule.get("mitre_technique", "T1020"),
        "pid": pid,
        "process_name": proc_name,
        "action_taken": "SIGKILL",
        "action_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "latency_ms": round(latency_ms, 2),
        "events": triggering_events,
        "confidence": matched_rule.get("confidence", 95),
    }

    report_filename = f"{ts_str}_{incident_id}.json"
    report_filepath = os.path.join(INCIDENTS_DIR, report_filename)
    try:
        with open(report_filepath, "w", encoding="utf-8") as f:
            json.dump(incident_payload, f, indent=2)
        print(f"[HEADLESS BLOCK] Incident report generated: {report_filepath}", flush=True)
    except Exception as e:
        print(f"[HEADLESS ERROR] Failed to write incident report: {e}", file=sys.stderr, flush=True)


def record_audit_event(event: dict, matched_rules: list):
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    date_str = now_dt.strftime("%Y-%m-%d")
    audit_file = os.path.join(AUDIT_DIR, f"{date_str}.jsonl")

    for rule in matched_rules:
        audit_entry = {
            "timestamp": event.get("timestamp", now_dt.isoformat()),
            "severity": rule.get("severity", "INFO"),
            "rule_id": rule.get("rule_id", "GENERAL"),
            "rule_name": rule.get("rule_name", ""),
            "mitre_technique": rule.get("mitre_technique", "T1059"),
            "pid": event.get("pid"),
            "comm": event.get("comm"),
            "filename": event.get("filename"),
            "confidence": rule.get("confidence", 80),
        }
        # Print structured stdout format
        print(
            f"[AUDIT] {audit_entry['timestamp']} | {audit_entry['severity']} | {audit_entry['rule_id']} | PID:{audit_entry['pid']} {audit_entry['comm']} | {audit_entry['mitre_technique']}",
            flush=True,
        )
        try:
            with open(audit_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(audit_entry) + "\n")
        except Exception as e:
            print(f"[AUDIT LOG ERROR] {e}", file=sys.stderr, flush=True)


# --- Autonomous Execution & Kill Dispatch ---
def execute_autonomous_kill(pid: int, rule: dict, events: list):
    t_start = time.perf_counter()
    print(f"\n🚨 [AUTONOMOUS KILL TRIGGERED] High-confidence threat rule {rule.get('rule_id')} matched for PID {pid}!", flush=True)

    killed = False
    try:
        if os.name != "nt":
            os.kill(pid, signal.SIGKILL)
            killed = True
            print(f"💀 [SIGKILL ISSUED] Process PID {pid} terminated by Aegis kernel sentinel.", flush=True)
        else:
            print(f"⚠️ [MOCK KILL] Simulated SIGKILL on PID {pid} (Windows OS).", flush=True)
            killed = True
    except ProcessLookupError:
        print(f"[KILL] Process PID {pid} had already exited.", flush=True)
        killed = True
    except Exception as e:
        print(f"[KILL ERROR] Failed to kill PID {pid}: {e}", file=sys.stderr, flush=True)

    latency_ms = (time.perf_counter() - t_start) * 1000.0

    # Write incident report
    record_headless_incident(pid, rule, events, latency_ms)

    # Update SQLite database
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("UPDATE incidents SET status = 'terminated' WHERE pid = ?", (pid,))


class IPCache:
    def __init__(self, max_size=200):
        self.cache = {}
        self.order = deque()
        self.max_size = max_size

    def get(self, ip: str):
        return self.cache.get(ip)

    def put(self, ip: str, result: dict):
        if ip in self.cache:
            return
        if len(self.cache) >= self.max_size:
            oldest = self.order.popleft()
            del self.cache[oldest]
        self.cache[ip] = result
        self.order.append(ip)

    def should_check(self, ip: str) -> bool:
        if ip.startswith(("127.", "10.", "192.168.", "::1", "0.0.0.0")):
            return False
        return ip not in self.cache


ip_cache = IPCache()

# --- Module C: Baseline & Risk Score ---
baseline_data = {}
baseline_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "baselines", "baseline.json")
if os.path.exists(baseline_path):
    try:
        with open(baseline_path, "r") as f:
            baseline_data = json.load(f)
    except Exception as e:
        print(f"[ERROR] Failed to load baseline.json: {e}")

baseline_medians = {"avg_file_opens": 5, "avg_processes_spawned": 0, "avg_network_connections": 0}
if baseline_data:
    file_opens = sorted([d.get("avg_file_opens", 0) for d in baseline_data.values()])
    procs = sorted([d.get("avg_processes_spawned", 0) for d in baseline_data.values()])
    nets = sorted([d.get("avg_network_connections", 0) for d in baseline_data.values()])

    if file_opens:
        baseline_medians["avg_file_opens"] = file_opens[len(file_opens) // 2]
    if procs:
        baseline_medians["avg_processes_spawned"] = procs[len(procs) // 2]
    if nets:
        baseline_medians["avg_network_connections"] = nets[len(nets) // 2]

all_events_history = []


def compute_risk_score() -> dict:
    f_opens = sum(1 for e in all_events_history if e["event_type"] in ("file_open", "file"))
    p_spawn = sum(1 for e in all_events_history if e["event_type"] in ("exec_spawn", "exec"))
    n_conn = sum(1 for e in all_events_history if e["event_type"] in ("network", "connect"))

    score = 0
    anomalies = []

    m_file = baseline_medians["avg_file_opens"]
    if f_opens > 2 * m_file:
        score += 30
        anomalies.append(f"file_opens ({f_opens}) > 2x baseline median ({m_file})")

    m_proc = baseline_medians["avg_processes_spawned"]
    if p_spawn > m_proc:
        score += 40
        anomalies.append(f"processes_spawned ({p_spawn}) > baseline median ({m_proc})")

    m_net = baseline_medians["avg_network_connections"]
    if n_conn > m_net:
        score += 30
        anomalies.append(f"network_connections ({n_conn}) > baseline median ({m_net})")

    if score > 100:
        score = 100

    return {
        "score": score,
        "file_opens": f_opens,
        "processes_spawned": p_spawn,
        "network_connections": n_conn,
        "anomalies": anomalies,
    }


async def emit_risk_score_loop():
    while True:
        await asyncio.sleep(3)
        if not all_events_history:
            continue
        risk_data = compute_risk_score()
        payload = {"type": "risk_score", "data": risk_data}
        if connected_clients:
            message = json.dumps(payload)
            await asyncio.gather(
                *[client.send(message) for client in connected_clients], return_exceptions=True
            )


# --- Narration & Event State ---
pid_events: dict = {}  # pid -> list of events
pid_first_seen: dict = {}  # pid -> timestamp of first event
narrated_pids: set = set()  # pids already narrated
killed_pids: set = set()  # pids killed by autonomous engine


def accumulate_event(event_payload: dict):
    all_events_history.append(event_payload)
    pid = event_payload["pid"]
    now = time.time()
    if pid not in pid_events:
        pid_events[pid] = []
        pid_first_seen[pid] = now
    pid_events[pid].append(event_payload)


async def narrate_attack(events: list[dict]) -> str:
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return "Narration unavailable — GROQ_API_KEY not set in .env"

    payload = {
        "model": "openai/gpt-oss-20b",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a threat intelligence analyst. "
                    "You receive raw eBPF syscall events from a Linux system. "
                    "Write exactly 3 sentences in plain English: "
                    "what happened, what the attacker was trying to do, "
                    "and what known attack family this resembles. "
                    "Be specific and technical. No bullet points. No markdown."
                ),
            },
            {"role": "user", "content": json.dumps(events)},
        ],
        "max_tokens": 300,
        "temperature": 0.3,
    }

    try:
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=json.dumps(payload).encode(),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return f"Narration unavailable — {e}"


async def check_chains():
    """Evaluates multi-stage temporal attack chains using RuleEngine."""
    while True:
        now = time.time()
        for pid, first_ts in list(pid_first_seen.items()):
            events = pid_events.get(pid, [])
            if not events:
                continue

            # Evaluate chain using RuleEngine
            if RULES_ENGINE:
                matched_chains = RULES_ENGINE.evaluate_chain(events)
                for chain_rule in matched_chains:
                    rule_id = chain_rule.get("rule_id", "CHAIN_001")
                    attack_type = chain_rule.get("rule_name", "Full Attack Chain")

                    # Headless auto-kill check
                    if (
                        DAEMON_MODE == "headless"
                        and chain_rule.get("action") == "kill"
                        and chain_rule.get("confidence", 0) >= AUTO_KILL_THRESHOLD
                        and pid not in killed_pids
                    ):
                        killed_pids.add(pid)
                        execute_autonomous_kill(pid, chain_rule, events)

                    # Audit mode record
                    if DAEMON_MODE == "audit":
                        record_audit_event(events[-1], [chain_rule])

                    # Trigger narration in interactive mode after 30s
                    if (now - first_ts >= 30 or DAEMON_MODE != "interactive") and pid not in narrated_pids:
                        narrated_pids.add(pid)
                        narration_text = await narrate_attack(events)
                        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
                        payload = {
                            "type": "narration",
                            "pid": pid,
                            "text": narration_text,
                            "timestamp": timestamp,
                            "attack_type": attack_type,
                            "rule_id": rule_id,
                        }
                        if connected_clients:
                            message = json.dumps(payload)
                            await asyncio.gather(
                                *[client.send(message) for client in connected_clients],
                                return_exceptions=True,
                            )
                        db_insert_narration(payload)
                        db_insert_incident(pid, attack_type, events, rule_id)

        await asyncio.sleep(2)


# --- BPF Event Processor ---
def process_event_data(event_dict: dict):
    """Passes kernel event to RuleEngine, enriches payload, and dispatches actions."""
    matched_rules = RULES_ENGINE.evaluate_event(event_dict) if RULES_ENGINE else []

    attack_type = "UNKNOWN"
    severity = "low"
    rule_id = ""
    mitre_tech = ""
    confidence = 0

    if matched_rules:
        primary_match = matched_rules[0]
        rule_id = primary_match.get("rule_id", "")
        attack_type = primary_match.get("rule_name", "UNKNOWN")
        severity = primary_match.get("severity", "low").lower()
        mitre_tech = primary_match.get("mitre_technique", "")
        confidence = primary_match.get("confidence", 80)

        # Audit Mode logging
        if DAEMON_MODE == "audit":
            record_audit_event(event_dict, matched_rules)

        # Headless Auto-Kill condition
        if (
            DAEMON_MODE == "headless"
            and primary_match.get("action") == "kill"
            and confidence >= AUTO_KILL_THRESHOLD
            and event_dict.get("pid") not in killed_pids
        ):
            killed_pids.add(event_dict.get("pid"))
            execute_autonomous_kill(event_dict.get("pid"), primary_match, [event_dict])
    else:
        # Fallback heuristic severity
        if event_dict["event_type"] == "file_open" and ".env" in event_dict.get("filename", ""):
            severity = "critical"
            attack_type = "CREDENTIAL_THEFT"
        elif event_dict["event_type"] == "network":
            severity = "high"

    event_dict["severity"] = severity
    event_dict["attack_type"] = attack_type
    event_dict["rule_id"] = rule_id
    event_dict["mitre_technique"] = mitre_tech
    event_dict["confidence"] = confidence

    accumulate_event(event_dict)
    db_insert_event(event_dict)

    payload = {"type": "event", "data": event_dict}
    print(f"[DAEMON EVENT] {json.dumps(event_dict)}", flush=True)

    if main_loop and event_queue and DAEMON_MODE == "interactive":
        main_loop.call_soon_threadsafe(event_queue.put_nowait, payload)


def ring_buffer_callback(ctx, data, size):
    if b is None:
        return
    event = b["events"].event(data)

    comm = event.comm.decode("utf-8", errors="replace").strip("\x00")
    event_type = event.event_type.decode("utf-8", errors="replace").strip("\x00")
    filename = event.filename.decode("utf-8", errors="replace").strip("\x00")

    dest_ip = ""
    dest_port = 0
    if event_type in ("network", "tcp_connect"):
        try:
            dest_ip = socket.inet_ntoa(struct.pack("!I", event.dest_ip))
            dest_port = socket.ntohs(event.dest_port)
        except Exception:
            pass

    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    event_dict = {
        "timestamp": timestamp,
        "pid": event.pid,
        "ppid": event.ppid,
        "uid": event.uid,
        "comm": comm,
        "event_type": event_type,
        "filename": filename,
    }
    if event_type in ("network", "tcp_connect"):
        event_dict["dest_ip"] = dest_ip
        event_dict["dest_port"] = dest_port

    process_event_data(event_dict)


def bcc_polling_thread():
    if b is None:
        return
    print("[DAEMON THREAD] Starting BPF ring buffer polling...", flush=True)
    b["events"].open_ring_buffer(ring_buffer_callback)
    while True:
        try:
            b.ring_buffer_poll(timeout=100)
            time.sleep(0.01)
        except Exception as e:
            print(f"[DAEMON THREAD ERROR] {e}", file=sys.stderr, flush=True)
            break


async def mock_event_generator():
    """Generates realistic attack sequence events for non-Linux testing."""
    await asyncio.sleep(1.5)
    sample_sequence = [
        {
            "pid": 3010,
            "ppid": 1000,
            "uid": 1000,
            "comm": "npm",
            "event_type": "exec_spawn",
            "filename": "npm install aegis-utils",
        },
        {
            "pid": 5820,
            "ppid": 3010,
            "uid": 1000,
            "comm": "node",
            "event_type": "file_open",
            "filename": "simulator/target-app/.env",
        },
        {
            "pid": 5820,
            "ppid": 3010,
            "uid": 1000,
            "comm": "node",
            "event_type": "network",
            "filename": "127.0.0.1:9999",
            "dest_ip": "127.0.0.1",
            "dest_port": 9999,
        },
        {
            "pid": 8940,
            "ppid": 5820,
            "uid": 1000,
            "comm": "bash",
            "event_type": "exec_spawn",
            "filename": "bash -c id",
        },
    ]

    for item in sample_sequence:
        await asyncio.sleep(1.5)
        item["timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        process_event_data(item)


async def check_abuseipdb(ip):
    if not ip_cache.should_check(ip):
        cached = ip_cache.get(ip)
        return cached.get("is_threat", False) if cached else False

    api_key = os.environ.get("ABUSEIPDB_KEY")
    if not api_key:
        return False

    url = f"https://api.abuseipdb.com/api/v2/check?ipAddress={ip}"
    headers = {"Accept": "application/json", "Key": api_key}

    def fetch():
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=2) as resp:
                data = json.loads(resp.read().decode())
                score = data.get("data", {}).get("abuseConfidenceScore", 0)
                is_threat = score > 25
                ip_cache.put(ip, {"is_threat": is_threat})
                return is_threat
        except Exception as e:
            return False

    return await asyncio.to_thread(fetch)


async def broadcast_worker():
    while True:
        if event_queue is None:
            await asyncio.sleep(0.1)
            continue
        payload = await event_queue.get()

        if payload["data"]["event_type"] in ("network", "tcp_connect"):
            ip = payload["data"].get("dest_ip")
            if ip:
                is_threat = await check_abuseipdb(ip)
                if is_threat:
                    payload["data"]["threat"] = True
                    payload["data"]["severity"] = "critical"

        if connected_clients:
            message = json.dumps(payload)
            await asyncio.gather(
                *[client.send(message) for client in connected_clients], return_exceptions=True
            )
        event_queue.task_done()


async def ws_handler(websocket, path=None):
    connected_clients.add(websocket)
    print(f"[WEBSOCKET] Client connected from {websocket.remote_address}", flush=True)
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                if data.get("action") == "kill":
                    pid = int(data.get("pid"))
                    print(f"[KILL SWITCH] Received manual request to kill PID {pid}", flush=True)
                    try:
                        if os.name != "nt":
                            os.kill(pid, signal.SIGKILL)
                        res = {
                            "type": "kill_result",
                            "pid": pid,
                            "success": True,
                            "message": f"PID {pid} killed successfully",
                        }
                        with sqlite3.connect(DB_PATH) as conn:
                            conn.execute("UPDATE incidents SET status = 'terminated' WHERE pid = ?", (pid,))
                    except Exception as err:
                        res = {"type": "kill_result", "pid": pid, "success": False, "message": str(err)}
                    await websocket.send(json.dumps(res))
                elif data.get("action") == "get_history":
                    limit = int(data.get("limit", 50))
                    incidents = get_recent_incidents(limit)
                    await websocket.send(json.dumps({"type": "history", "incidents": incidents}))
            except Exception as parse_err:
                print(f"[WEBSOCKET PARSE ERROR] {parse_err}", file=sys.stderr, flush=True)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.remove(websocket)
        print(f"[WEBSOCKET] Client disconnected.", flush=True)


def print_startup_banner():
    if DAEMON_MODE == "headless":
        print(
            f"""
╔══════════════════════════════════════╗
║   AEGIS DAEMON v1.0 — HEADLESS       ║
║   Mode: AUTONOMOUS THREAT RESPONSE   ║
║   Auto-kill threshold: {AUTO_KILL_THRESHOLD}%           ║
║   WebSocket: DISABLED                ║
╚══════════════════════════════════════╝
""",
            flush=True,
        )
    elif DAEMON_MODE == "audit":
        print(
            """
╔══════════════════════════════════════╗
║   AEGIS DAEMON v1.0 — AUDIT ONLY     ║
║   Mode: PASSIVE LOGGING (NO KILL)    ║
║   WebSocket: DISABLED                ║
╚══════════════════════════════════════╝
""",
            flush=True,
        )
    else:
        print(
            f"""
╔══════════════════════════════════════╗
║   AEGIS DAEMON v1.0 — INTERACTIVE    ║
║   Mode: WEBSOCKET LIVE BRIDGE        ║
║   WebSocket: ws://{WS_HOST}:{WS_PORT}       ║
╚══════════════════════════════════════╝
""",
            flush=True,
        )


async def main_async(rules_file: str):
    global main_loop, event_queue, b, RULES_ENGINE
    main_loop = asyncio.get_running_loop()
    event_queue = asyncio.Queue()

    print_startup_banner()

    # Initialize Policy Rule Engine
    RULES_ENGINE = RuleEngine(rules_file)

    if BPF is None or os.name == "nt":
        print("[NOTICE] BCC kernel driver not present (running mock generator).", flush=True)
        asyncio.create_task(mock_event_generator())
    else:
        if os.path.exists(C_PROBE_PATH):
            with open(C_PROBE_PATH, "r") as f:
                bpf_code = f.read()
            print("[DAEMON] Compiling eBPF probes...", flush=True)
            b = BPF(text=bpf_code)
            b.attach_kprobe(event="tcp_connect", fn_name="trace_tcp_connect")
            print("[DAEMON] eBPF probes loaded successfully.", flush=True)

            t = threading.Thread(target=bcc_polling_thread, daemon=True)
            t.start()
        else:
            print(f"[ERROR] C probe file missing at {C_PROBE_PATH}", file=sys.stderr)

    asyncio.create_task(check_chains())

    if DAEMON_MODE == "interactive":
        asyncio.create_task(broadcast_worker())
        asyncio.create_task(emit_risk_score_loop())

        if websockets is not None:
            async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
                print(f"[DAEMON] WebSocket server active on ws://{WS_HOST}:{WS_PORT}", flush=True)
                await asyncio.Future()
        else:
            print("[ERROR] websockets module missing for interactive mode.", file=sys.stderr)
            await asyncio.Future()
    else:
        # Headless / Audit mode runs without websocket server
        await asyncio.Future()


def main():
    global DAEMON_MODE, AUTO_KILL_THRESHOLD
    parser = argparse.ArgumentParser(
        description="Aelfra Aegis eBPF Security Daemon",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--mode",
        choices=["interactive", "headless", "audit"],
        default=os.environ.get("AEGIS_MODE", "interactive"),
        help="Operating mode: interactive (default), headless (autonomous SIGKILL), or audit (passive log)",
    )
    parser.add_argument(
        "--rules",
        default=os.environ.get("AEGIS_RULES_PATH", DEFAULT_RULES_PATH),
        help="Path to JSON detection policy rules file",
    )
    parser.add_argument(
        "--threshold",
        type=int,
        default=int(os.environ.get("AEGIS_AUTO_KILL_THRESHOLD", 90)),
        help="Confidence threshold for headless auto-kill (default: 90)",
    )
    args = parser.parse_args()

    DAEMON_MODE = args.mode
    AUTO_KILL_THRESHOLD = args.threshold

    try:
        asyncio.run(main_async(args.rules))
    except KeyboardInterrupt:
        print("\n[DAEMON] Shutting down Aegis security daemon cleanly.", flush=True)
        sys.exit(0)


if __name__ == "__main__":
    main()
