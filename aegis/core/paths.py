"""
Aelfra Aegis — Robust Path & Resource Resolution Layer
Decouples execution from repository paths and ensures Aegis works from any directory.
"""

import os
import sys
from pathlib import Path
from typing import Optional


def is_root() -> bool:
    """Check if process has root/admin privileges on Linux/Unix."""
    if hasattr(os, "geteuid"):
        return os.geteuid() == 0
    return False


def get_package_asset_path(filename: str) -> str:
    """
    Locates bundled package assets (e.g. rules.json, probes.c).
    Works in editable development, pip install, or site-packages.
    """
    # 1. Check relative to this module in aegis/assets/
    module_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    asset_path = os.path.join(module_dir, "assets", filename)
    if os.path.exists(asset_path):
        return os.path.abspath(asset_path)

    # 2. Check repo root fallback (e.g. config/ or ebpf/)
    repo_root = os.path.dirname(module_dir)
    if filename == "rules.json":
        fallback = os.path.join(repo_root, "config", "rules.json")
        if os.path.exists(fallback):
            return os.path.abspath(fallback)
    elif filename == "probes.c":
        fallback = os.path.join(repo_root, "ebpf", "probes.c")
        if os.path.exists(fallback):
            return os.path.abspath(fallback)

    return asset_path


def get_global_config_dir() -> str:
    """Returns global configuration directory (~/.aegis or /etc/aegis)."""
    if is_root() and sys.platform.startswith("linux"):
        base = "/etc/aegis"
    else:
        base = os.path.expanduser("~/.aegis")
    os.makedirs(base, exist_ok=True)
    return base


def get_global_data_dir() -> str:
    """Returns persistent data directory (~/.aegis/data or /var/lib/aegis)."""
    if is_root() and sys.platform.startswith("linux"):
        base = "/var/lib/aegis"
    else:
        base = os.path.join(get_global_config_dir(), "data")
    os.makedirs(base, exist_ok=True)
    return base


def get_audit_dir(data_dir: Optional[str] = None) -> str:
    """Returns SIEM JSONL audit log directory."""
    parent = data_dir or get_global_data_dir()
    path = os.path.join(parent, "audit")
    os.makedirs(path, exist_ok=True)
    return path


def get_incidents_dir(data_dir: Optional[str] = None) -> str:
    """Returns incident report JSON directory."""
    parent = data_dir or get_global_data_dir()
    path = os.path.join(parent, "incidents")
    os.makedirs(path, exist_ok=True)
    return path


def get_db_path(data_dir: Optional[str] = None) -> str:
    """Returns SQLite database path."""
    parent = data_dir or get_global_data_dir()
    return os.path.join(parent, "aegis.db")


def get_pid_file_path() -> str:
    """Returns daemon PID tracking file path."""
    if is_root() and sys.platform.startswith("linux") and os.path.exists("/var/run"):
        return "/var/run/aegis.pid"
    return os.path.join(get_global_config_dir(), "daemon.pid")


def get_project_config_dir(project_root: Optional[str] = None) -> str:
    """Returns project .aegis directory."""
    root = project_root or find_project_root() or os.getcwd()
    return os.path.join(root, ".aegis")


def find_project_root(start_dir: Optional[str] = None) -> Optional[str]:
    """
    Finds the root directory of the current project by walking upward
    looking for indicators (.aegis, .git, package.json, requirements.txt, etc.).
    """
    curr = os.path.abspath(start_dir or os.getcwd())
    markers = [".aegis", ".git", "package.json", "requirements.txt", "pyproject.toml", "Cargo.toml", "go.mod"]
    
    while True:
        for marker in markers:
            if os.path.exists(os.path.join(curr, marker)):
                return curr
        parent = os.path.dirname(curr)
        if parent == curr:
            # Reached root filesystem
            break
        curr = parent
    return None
