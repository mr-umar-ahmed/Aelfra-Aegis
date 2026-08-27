"""
Aelfra Aegis — aegis init command
Initializes minimal project-level security metadata (.aegis/config.json) without copying source trees.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional

from aegis.core.paths import get_project_config_dir
from aegis.core.config import AegisConfig


def detect_project_type(project_root: str) -> str:
    """Detects ecosystem from manifest files in the project root."""
    if os.path.exists(os.path.join(project_root, "package.json")):
        return "Node.js / npm"
    if os.path.exists(os.path.join(project_root, "requirements.txt")) or os.path.exists(os.path.join(project_root, "pyproject.toml")):
        return "Python / pip"
    if os.path.exists(os.path.join(project_root, "Cargo.toml")):
        return "Rust / Cargo"
    if os.path.exists(os.path.join(project_root, "go.mod")):
        return "Go"
    if os.path.exists(os.path.join(project_root, "pom.xml")) or os.path.exists(os.path.join(project_root, "build.gradle")):
        return "Java"
    return "Generic"


def run_init(args: Optional[argparse.Namespace] = None) -> int:
    project_root = os.path.abspath(os.getcwd())
    project_name = os.path.basename(project_root)
    project_type = detect_project_type(project_root)

    proj_dir = get_project_config_dir(project_root)
    config_file = os.path.join(proj_dir, "config.json")

    print(f"🛡️  AELFRA AEGIS — Initializing Project Defense in {project_name}/...")

    if os.path.exists(config_file):
        print(f"ℹ️  Project is already initialized with Aegis at {config_file}")
        print("   Existing security configurations preserved (idempotent).")
        return 0

    mode = getattr(args, "mode", "interactive") if args else "interactive"
    threshold = getattr(args, "threshold", 90) if args else 90

    AegisConfig.create_project_config(
        project_root=project_root,
        project_name=project_name,
        mode=mode,
        threshold=threshold,
    )

    print(f"✅ Initialized Aegis security configuration at {config_file}")
    print(f"   • Project Type      : {project_type}")
    print(f"   • Default Mode      : {mode}")
    print(f"   • Auto-Kill Barrier : {threshold}%")
    print(f"   • Global Engine     : Ready (Zero source tree duplication)")
    print("\n💡 Quick Start Next Steps:")
    print("   1. Check system diagnostics : aegis doctor")
    print("   2. Run protected commands   : aegis protect npm install (or pip install)")
    print("   3. Scan dependency manifest : aegis scan")
    print("   4. View security status     : aegis status")

    return 0
