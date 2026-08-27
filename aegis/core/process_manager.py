"""
Aelfra Aegis — Daemon Lifecycle Manager (start / stop / restart / status)
Cross-platform process supervisor supporting background and foreground daemon execution.
"""

import os
import signal
import subprocess
import sys
import time
from typing import Any, Dict, Optional

from aegis.core.paths import get_pid_file_path, get_global_data_dir, get_audit_dir
from aegis.core.doctor import check_daemon_running


def is_pid_alive(pid: int) -> bool:
    """Checks if a given PID is currently active."""
    if pid <= 0:
        return False
    if sys.platform == "win32":
        try:
            import ctypes
            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            SYNCHRONIZE = 0x00100000
            h = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, False, pid)
            if h:
                ctypes.windll.kernel32.CloseHandle(h)
                return True
        except Exception:
            pass
        return False
    else:
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False


def start_daemon(
    mode: str = "interactive",
    threshold: int = 90,
    ws_port: int = 8765,
    background: bool = True,
) -> Dict[str, Any]:
    """Starts the Aegis daemon in background or foreground."""
    status = check_daemon_running()
    if status.get("running"):
        return {
            "success": False,
            "running": True,
            "pid": status.get("pid"),
            "message": f"Aegis daemon is already running (PID: {status.get('pid')})",
        }

    # Clean stale PID file if present
    pid_file = get_pid_file_path()
    if os.path.exists(pid_file):
        try:
            os.remove(pid_file)
        except Exception:
            pass

    if not background:
        # Run directly in current process
        from aegis.core.daemon import run_daemon
        run_daemon(mode=mode, threshold=threshold, ws_port=ws_port)
        return {"success": True, "running": True, "pid": os.getpid()}

    # Spawn background daemon process
    cmd = [
        sys.executable,
        "-m",
        "aegis.core.daemon",
        f"--mode={mode}",
        f"--threshold={threshold}",
        f"--port={ws_port}",
    ]

    kwargs = {
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
        "stdin": subprocess.DEVNULL,
    }

    if sys.platform == "win32":
        kwargs["creationflags"] = (
            subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
        )
    else:
        kwargs["start_new_session"] = True

    proc = subprocess.Popen(cmd, **kwargs)
    time.sleep(1.2)  # Give time for daemon to boot and write PID file

    # Verify daemon started
    check = check_daemon_running()
    if check.get("running"):
        return {
            "success": True,
            "running": True,
            "pid": check.get("pid"),
            "mode": mode,
            "port": ws_port,
            "message": f"Aegis daemon started successfully in background (PID: {check.get('pid')}, Mode: {mode})",
        }
    else:
        # Fallback to process PID if alive
        if is_pid_alive(proc.pid):
            try:
                with open(pid_file, "w") as f:
                    f.write(str(proc.pid))
            except Exception:
                pass
            return {
                "success": True,
                "running": True,
                "pid": proc.pid,
                "mode": mode,
                "port": ws_port,
                "message": f"Aegis daemon started in background (PID: {proc.pid}, Mode: {mode})",
            }
        return {
            "success": False,
            "running": False,
            "message": "Failed to start Aegis daemon. Run 'aegis doctor' or check logs.",
        }


def stop_daemon() -> Dict[str, Any]:
    """Stops the active Aegis daemon process."""
    status = check_daemon_running()
    if not status.get("running") or not status.get("pid"):
        # Clean up any leftover PID file
        pid_file = get_pid_file_path()
        if os.path.exists(pid_file):
            try:
                os.remove(pid_file)
            except Exception:
                pass
        return {"success": False, "message": "No active Aegis daemon found running."}

    pid = status["pid"]

    # Terminate process
    try:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/F", "/PID", str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            os.kill(pid, signal.SIGTERM)
            time.sleep(0.5)
            if is_pid_alive(pid):
                os.kill(pid, signal.SIGKILL)
    except Exception as e:
        return {"success": False, "message": f"Error terminating daemon (PID {pid}): {e}"}

    # Remove PID file
    pid_file = get_pid_file_path()
    if os.path.exists(pid_file):
        try:
            os.remove(pid_file)
        except Exception:
            pass

    return {
        "success": True,
        "stopped_pid": pid,
        "message": f"Aegis daemon (PID: {pid}) stopped successfully.",
    }


def restart_daemon(
    mode: str = "interactive", threshold: int = 90, ws_port: int = 8765
) -> Dict[str, Any]:
    """Restarts the Aegis daemon."""
    stop_daemon()
    time.sleep(0.8)
    return start_daemon(mode=mode, threshold=threshold, ws_port=ws_port, background=True)
