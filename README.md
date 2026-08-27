# Aelfra Aegis — Runtime Supply Chain Attack Detection & Defense

```text
    _     _____ ____ ___ ____  
   / \   | ____/ ___|_ _/ ___| 
  / _ \  |  _| | |  _ | |\___ \ 
 / ___ \ | |___| |_| || | ___) |
/_/   \_\|______\____|___|____/ 
```

[![PyPI version](https://img.shields.io/badge/pypi-v1.0.0-blue.svg)](https://pypi.org/project/aelfra-aegis/)
[![Python: 3.9+](https://img.shields.io/badge/python-3.9%20%7C%203.10%20%7C%203.11%20%7C%203.12%20%7C%203.13-blue.svg)](https://pypi.org/project/aelfra-aegis/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platforms](https://img.shields.io/badge/platform-Linux%20%7C%20Windows%20%7C%20macOS-lightgrey.svg)](#platform-support)

Aelfra Aegis is a cross-platform, runtime software supply chain security tool and Python engine. It monitors system-level activity during build, package install, and execution to detect and neutralize malicious behavior—such as credential exfiltration, unexpected shell spawning, and suspicious network egress.

---

## Key Features

- **Multi-Platform Telemetry Engine**:
  - **Linux**: Live eBPF kprobes and ring buffer event capture (`openat`, `execve`, `tcp_connect`) via BCC.
  - **Windows**: Live Win32 native telemetry (`CreateToolhelp32Snapshot` process tracking and `GetExtendedTcpTable` socket inspection) using standard library `ctypes`.
  - **macOS / Non-Privileged**: Synthetic Mock Mode for development, testing, and continuous integration.
- **Declarative Policy Rule Engine**: Hot-reloading JSON detection rules with MITRE ATT&CK taxonomy mapping.
- **Multi-Stage Temporal Chain Correlation**: Tracks multi-step attacks across processes (e.g. credential read followed by network connect).
- **SIEM-Compatible Audit Logging**: Self-contained, append-only JSON Lines (`.jsonl`) audit trail with daily UTC rotation.
- **Autonomous Threat Blocking**: Headless mode with sub-50ms process termination (`SIGKILL`) on high-confidence rule matches.
- **Unified CLI Tool**: Inspect system capabilities (`aegis doctor`), supervise commands (`aegis protect`), and scan dependencies (`aegis scan`).

---

## Installation

### Base Package (Core Engine & CLI)

The base package has **zero mandatory third-party dependencies** and runs entirely on the Python Standard Library:

```bash
pip install aelfra-aegis
```

### Optional Extras

- **Dashboard / WebSocket Bridge**:
  ```bash
  pip install "aelfra-aegis[dashboard]"
  ```
- **Full Bundle**:
  ```bash
  pip install "aelfra-aegis[full]"
  ```
- **Development & Testing Toolchain**:
  ```bash
  pip install "aelfra-aegis[dev]"
  ```

---

## Quick Start (CLI)

### 1. Diagnose Environment Capabilities

Run the built-in diagnostic suite to inspect available telemetry backends, privilege levels, and container tools:

```bash
aegis doctor
```

Output example on Windows:
```text
════════════════════════════════════════════════════════════════
               AELFRA AEGIS SYSTEM DIAGNOSTICS                  
════════════════════════════════════════════════════════════════

[1/4] Operating System & Environment:
   • OS Platform      : Windows (AMD64)
   • Kernel Version   : 11
   • Python Runtime   : Python 3.14.6

[2/4] Kernel & OS Telemetry Capabilities:
   • Active Backend   : ✅ Windows Native Telemetry (Win32 API)
   • Backend Status   : ✅ ACTIVE
   • Process Privilege: ℹ️ Standard User (Win32 Process & Socket Telemetry Active)

[3/4] Containerization & Telemetry:
   • Docker Engine    : ✅ Active
   • Aegis Daemon     : ⚪ Inactive (Run 'aegis start' to activate)

[4/4] Capability Assessment:
   🎉 STATUS: READY — Live Windows Native Telemetry (Win32 API) (Process Creation & Network Sockets)
════════════════════════════════════════════════════════════════
```

### 2. Guard Command Execution

Supervise package managers, build scripts, or arbitrary processes with active runtime monitoring:

```bash
aegis protect npm install
# or
aegis protect pip install -r requirements.txt
```

### 3. Scan Dependency Manifests in Isolated Containers

```bash
aegis scan package.json
# or dry-run without spinning up containers:
aegis scan --dry-run requirements.txt
```

### 4. Background Security Daemon

```bash
# Start background daemon in autonomous headless auto-block mode
aegis start --mode=headless --threshold=90

# Check daemon status
aegis status

# View SIEM audit log stream
aegis logs -n 30

# Inspect forensic incident reports
aegis report

# Stop background daemon
aegis stop
```

---

## Python API Usage

Embed Aegis telemetry and detection directly into your Python security tools:

```python
from aegis.core.telemetry import TelemetryManager
from aegis.core.rule_engine import RuleEngine
from aegis.core.structured_logger import StructuredLogger

# 1. Initialize Rule Engine and Logger
rule_engine = RuleEngine()
logger = StructuredLogger()

# 2. Define event callback
def on_security_event(event):
    matches = rule_engine.evaluate_event(event)
    for match in matches:
        print(f"🚨 Threat detected: {match['rule_name']} ({match['rule_id']})")
        logger.log_event(event, rule_match=match, action_taken="alert")

# 3. Start Telemetry Manager (auto-selects best available backend)
telemetry = TelemetryManager(callback=on_security_event)
telemetry.start()

print(f"Active Backend: {telemetry.get_status()['selected_backend']}")
```

---

## Platform Support & Capabilities

| Operating System | Active Telemetry Backend | Mechanism | Required Privileges | Capability Level |
| :--- | :--- | :--- | :--- | :--- |
| **Linux (Kernel 5.4+)** | `LinuxEBPFBackend` | BCC kprobes (`openat`, `execve`, `connect`) | Root (`sudo`) / `CAP_BPF` | `READY` (Full live kernel interception) |
| **Linux (Non-Root)** | `MockTelemetryBackend` | Synthetic event stream fallback | Standard user | `LIMITED` (Elevate with sudo for live probes) |
| **Windows 10/11 / Server** | `WindowsNativeBackend` | Win32 `Toolhelp32` + `GetExtendedTcpTable` | Standard user or Administrator | `READY` (Live process & network socket tracking) |
| **macOS / Other** | `MockTelemetryBackend` | Synthetic event stream fallback | Standard user | `MOCK` (Development & CI mode) |

---

## Policy Rule Engine

Aegis uses declarative JSON detection rules. Rules support single-event conditions and temporal attack chains.

### Example: Credential Theft Exfiltration Chain

```json
{
  "id": "CHAIN_001",
  "name": "Full Credential Exfiltration Chain",
  "description": "Sensitive file access followed by unexpected outbound network connection from the same PID within 30s",
  "severity": "CRITICAL",
  "mitre_technique": "T1020",
  "event_type": "chain",
  "conditions": {
    "requires_sequence": ["CRED_001", "NET_001"],
    "within_seconds": 30,
    "same_pid": true
  },
  "action": "kill",
  "confidence": 97
}
```

---

## Security & Privacy Considerations

- **No Data Exfiltration**: Aegis writes audit logs and incident reports exclusively to local paths (`~/.aegis/` or `/var/lib/aegis/`).
- **Zero-Privilege Escalation**: Does not install kernel drivers or modify operating system binaries.
- **Truthful Diagnostics**: Mock telemetry is explicitly reported as `MOCK` capability in diagnostics and never misrepresented as production telemetry.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

## Links & Community

- **Repository**: [github.com/mr-umar-ahmed/Aelfra-Aegis](https://github.com/mr-umar-ahmed/Aelfra-Aegis)
- **Bug Tracker**: [github.com/mr-umar-ahmed/Aelfra-Aegis/issues](https://github.com/mr-umar-ahmed/Aelfra-Aegis/issues)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
