"""
Aelfra Aegis — Hierarchical Configuration Manager
Supports 4-tier precedence: Defaults -> Global Config -> Project Config -> CLI Overrides.
"""

import json
import os
from typing import Any, Dict, Optional

from aegis.core.paths import get_global_config_dir, get_project_config_dir, find_project_root

DEFAULT_CONFIG: Dict[str, Any] = {
    "version": "1.0",
    "project_name": "default",
    "mode": "interactive",  # interactive | headless | audit
    "threshold": 90,  # 0-100 auto-kill threshold
    "ws_host": "0.0.0.0",
    "ws_port": 8765,
    "loki_url": "http://localhost:3100",
    "enable_loki": True,
    "rules_file": None,
    "custom_rules": [],
    "allowed_commands": ["vim", "cat", "nano", "grep", "less"],
    "allowed_egress_ports": [80, 443, 8080],
    "log_level": "INFO",
}


class AegisConfig:
    def __init__(
        self,
        project_root: Optional[str] = None,
        cli_overrides: Optional[Dict[str, Any]] = None,
    ):
        self.project_root = project_root or find_project_root()
        self.cli_overrides = cli_overrides or {}
        self.config: Dict[str, Any] = {}
        self.reload()

    def reload(self) -> Dict[str, Any]:
        """Loads and merges configuration across all 4 tiers."""
        merged = DEFAULT_CONFIG.copy()

        # 1. Load Global Config (~/.aegis/config.json)
        global_file = os.path.join(get_global_config_dir(), "config.json")
        if os.path.exists(global_file):
            try:
                with open(global_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        merged.update(data)
            except Exception:
                pass

        # 2. Load Project Config (<project_root>/.aegis/config.json)
        if self.project_root:
            project_file = os.path.join(get_project_config_dir(self.project_root), "config.json")
            if os.path.exists(project_file):
                try:
                    with open(project_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, dict):
                            merged.update(data)
                except Exception:
                    pass

        # 3. Environment Variables (e.g. AEGIS_MODE, AEGIS_THRESHOLD, AEGIS_LOKI_URL)
        if "AEGIS_MODE" in os.environ:
            merged["mode"] = os.environ["AEGIS_MODE"]
        if "AEGIS_AUTO_KILL_THRESHOLD" in os.environ:
            try:
                merged["threshold"] = int(os.environ["AEGIS_AUTO_KILL_THRESHOLD"])
            except ValueError:
                pass
        if "AEGIS_LOKI_URL" in os.environ:
            merged["loki_url"] = os.environ["AEGIS_LOKI_URL"]

        # 4. CLI Overrides
        for k, v in self.cli_overrides.items():
            if v is not None:
                merged[k] = v

        self.config = merged
        return self.config

    def get(self, key: str, default: Any = None) -> Any:
        return self.config.get(key, default)

    def to_dict(self) -> Dict[str, Any]:
        return self.config.copy()

    @staticmethod
    def create_project_config(
        project_root: str,
        project_name: str,
        mode: str = "interactive",
        threshold: int = 90,
    ) -> str:
        """Creates a minimal project-level .aegis/config.json."""
        proj_dir = get_project_config_dir(project_root)
        os.makedirs(proj_dir, exist_ok=True)
        config_path = os.path.join(proj_dir, "config.json")

        if os.path.exists(config_path):
            return config_path  # Idempotent: do not overwrite existing user settings

        content = {
            "version": "1.0",
            "project_name": project_name,
            "mode": mode,
            "threshold": threshold,
            "custom_rules": [],
            "allowed_commands": ["vim", "cat", "nano", "grep", "less"],
        }

        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(content, f, indent=2)

        return config_path
