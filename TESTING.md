# 🧪 Aelfra Aegis — Comprehensive Testing Guide

Welcome to the **Aelfra Aegis** testing guide! This document provides step-by-step instructions to test and verify the attack simulator, eBPF kernel probes, WebSocket real-time bridge, and the React Flow interactive dashboard.

---

## 🎯 Testing Modes

Aegis supports **two testing modes**:

1. **Full Linux eBPF Mode** (Ubuntu 22.04 / WSL2 with `sudo` and kernel probes)
2. **Windows / macOS UI Mock Mode** (Automatic fallback for testing the React Flow UI and Kill Switch without Linux kernel permissions)

---

## 🚀 Quickstart Testing Flow (3 Terminals)

### Terminal 1: C2 Exfiltration Listener (Phase 0)
Simulates an external attacker C2 server listening on port `9999`.

```bash
cd simulator
python listener.py
```
*Expected output:*
```text
[LISTENER] C2 Exfiltration Listener active on http://0.0.0.0:9999
[LISTENER] Waiting for incoming POST requests...
```

---

### Terminal 2: eBPF Daemon & WebSocket Bridge (Phase 1 & 2)

#### On Linux / WSL2 (Kernel Mode):
```bash
sudo python3 ebpf/daemon.py
```

#### On Windows / macOS (UI Mock Mode):
```powershell
python ebpf/daemon.py
```
*Expected output:*
```text
[NOTICE] Running in Mock Event Mode (Windows/macOS environment).
[DAEMON] WebSocket server active on ws://0.0.0.0:8765
```

---

### Terminal 3: Next.js React Flow Dashboard (Phase 2 & 3)

```bash
cd dashboard
npm run dev
```
*Expected output:*
```text
Ready in 1.5s - Local: http://localhost:3000
```
Open **`http://localhost:3000`** in your browser.

---

## ⚔️ Executing the Supply Chain Attack

Open **Terminal 4** and trigger the malicious `npm postinstall` script:

```bash
cd simulator/target-app
npm install --foreground-scripts
```

---

## 🔍 Verification Checklist

| Phase / Vector | Expected Behavior | Verification Location |
| :--- | :--- | :--- |
| **Phase 0 — Postinstall Hook** | `install.js` runs automatically upon `npm install` | Terminal 4 output (`[AEGIS-SIMULATOR] postinstall script running...`) |
| **Phase 0 — Credential Theft** | Finds and extracts `.env` dummy AWS keys | Terminal 4 output (`[EXFIL] Found target secrets...`) |
| **Phase 0 — Data Exfiltration** | POSTs stolen credentials to `http://localhost:9999/exfil` | Terminal 1 output (`[LISTENER] EXFILTRATION DETECTED from 127.0.0.1...`) |
| **Phase 0 — Process Spawning** | Spawns `bash -c "id"` child process | Terminal 4 output (`[SHELL] Output: uid=1000...`) |
| **Phase 1 — Kernel Tapping** | eBPF probes capture `openat`, `connect`, and `execve` | `daemon.py` terminal output (`[DAEMON EVENT] ...`) |
| **Phase 2 — Live Graph UI** | Nodes (`node`, `bash`) and Edges (`file read`, `net connect`, `exec spawn`) appear | Browser `http://localhost:3000` |
| **Phase 2 — Red Threat Alert** | Node accessing `.env` glows red with pulsing border | Browser `http://localhost:3000` |
| **Phase 2 & 3 — Kill Switch** | Clicking **KILL [PID]** sends WebSocket signal & kills process | Browser button updates to `TERMINATED ✓`, `daemon.py` outputs `PID killed successfully` |

---

## ⚡ Performance Overhead Measurement (Phase 3)

To run the CPU overhead benchmark script:

```bash
chmod +x benchmarks/overhead.sh
./benchmarks/overhead.sh
```

---

## 🛠️ Troubleshooting & FAQ

#### Q: The browser dashboard says `Connecting (ws://localhost:8765)` and won't connect.
- Ensure `python ebpf/daemon.py` is active in another terminal.
- Verify port `8765` is not blocked by a local firewall.

#### Q: I don't see colors or styling on the dashboard.
- Ensure `dashboard/postcss.config.js` is present.
- Restart the Next.js server (`Ctrl+C` in Terminal 3, then `npm run dev`).

#### Q: How do I test the kill switch in Mock Mode on Windows?
- In Mock Mode, `daemon.py` accepts the WebSocket `{"action":"kill","pid":N}` command and returns a success response. The UI node will transition to `TERMINATED ✓`.
