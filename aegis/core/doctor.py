"""
Aelfra Aegis — Environment Diagnostics & Capability Detector (aegis doctor)
Reports operating system, kernel version, eBPF capabilities, BCC, Docker, and privileges.
"""

import os
import platform
import shutil
import subprocess
import sys
from typing import Dict, Any, List

from aegis.core.paths import is_root, get_pid_file_path
from aegis.core.telemetry import TelemetryManager


def check_ebpf_btf() -> bool:
    """Check if kernel BTF metadata is available for CO-RE eBPF."""
    return os.path.exists("/sys/kernel/btf/vmlinux")


def check_bcc() -> bool:
    """Check if BCC (BPF Compiler Collection) is importable."""
    try:
        from bcc import BPF  # type: ignore
        return True
    except Exception:
        return False


def check_docker() -> Dict[str, Any]:
    """Check Docker CLI availability and daemon liveness."""
    docker_bin = shutil.which("docker")
    if not docker_bin:
        return {"installed": False, "running": False, "version": None}
    
    try:
        res = subprocess.run(["docker", "version", "--format", "{{.Server.Version}}"], capture_output=True, text=True, timeout=3)
        running = res.returncode == 0
        version = res.stdout.strip() if running else None
        return {"installed": True, "running": running, "version": version}
    except Exception:
        return {"installed": True, "running": False, "version": None}


def check_daemon_running() -> Dict[str, Any]:
    """Checks if Aegis daemon is currently running."""
    pid_file = get_pid_file_path()
    if not os.path.exists(pid_file):
        return {"running": False, "pid": None}
    
    try:
        with open(pid_file, "r") as f:
            pid = int(f.read().strip())
        
        # Check if process is alive
        if sys.platform == "win32":
            import ctypes
            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            SYNCHRONIZE = 0x00100000
            h = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, False, pid)
            if h:
                ctypes.windll.kernel32.CloseHandle(h)
                return {"running": True, "pid": pid}
        else:
            os.kill(pid, 0)
            return {"running": True, "pid": pid}
    except Exception:
        pass
    
    return {"running": False, "pid": None}


def run_doctor() -> Dict[str, Any]:
    """Executes full diagnostic suite and computes platform capability level."""
    os_name = platform.system()
    kernel_release = platform.release()
    arch = platform.machine()
    python_ver = sys.version.split()[0]
    
    root_priv = is_root()
    btf_avail = check_ebpf_btf()
    bcc_avail = check_bcc()
    docker_info = check_docker()
    daemon_info = check_daemon_running()

    # Query TelemetryManager for active backend capability
    tm = TelemetryManager()
    telemetry_status = tm.get_status()
    selected_backend = telemetry_status["selected_backend"]
    active_details = telemetry_status["active"]
    
    # Compute overall capability status
    if os_name == "Linux" and bcc_avail and root_priv:
        capability = "READY"
        mode_desc = "Full Kernel eBPF Probing + Autonomous SIGKILL Active"
    elif os_name == "Linux" and bcc_avail and not root_priv:
        capability = "LIMITED"
        mode_desc = "Linux eBPF available (Elevate with sudo for live kernel interception)"
    elif os_name == "Windows":
        capability = "READY"
        mode_desc = f"Live {selected_backend} (Process Creation & Network Sockets)"
    elif selected_backend != "Mock Telemetry Stream":
        capability = "READY"
        mode_desc = f"Live Telemetry Active via {selected_backend}"
    else:
        capability = "MOCK"
        mode_desc = "Synthetic Mock Event Stream Active (Fallback Mode)"
        
    return {
        "capability": capability,
        "mode_desc": mode_desc,
        "os": os_name,
        "kernel": kernel_release,
        "arch": arch,
        "python_version": python_ver,
        "is_root": root_priv,
        "btf_available": btf_avail,
        "bcc_available": bcc_avail,
        "docker": docker_info,
        "daemon": daemon_info,
        "telemetry": telemetry_status
    }
