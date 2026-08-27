"""
Aelfra Aegis — aegis config command
Displays or modifies hierarchical configuration settings.
"""

import argparse
import json
import os
import sys
from typing import Optional

from aegis.core.config import AegisConfig
from aegis.core.paths import get_global_config_dir, get_project_config_dir, find_project_root


def run_config(args: Optional[argparse.Namespace] = None) -> int:
    config_mgr = AegisConfig()
    cfg = config_mgr.to_dict()

    project_root = find_project_root()
    global_dir = get_global_config_dir()
    project_dir = get_project_config_dir(project_root) if project_root else None

    print("════════════════════════════════════════════════════════════════")
    print("                 AELFRA AEGIS CONFIGURATION                     ")
    print("════════════════════════════════════════════════════════════════")
    print(f"• Global Config Directory  : {global_dir}")
    print(f"• Project Root             : {project_root or 'Not inside an initialized project'}")
    if project_dir:
        print(f"• Project Config Directory : {project_dir}")

    print("\n[ACTIVE MERGED CONFIGURATION]:")
    print(json.dumps(cfg, indent=2))
    print("════════════════════════════════════════════════════════════════\n")
    return 0
