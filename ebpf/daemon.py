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
import sys
import threading
import time

try:
    from bcc import BPF
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

def determine_severity(event_type, filename):
    if event_type == "file_open" and ".env" in filename:
        return "critical"
    if event_type == "net_connect":
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
    if event_type == "net_connect" and "pool" in filename:
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
    
    severity = determine_severity(event_type, filename)
    attack_type = classify_attack(event_type, filename, comm)
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
            "event_type": "net_connect", "filename": "http://localhost:9999/exfil", "severity": "high"
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
                "filename": item["filename"],
                "severity": item["severity"],
                "attack_type": attack_type
            }
        }
        print(f"[MOCK EVENT GENERATED] {json.dumps(payload['data'])}", flush=True)
        if event_queue:
            await event_queue.put(payload)

async def broadcast_worker():
    while True:
        if event_queue is None:
            await asyncio.sleep(0.1)
            continue
        payload = await event_queue.get()
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
                    except Exception as err:
                        print(f"[KILL SWITCH ERROR] {err}", file=sys.stderr, flush=True)
                        res = {"type": "kill_result", "pid": pid, "success": False, "message": str(err)}
                    await websocket.send(json.dumps(res))
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
            print("[DAEMON] eBPF probes loaded successfully.", flush=True)
            
            t = threading.Thread(target=bcc_polling_thread, daemon=True)
            t.start()
        else:
            print(f"[ERROR] C probe file missing at {C_PROBE_PATH}", file=sys.stderr)

    asyncio.create_task(broadcast_worker())

    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        print(f"[DAEMON] WebSocket server active on ws://{WS_HOST}:{WS_PORT}", flush=True)
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
