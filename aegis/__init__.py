"""
Aelfra Aegis — Kernel-Level Software Supply Chain Runtime Defense
=================================================================

Cross-platform runtime security engine providing:
  - Linux eBPF kprobe/tracepoint telemetry (requires BCC + root)
  - Windows Native Win32 telemetry (zero-dependency ctypes)
  - Declarative JSON policy rule engine with MITRE ATT&CK tagging
  - Multi-stage temporal attack chain correlation
  - SIEM-compatible JSONL structured logging
  - Grafana Loki log shipping
  - Autonomous SIGKILL threat blocking (headless mode)

Quick start::

    from aegis.core.telemetry import TelemetryManager
    from aegis.core.rule_engine import RuleEngine

    manager = TelemetryManager(callback=my_callback)
    manager.start()

CLI usage::

    aegis doctor          # System capability diagnostics
    aegis start           # Start background daemon
    aegis protect <cmd>   # Supervise a command under runtime monitoring
    aegis scan            # Scan dependencies in an isolated container
"""

__version__ = "1.0.0"
__author__ = "Umar Ahmed"
__email__ = "umar@aelfra.security"
__license__ = "MIT"

__all__ = ["__version__", "__author__", "__email__", "__license__"]
