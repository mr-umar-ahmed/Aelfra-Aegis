"""
Aelfra Aegis — Universal CLI Dispatcher (aegis binary)
The central user-facing command-line interface for project initialization,
dependency scanning, command supervision, diagnostics, and daemon lifecycle management.
"""

import argparse
import sys
from typing import List, Optional

# Ensure UTF-8 output encoding across Windows/Linux terminals
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import aegis
from aegis.core.doctor import check_daemon_running
from aegis.core.process_manager import start_daemon, stop_daemon, restart_daemon
from aegis.cli.commands.init import run_init
from aegis.cli.commands.doctor import run_doctor_cmd
from aegis.cli.commands.protect import run_protect
from aegis.cli.commands.scan import run_scan
from aegis.cli.commands.logs import run_logs
from aegis.cli.commands.report import run_report
from aegis.cli.commands.config import run_config
from aegis.cli.commands.dashboard import run_dashboard


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="aegis",
        description="Aelfra Aegis — Kernel-Level Software Supply Chain Runtime Defense Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  aegis init                         # Initialize security in current project
  aegis doctor                       # Check kernel eBPF and toolchain capabilities
  aegis status                       # Check daemon and active protection state
  aegis start --mode=headless        # Start autonomous daemon in background
  aegis protect npm install          # Supervise and guard command execution
  aegis scan                         # Scan project dependencies for threats
  aegis logs                         # View SIEM-compatible JSONL audit logs
  aegis report                       # Inspect generated threat incident reports
  aegis dashboard                    # Open interactive React Flow web console
        """,
    )

    parser.add_argument(
        "-v", "--version", action="version", version=f"aegis v{aegis.__version__}"
    )

    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # 1. init
    init_parser = subparsers.add_parser("init", help="Initialize Aegis defense for the current project")
    init_parser.add_argument("--mode", choices=["interactive", "headless", "audit"], default="interactive")
    init_parser.add_argument("--threshold", type=int, default=90, help="Auto-kill confidence threshold (0-100)")

    # 2. doctor
    subparsers.add_parser("doctor", help="Run system diagnostics and capability checks")

    # 3. status
    subparsers.add_parser("status", help="Show Aegis daemon and runtime protection status")

    # 4. start
    start_parser = subparsers.add_parser("start", help="Start the Aegis security daemon")
    start_parser.add_argument("--mode", choices=["interactive", "headless", "audit"], default="interactive")
    start_parser.add_argument("--threshold", type=int, default=90, help="Auto-kill confidence threshold")
    start_parser.add_argument("--port", type=int, default=8765, help="WebSocket bridge port")
    start_parser.add_argument("-f", "--foreground", action="store_true", help="Run daemon in foreground")

    # 5. stop
    subparsers.add_parser("stop", help="Stop the background Aegis daemon")

    # 6. restart
    restart_parser = subparsers.add_parser("restart", help="Restart the background Aegis daemon")
    restart_parser.add_argument("--mode", choices=["interactive", "headless", "audit"], default="interactive")
    restart_parser.add_argument("--threshold", type=int, default=90)
    restart_parser.add_argument("--port", type=int, default=8765)

    # 7. protect
    protect_parser = subparsers.add_parser("protect", help="Run a command under Aegis kernel protection")
    protect_parser.add_argument("target_command", nargs=argparse.REMAINDER, help="Command to execute and guard")

    # 8. scan
    scan_parser = subparsers.add_parser("scan", help="Scan dependency manifests (package.json, requirements.txt)")
    scan_parser.add_argument("manifest", nargs="?", default=None, help="Manifest file path (auto-detected if omitted)")
    scan_parser.add_argument("--ci", action="store_true", help="Run in strict CI/CD gate mode")
    scan_parser.add_argument("--dry-run", action="store_true", help="Print plan without running daemon/Docker")

    # 9. logs
    logs_parser = subparsers.add_parser("logs", help="View SIEM-compatible JSONL audit logs")
    logs_parser.add_argument("-n", "--tail", type=int, default=20, help="Number of recent log lines to display")

    # 10. report
    report_parser = subparsers.add_parser("report", help="View forensic incident reports")
    report_parser.add_argument("--id", type=str, default=None, help="Specific incident ID to view")

    # 11. config
    subparsers.add_parser("config", help="View active hierarchical configuration")

    # 12. dashboard
    dash_parser = subparsers.add_parser("dashboard", help="Open the interactive web provenance console")
    dash_parser.add_argument("--port", type=int, default=3000, help="Dashboard port")

    return parser


def run_status_cmd() -> int:
    stat = check_daemon_running()
    print("════════════════════════════════════════════════════════════════")
    print("                 AELFRA AEGIS RUNTIME STATUS                    ")
    print("════════════════════════════════════════════════════════════════")
    if stat["running"]:
        print(f"• Daemon Status : ✅ ACTIVE & RUNNING")
        print(f"• Daemon PID    : {stat['pid']}")
        print(f"• Protection    : Real-Time Kernel Syscall Monitoring Active")
    else:
        print(f"• Daemon Status : ⚪ INACTIVE (Stopped)")
        print(f"• Tip           : Run 'aegis start' to launch background protection.")
    print("════════════════════════════════════════════════════════════════\n")
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = create_parser()
    args, unknown = parser.parse_known_args(argv)

    if not args.command:
        parser.print_help()
        return 0

    if args.command == "init":
        return run_init(args)
    elif args.command == "doctor":
        return run_doctor_cmd(args)
    elif args.command == "status":
        return run_status_cmd()
    elif args.command == "start":
        res = start_daemon(
            mode=args.mode,
            threshold=args.threshold,
            ws_port=args.port,
            background=not args.foreground,
        )
        print(res.get("message", ""))
        return 0 if res.get("success") else 1
    elif args.command == "stop":
        res = stop_daemon()
        print(res.get("message", ""))
        return 0 if res.get("success") else 1
    elif args.command == "restart":
        res = restart_daemon(mode=args.mode, threshold=args.threshold, ws_port=args.port)
        print(res.get("message", ""))
        return 0 if res.get("success") else 1
    elif args.command == "protect":
        cmd_to_run = args.target_command
        if unknown:
            cmd_to_run = unknown + cmd_to_run
        return run_protect(cmd_to_run)
    elif args.command == "scan":
        return run_scan(args)
    elif args.command == "logs":
        return run_logs(args)
    elif args.command == "report":
        return run_report(args)
    elif args.command == "config":
        return run_config(args)
    elif args.command == "dashboard":
        return run_dashboard(args)
    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
