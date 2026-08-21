#!/usr/bin/env python3
"""
Aelfra Aegis eBPF Daemon (Phase 2 & 3)
Integrates BCC ring buffer polling with an asyncio WebSocket server (ws://0.0.0.0:8765).
Emits real-time kernel events to connected clients and handles process kill commands.
Includes automatic Mock Mode when running on non-Linux OS (Windows/macOS) for testing UI.
"""

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
import urllib.request
import urllib.parse
from collections import deque

try:
    from bcc import BPF  # type: ignore
except ImportError:
    BPF = None

try:
    import websockets
except ImportError:
    print("[ERROR] `websockets` library not found. Installing requirement via pip may be needed (`pip install websockets`).", file=sys.stderr)
    websockets = None

C_PROBE_PATH = os.path.join(os.path.dirname(__file__), "probes.c")
WS_HOST = "0.0.0.0"
WS_PORT = 8765

connected_clients = set()
event_queue = None
main_loop = None
b = None

# Load .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip() and not line.startswith("#"):
                key, val = line.strip().split("=", 1)
                os.environ[key] = val.strip(' "\'')

# --- Module G: SQLite Setup ---
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "aegis.db")

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            pid INTEGER,
            ppid INTEGER,
            comm TEXT,
            detail TEXT,
            event_type TEXT,
            attack_type TEXT,
            risk_score INTEGER
        )''')
        conn.execute('''CREATE TABLE IF NOT EXISTS narrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            pid INTEGER,
            text TEXT,
            attack_type TEXT
        )''')
        conn.execute('''CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            pid INTEGER,
            attack_type TEXT,
            risk_score INTEGER,
            status TEXT
        )''')
        conn.commit()

init_db()

def db_insert_event(event: dict):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            '''INSERT INTO events (timestamp, pid, ppid, comm, detail, event_type, attack_type, risk_score)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (
                event.get("timestamp", ""),
                event.get("pid"),
                event.get("ppid"),
                event.get("comm", ""),
                event.get("filename", ""),
                event.get("event_type", ""),
                event.get("attack_type", "UNKNOWN"),
                0
            )
        )

def db_insert_narration(payload: dict):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            '''INSERT INTO narrations (timestamp, pid, text, attack_type)
               VALUES (?, ?, ?, ?)''',
            (payload["timestamp"], payload["pid"], payload["text"], payload["attack_type"])
        )

def db_insert_incident(pid: int, attack_type: str, events: list):
    start_time = events[0]["timestamp"] if events else datetime.datetime.now(datetime.timezone.utc).isoformat()
    end_time = events[-1]["timestamp"] if events else datetime.datetime.now(datetime.timezone.utc).isoformat()
    risk_score = compute_risk_score().get("score", 0)
    status = "active"
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            '''INSERT INTO incidents (start_time, end_time, pid, attack_type, risk_score, status)
               VALUES (?, ?, ?, ?, ?, ?)''',
            (start_time, end_time, pid, attack_type, risk_score, status)
        )

def get_recent_incidents(limit=50):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT * FROM incidents ORDER BY id DESC LIMIT ?", (limit,))
        incidents = [dict(row) for row in cur.fetchall()]
        
        for inc in incidents:
            cur = conn.execute("SELECT text FROM narrations WHERE pid = ? ORDER BY id DESC LIMIT 1", (inc["pid"],))
            narration_row = cur.fetchone()
            inc["narration_text"] = narration_row["text"] if narration_row else None
            
            cur = conn.execute("SELECT * FROM events WHERE pid = ? ORDER BY id ASC", (inc["pid"],))
            inc["events"] = [dict(r) for r in cur.fetchall()]
            
        return incidents

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

baseline_medians = {
    "avg_file_opens": 5,
    "avg_processes_spawned": 0,
    "avg_network_connections": 0
}
if baseline_data:
    file_opens = sorted([d.get("avg_file_opens", 0) for d in baseline_data.values()])
    procs = sorted([d.get("avg_processes_spawned", 0) for d in baseline_data.values()])
    nets = sorted([d.get("avg_network_connections", 0) for d in baseline_data.values()])
    
    if file_opens: baseline_medians["avg_file_opens"] = file_opens[len(file_opens)//2]
    if procs: baseline_medians["avg_processes_spawned"] = procs[len(procs)//2]
    if nets: baseline_medians["avg_network_connections"] = nets[len(nets)//2]

all_events_history = []

def compute_risk_score() -> dict:
    f_opens = sum(1 for e in all_events_history if e["event_type"] == "file_open")
    p_spawn = sum(1 for e in all_events_history if e["event_type"] == "exec_spawn")
    n_conn = sum(1 for e in all_events_history if e["event_type"] == "network")
    
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
        
    if score > 100: score = 100
    
    return {
        "score": score,
        "file_opens": f_opens,
        "processes_spawned": p_spawn,
        "network_connections": n_conn,
        "anomalies": anomalies
    }

async def emit_risk_score_loop():
    while True:
        await asyncio.sleep(3)
        if not all_events_history:
            continue
        risk_data = compute_risk_score()
        payload = {
            "type": "risk_score",
            "data": risk_data
        }
        if connected_clients:
            message = json.dumps(payload)
            await asyncio.gather(
                *[client.send(message) for client in connected_clients],
                return_exceptions=True
            )

# --- Module E: Narration State ---
pid_events: dict = {}       # pid -> list of events
pid_first_seen: dict = {}   # pid -> timestamp of first event
narrated_pids: set = set()  # pids already narrated

def accumulate_event(event_payload: dict):
    all_events_history.append(event_payload)
    pid = event_payload["pid"]
    now = time.time()
    if pid not in pid_events:
        pid_events[pid] = []
        pid_first_seen[pid] = now
    pid_events[pid].append(event_payload)

async def narrate_attack(events: list[dict]) -> str:
    """
    Calls Groq API (free) for threat narration.
    Model: llama-3.1-70b-versatile
    Endpoint: https://api.groq.com/openai/v1/chat/completions
    """
    import os, json
    import urllib.request
    
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
                )
            },
            {
                "role": "user",
                "content": json.dumps(events)
            }
        ],
        "max_tokens": 300,
        "temperature": 0.3
    }
    
    try:
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=json.dumps(payload).encode(),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return data["choices"][0]["message"]["content"].strip()
    except urllib.error.HTTPError as e:
        # Fallback logging to stdout if logging module not imported or configured, or use print
        print(f"[Narration Error] Groq API error: {e.code} {e.reason}", flush=True)
        return "Narration unavailable — Groq API call failed."
    except Exception as e:
        print(f"[Narration Error] Connection error: {e}", flush=True)
        return "Narration unavailable — connection error."

async def check_chains():
    """Runs periodically in the background to detect complete attack chains."""
    while True:
        now = time.time()
        for pid, first_ts in list(pid_first_seen.items()):
            if now - first_ts >= 30 and pid not in narrated_pids:
                events = pid_events[pid]
                has_file = any(e["event_type"] == "file_open" for e in events)
                has_exec = any(e["event_type"] == "exec_spawn" for e in events)
                
                if has_file and has_exec:
                    print(f"[DAEMON] Triggering narration for PID {pid}", flush=True)
                    narration_text = await narrate_attack(events)
                    narrated_pids.add(pid)
                    
                    attack_type = "UNKNOWN"
                    for e in events:
                        if e.get("attack_type") and e.get("attack_type") != "UNKNOWN":
                            attack_type = e["attack_type"]
                            break

                    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    payload = {
                        "type": "narration",
                        "pid": pid,
                        "text": narration_text,
                        "timestamp": timestamp,
                        "attack_type": attack_type
                    }
                    
                    if connected_clients:
                        message = json.dumps(payload)
                        await asyncio.gather(
                            *[client.send(message) for client in connected_clients],
                            return_exceptions=True
                        )
                    
                    db_insert_narration(payload)
                    db_insert_incident(pid, attack_type, events)
        await asyncio.sleep(2)

def determine_severity(event_type, filename):
    if event_type == "file_open" and ".env" in filename:
        return "critical"
    if event_type == "network":
        return "high"
    if event_type == "exec_spawn":
        return "medium"
    return "low"

def levenshtein(s1, s2):
    if len(s1) < len(s2):
        return levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

def classify_attack(event_type, filename, comm):
    # Mock some heuristics for Module F
    if event_type == "file_open" and (".env" in filename or "credentials" in filename):
        return "CRED_THEFT"
    if event_type == "exec_spawn" and "nc" in filename and "-e" in filename:
        return "REVERSE_SHELL"
    if event_type == "exec_spawn" and comm == "node" and "bash" in filename:
        return "REVERSE_SHELL"
    if event_type == "network" and "pool" in filename:
        return "CRYPTOMINER"
    
    # Very basic typosquatter simulation (normally we'd compare against top 100 packages)
    # If the comm is a known typosquat like lodsh, we flag it. 
    # For now, if the comm string is close to 'lodash' but not 'lodash'
    if comm != "lodash" and levenshtein(comm, "lodash") <= 2:
         return "TYPOSQUATTER"
         
    return "UNKNOWN"

def ring_buffer_callback(ctx, data, size):
    if b is None:
        return
    event = b["events"].event(data)
    
    comm = event.comm.decode('utf-8', errors='replace').strip('\x00')
    event_type = event.event_type.decode('utf-8', errors='replace').strip('\x00')
    filename = event.filename.decode('utf-8', errors='replace').strip('\x00')
    
    dest_ip = ""
    dest_port = 0
    if event_type == "network":
        try:
            dest_ip = socket.inet_ntoa(struct.pack("!I", event.dest_ip))
            dest_port = socket.ntohs(event.dest_port)
        except Exception:
            pass

    severity = determine_severity(event_type, filename)
    attack_type = classify_attack(event_type, filename, comm) # dest_port handled manually below if needed
    if event_type == "network" and dest_port == 4444:
        attack_type = "CRYPTOMINER"

    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    payload = {
        "type": "event",
        "data": {
            "timestamp": timestamp,
            "pid": event.pid,
            "ppid": event.ppid,
            "uid": event.uid,
            "comm": comm,
            "event_type": event_type,
            "filename": filename,
            "severity": severity,
            "attack_type": attack_type
        }
    }
    
    if event_type == "network":
        payload["data"]["dest_ip"] = dest_ip
        payload["data"]["dest_port"] = dest_port
    
    accumulate_event(payload["data"])
    db_insert_event(payload["data"])
    
    print(f"[DAEMON EVENT] {json.dumps(payload['data'])}", flush=True)

    if main_loop and event_queue:
        main_loop.call_soon_threadsafe(event_queue.put_nowait, payload)

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
    """Generates realistic attack sequence events when running on Windows/macOS without BCC."""
    print("[MOCK DAEMON] Starting mock event generator for UI testing...", flush=True)
    await asyncio.sleep(2)
    
    sample_sequence = [
        {
            "pid": 4100, "ppid": 1000, "uid": 1000, "comm": "node",
            "event_type": "file_open", "filename": "simulator/target-app/server.js", "severity": "low"
        },
        {
            "pid": 5820, "ppid": 4100, "uid": 1000, "comm": "node",
            "event_type": "file_open", "filename": "simulator/target-app/.env", "severity": "critical"
        },
        {
            "pid": 5820, "ppid": 4100, "uid": 1000, "comm": "node",
            "event_type": "network", "filename": "", "dest_ip": "45.14.224.197", "dest_port": 4444, "severity": "high"
        },
        {
            "pid": 8940, "ppid": 5820, "uid": 1000, "comm": "bash",
            "event_type": "exec_spawn", "filename": "bash -c id", "severity": "medium"
        }
    ]

    for item in sample_sequence:
        await asyncio.sleep(1.5)
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        attack_type = classify_attack(item["event_type"], item["filename"], item["comm"])
        payload = {
            "type": "event",
            "data": {
                "timestamp": timestamp,
                "pid": item["pid"],
                "ppid": item["ppid"],
                "uid": item["uid"],
                "comm": item["comm"],
                "event_type": item["event_type"],
                "filename": item.get("filename", ""),
                "severity": item["severity"],
                "attack_type": attack_type
            }
        }
        if item["event_type"] == "network":
            payload["data"]["dest_ip"] = item.get("dest_ip")
            payload["data"]["dest_port"] = item.get("dest_port")

        accumulate_event(payload["data"])
        db_insert_event(payload["data"])

        print(f"[MOCK EVENT GENERATED] {json.dumps(payload['data'])}", flush=True)
        if event_queue:
            await event_queue.put(payload)

async def check_abuseipdb(ip):
    if not ip_cache.should_check(ip):
        cached = ip_cache.get(ip)
        return cached.get("is_threat", False) if cached else False
    
    api_key = os.environ.get("ABUSEIPDB_KEY")
    if not api_key:
        return False
        
    url = f"https://api.abuseipdb.com/api/v2/check?ipAddress={ip}"
    headers = {
        'Accept': 'application/json',
        'Key': api_key
    }
    
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
            print(f"[AbuseIPDB Error] {e}", flush=True)
            return False
            
    return await asyncio.to_thread(fetch)

async def broadcast_worker():
    while True:
        if event_queue is None:
            await asyncio.sleep(0.1)
            continue
        payload = await event_queue.get()

        if payload["data"]["event_type"] == "network":
            ip = payload["data"].get("dest_ip")
            if ip:
                is_threat = await check_abuseipdb(ip)
                if is_threat:
                    payload["data"]["threat"] = True
                    payload["data"]["severity"] = "critical"

        if connected_clients:
            message = json.dumps(payload)
            await asyncio.gather(
                *[client.send(message) for client in connected_clients],
                return_exceptions=True
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
                    print(f"[KILL SWITCH] Received request to kill PID {pid}", flush=True)
                    try:
                        if os.name != 'nt':
                            os.kill(pid, signal.SIGKILL)
                        res = {"type": "kill_result", "pid": pid, "success": True, "message": f"PID {pid} killed successfully"}
                        # Update DB status
                        with sqlite3.connect(DB_PATH) as conn:
                            conn.execute("UPDATE incidents SET status = 'terminated' WHERE pid = ?", (pid,))
                    except Exception as err:
                        print(f"[KILL SWITCH ERROR] {err}", file=sys.stderr, flush=True)
                        res = {"type": "kill_result", "pid": pid, "success": False, "message": str(err)}
                    await websocket.send(json.dumps(res))
                elif data.get("action") == "get_history":
                    limit = int(data.get("limit", 50))
                    incidents = get_recent_incidents(limit)
                    await websocket.send(json.dumps({
                        "type": "history",
                        "incidents": incidents
                    }))
            except Exception as parse_err:
                print(f"[WEBSOCKET PARSE ERROR] {parse_err}", file=sys.stderr, flush=True)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.remove(websocket)
        print(f"[WEBSOCKET] Client disconnected.", flush=True)

async def main_async():
    global main_loop, event_queue, b
    main_loop = asyncio.get_running_loop()
    event_queue = asyncio.Queue()

    if BPF is None or os.name == 'nt':
        print("[NOTICE] Running in Mock Event Mode (Windows/macOS environment).", flush=True)
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

    asyncio.create_task(broadcast_worker())
    asyncio.create_task(check_chains())
    asyncio.create_task(emit_risk_score_loop())

    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        print(f"[DAEMON] WebSocket server active on ws://{WS_HOST}:{WS_PORT}", flush=True)
        # Emit initial history to all connected clients is handled within ws_handler if they ask,
        # but to push immediately on connect:
        # Actually, let the client ask via get_history action to be clean.
        await asyncio.Future()

def main():
    if websockets is None:
        print("[ERROR] Please install websockets: `pip install websockets`", file=sys.stderr)
        sys.exit(1)

    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        print("\n[DAEMON] Shutting down eBPF daemon and WebSocket server.", flush=True)
        sys.exit(0)

if __name__ == "__main__":
    main()
