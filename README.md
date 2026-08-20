# 🛡️ Aelfra Aegis

> Real-Time eBPF Supply Chain Attack Detector & Process Provenance Kill Switch

---

## 📌 Project Overview

Aelfra Aegis is a lightweight, low-overhead security monitoring system designed to detect and neutralize npm supply chain attacks during package installation (e.g. `npm postinstall` hook hijacking). By tapping directly into kernel syscall boundary probes with eBPF (Extended Berkeley Packet Filter), Aegis identifies credential theft, unauthorized process spawning, and exfiltration attempts in real-time.

Unlike traditional post-hoc vulnerability scanners or heavy container security suites, Aegis provides a live temporal process provenance graph and an instant one-click UI kill switch (`SIGKILL`) to stop malicious lifecycle scripts before credentials leave the machine.

---

## 🏗️ Architecture

```mermaid
graph TD
    subgraph "Target Host / Environment"
        A["Victim App (target-app)"] -->|npm install| B["Malicious Package (aegis-utils)"]
        B -->|lifecycle hook| C["install.js Payload"]
        C -->|sys_enter_openat| D[".env Credential Read"]
        C -->|sys_enter_connect| E["Exfiltration POST (:9999)"]
        C -->|sys_enter_execve| F["Bash Shell Spawn"]
    end

    subgraph "Linux Kernel Layer"
        D & E & F -->|tracepoints| G["eBPF Probes (probes.c)"]
        G -->|BPF Ring Buffer| H["Kernel-to-Userspace Event Stream"]
    end

    subgraph "Daemon & Messaging Layer"
        H -->|poll| I["Python BCC Daemon (daemon.py)"]
        I -->|WebSocket ws://localhost:8765| J["Async Event Broadcaster"]
    end

    subgraph "React Dashboard Layer"
        J --> K["Next.js 14 Dashboard"]
        K --> L["React Flow Provenance Graph"]
        L -->|User Clicks Kill| M["WebSocket Kill Command"]
        M -->|os.kill(pid, SIGKILL)| I
    end
```

---

## ⚔️ Comparison: Falco vs. Tracee vs. Aelfra Aegis

| Feature / Dimension | Falco | Tracee | Aelfra Aegis |
| :--- | :--- | :--- | :--- |
| **Primary Scope** | General runtime security for containers & K8s | Container & host threat detection | Specialized npm & build-time supply chain attacks |
| **Detection Engine** | Declarative YAML rules matching single syscalls | Go / Rego signatures across event streams | Causal process ancestry + `.env` exfiltration correlation |
| **Enforcement & Response** | Passive alerting (requires external webhooks) | Auditing / alerting | Native interactive 1-click `SIGKILL` from UI |
| **Visualization** | CLI / Grafana metrics (no process graph) | Event log stream | Real-time React Flow temporal provenance graph |

---

## 🚀 Setup & Installation

### Prerequisites
- **Linux Environment**: Ubuntu 22.04 LTS or WSL2 (Kernel ≥ 5.15)
- **BCC Tools**: `sudo apt install bpfcc-tools python3-bpfcc`
- **Node.js**: `v20.x` or later
- **Python**: `3.10+` with `websockets` (`pip install websockets`)

### Quickstart

1. **Clone Repository**
   ```bash
   git clone https://github.com/mr-umar-ahmed/Aelfra-Aegis.git
   cd Aelfra-Aegis
   ```

2. **Start Exfil C2 Listener (Simulator)**
   ```bash
   python3 simulator/listener.py
   ```

3. **Launch eBPF Daemon (Root Required)**
   ```bash
   sudo python3 ebpf/daemon.py
   ```

4. **Launch Dashboard**
   ```bash
   cd dashboard
   npm install
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

5. **Trigger Attack**
   ```bash
   cd simulator/target-app
   npm install --foreground-scripts
   ```

---

## 🎬 Demo Walkthrough

1. When `npm install` runs, `install.js` triggers syscalls captured by the eBPF kernel probes.
2. The eBPF ring buffer transfers `openat` (`.env`), `connect` (`localhost:9999`), and `execve` (`bash`) events to `daemon.py`.
3. The Next.js React Flow dashboard renders process nodes (`node`, `bash`) with color-coded severity borders.
4. Processes accessing sensitive `.env` files trigger an animated red border and display a `KILL [PID]` button.
5. Clicking the **KILL** button emits a WebSocket command to instantly send `SIGKILL` to the malicious PID.
