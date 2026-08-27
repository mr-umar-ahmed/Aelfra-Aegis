# Changelog

All notable changes to **Aelfra Aegis** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2024-08-26

### Added
- **Modular Telemetry Backend Architecture** — `TelemetryBackend` abstract base class with a clean `start()`, `stop()`, `is_available()`, `get_status()` lifecycle interface.
- **Linux eBPF Backend** (`LinuxEBPFBackend`) — BCC ring buffer / kprobe-based kernel syscall interception for `openat`, `execve`, and `tcp_connect`.
- **Windows Native Backend** (`WindowsNativeBackend`) — Real Win32 telemetry using zero-dependency `ctypes` bindings:
  - Process creation detection via `CreateToolhelp32Snapshot`
  - Active TCP socket tracking via `GetExtendedTcpTable` (`iphlpapi.dll`)
  - Workspace sensitive file monitoring
- **Mock Telemetry Backend** (`MockTelemetryBackend`) — Synthetic event stream for CI, testing, and unsupported environments.
- **TelemetryManager** — Runtime capability auto-detector that selects Linux eBPF > Windows Native > Mock.
- **Policy Rule Engine** (`RuleEngine`) — Declarative JSON security policy evaluation supporting `file`, `exec`, `network`, and temporal `chain` rules with hot-reload.
- **SIEM-Compatible Logger** (`StructuredLogger`) — Append-only JSONL audit log with daily UTC rotation and MITRE ATT&CK taxonomy tags.
- **Grafana Loki Shipper** (`LokiShipper`) — Non-blocking background log shipper with queue and graceful fallback.
- **4-Tier Configuration System** (`AegisConfig`) — Defaults → Global (`~/.aegis/config.json`) → Project (`.aegis/config.json`) → CLI overrides, plus environment variable support.
- **Daemon Lifecycle Manager** (`process_manager.py`) — Cross-platform `start_daemon()`, `stop_daemon()`, `restart_daemon()` with PID file tracking.
- **CLI** (`aegis`) — Full-featured entry point: `init`, `doctor`, `status`, `start`, `stop`, `restart`, `protect`, `scan`, `logs`, `report`, `config`, `dashboard`.
- **`aegis doctor`** — Truthful, OS-specific diagnostic report showing active backend, privilege level, BCC availability, Docker status, and daemon state.
- **`aegis protect <cmd>`** — Command supervision with live threat reporting.
- **`aegis scan`** — Isolated Docker container dependency scanning.
- **SQLite forensic indexing** — Events, narrations, and incidents stored for report generation.
- **Multi-stage temporal attack chain correlation** — e.g., `CRED_001 → NET_001 → CHAIN_001` within configurable time windows.
- **WebSocket Bridge** — Real-time event streaming at `ws://0.0.0.0:8765` for the Next.js dashboard.
- **Risk Scoring** — Deterministic 0–100 risk score computed from process name, event type, destination port, and filename.
- **Full test suite** — 18 unit tests covering `RuleEngine`, `StructuredLogger`, `TelemetryManager`, all backends, risk scoring, and CLI commands.
- **PyPI-ready `pyproject.toml`** — `setuptools` build system, proper classifiers, asset inclusion, and `aegis` CLI entry point.

### Security
- Mock telemetry clearly labeled `MOCK` capability level — never misrepresented as production telemetry.
- `comm_not_in` whitelisting prevents false positives from legitimate admin tools.
- RFC1918 private/loopback IP exclusion on network event matching.

---

## [0.x.x] — Pre-release Development

Initial architecture, eBPF C probe authoring, Next.js dashboard, attack simulator library, and baseline CI pipeline.
