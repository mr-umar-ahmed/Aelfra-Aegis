"""
Aelfra Aegis — Policy Rule Engine
Evaluates declarative JSON security policies, hot-reloading rules, single-event conditions,
and multi-stage temporal chain correlation (e.g. CRED_001 -> NET_001 -> CHAIN_001).
"""

import ipaddress
import json
import os
import threading
import time
from typing import Any, Dict, List, Optional

from aegis.core.paths import get_package_asset_path


class RuleEngine:
    def __init__(self, rules_path: Optional[str] = None, custom_rules: Optional[List[Dict[str, Any]]] = None):
        self.rules_path = os.path.abspath(rules_path or get_package_asset_path("rules.json"))
        self.custom_rules = custom_rules or []
        self.rules: List[Dict[str, Any]] = []
        self.rules_by_id: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self.last_mtime: float = 0.0

        self.load_rules()

        # Start hot-reload watchdog thread (checks mtime every 5s if rules_path is a real file)
        self._watchdog_thread = threading.Thread(
            target=self._watchdog_loop, daemon=True, name="AegisRuleWatchdog"
        )
        self._watchdog_thread.start()

    def load_rules(self) -> bool:
        """Loads and parses detection rules from the JSON configuration file + custom rules."""
        parsed_rules = []
        version = "1.0"

        if os.path.exists(self.rules_path):
            try:
                mtime = os.stat(self.rules_path).st_mtime
                with open(self.rules_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                parsed_rules.extend(data.get("rules", []))
                version = data.get("version", "1.0")
                self.last_mtime = mtime
            except Exception as e:
                print(f"[RULE_ENGINE ERROR] Failed to parse rules from {self.rules_path}: {e}", flush=True)

        # Merge custom project-level rules
        if self.custom_rules:
            parsed_rules.extend(self.custom_rules)

        with self._lock:
            self.rules = parsed_rules
            self.rules_by_id = {r["id"]: r for r in parsed_rules if "id" in r}

        print(
            f"[RULE_ENGINE] Successfully loaded {len(parsed_rules)} detection rules (v{version})",
            flush=True,
        )
        return True

    def _watchdog_loop(self):
        """Watches rules_path for modifications and reloads automatically without restart."""
        while True:
            time.sleep(5)
            try:
                if os.path.exists(self.rules_path):
                    current_mtime = os.stat(self.rules_path).st_mtime
                    if current_mtime != self.last_mtime:
                        print("[RULE_ENGINE] Modification detected in rules file — hot-reloading rules...", flush=True)
                        self.load_rules()
            except Exception as e:
                print(f"[RULE_ENGINE WATCHDOG ERROR] {e}", flush=True)

    def _event_type_matches(self, rule_type: str, event_type: str) -> bool:
        """Normalizes and matches rule event types with kernel event types."""
        norm_rule = rule_type.lower()
        norm_event = event_type.lower()

        if norm_rule == "file" and norm_event in ("file", "file_open", "openat"):
            return True
        if norm_rule == "exec" and norm_event in ("exec", "exec_spawn", "execve"):
            return True
        if norm_rule == "network" and norm_event in ("network", "tcp_connect", "connect"):
            return True
        return norm_rule == norm_event

    def _check_conditions(self, event: Dict[str, Any], conditions: Dict[str, Any]) -> bool:
        """
        Evaluates conditions against a single event dictionary.
        Returns True only if all defined condition checks pass (AND logic).
        """
        if not conditions:
            return True

        # 1. fname_contains_any: substring check on filename or detail
        if "fname_contains_any" in conditions:
            target_str = (event.get("filename") or event.get("detail") or "").lower()
            substrings = [s.lower() for s in conditions["fname_contains_any"]]
            if not any(sub in target_str for sub in substrings):
                return False

        # 2. comm_not_in: excludes whitelisted safe administrative commands
        if "comm_not_in" in conditions:
            comm = (event.get("comm") or "").lower()
            excluded_comms = [c.lower() for c in conditions["comm_not_in"]]
            if comm in excluded_comms:
                return False

        # 3. parent_comm_in: checks if process was spawned by package manager / runner
        if "parent_comm_in" in conditions:
            parent_comm = (event.get("parent_comm") or "").lower()
            allowed_parents = [p.lower() for p in conditions["parent_comm_in"]]
            if parent_comm:
                if parent_comm not in allowed_parents:
                    return False
            else:
                comm = (event.get("comm") or "").lower()
                if comm not in allowed_parents and event.get("ppid", 0) <= 0:
                    return False

        # 4. exclude_private_ips: skips RFC1918 private / loopback IP addresses
        if conditions.get("exclude_private_ips", False):
            dest_ip = event.get("dest_ip", "")
            if not dest_ip:
                return False
            try:
                ip_obj = ipaddress.ip_address(dest_ip)
                if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_reserved:
                    return False
            except ValueError:
                if dest_ip.startswith(("127.", "10.", "192.168.", "172.", "localhost", "0.0.0.0", "::1")):
                    return False

        # 5. dest_port_not_in: checks for non-standard egress ports
        if "dest_port_not_in" in conditions:
            dest_port = event.get("dest_port", 0)
            excluded_ports = conditions["dest_port_not_in"]
            if dest_port in excluded_ports:
                return False

        return True

    def evaluate_event(self, event: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Evaluates an individual kernel event against all loaded non-chain rules.
        """
        matched = []
        event_type = event.get("event_type", "")

        with self._lock:
            active_rules = list(self.rules)

        for rule in active_rules:
            if rule.get("event_type") == "chain":
                continue

            if not self._event_type_matches(rule.get("event_type", ""), event_type):
                continue

            if self._check_conditions(event, rule.get("conditions", {})):
                match_result = {
                    "matched": True,
                    "rule_id": rule.get("id"),
                    "rule_name": rule.get("name"),
                    "description": rule.get("description"),
                    "severity": rule.get("severity", "MEDIUM"),
                    "mitre_technique": rule.get("mitre_technique", "UNKNOWN"),
                    "action": rule.get("action", "alert"),
                    "confidence": rule.get("confidence", 80),
                }
                matched.append(match_result)

        return matched

    def evaluate_chain(self, pid_events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Evaluates temporal multi-stage attack chains for a specific process (PID)
        over the recorded event history.
        """
        if not pid_events:
            return []

        matched_chains = []
        with self._lock:
            chain_rules = [r for r in self.rules if r.get("event_type") == "chain"]

        event_rule_map: List[tuple[float, List[str]]] = []
        for evt in pid_events:
            ts_str = evt.get("timestamp", "")
            try:
                import datetime
                dt = datetime.datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                ts_val = dt.timestamp()
            except Exception:
                ts_val = time.time()

            single_matches = self.evaluate_event(evt)
            rule_ids = [m["rule_id"] for m in single_matches]
            event_rule_map.append((ts_val, rule_ids))

        all_triggered_ids = set()
        for _, r_ids in event_rule_map:
            all_triggered_ids.update(r_ids)

        for chain_rule in chain_rules:
            conditions = chain_rule.get("conditions", {})
            required_sequence = conditions.get("requires_sequence", [])
            within_seconds = conditions.get("within_seconds", 30)

            if not required_sequence:
                continue

            if not all(req_id in all_triggered_ids for req_id in required_sequence):
                continue

            timestamps = []
            found_sequence = True
            current_time = 0.0

            for req_id in required_sequence:
                matching_times = [
                    t for t, r_ids in event_rule_map if req_id in r_ids and t >= current_time
                ]
                if not matching_times:
                    found_sequence = False
                    break
                next_time = matching_times[0]
                timestamps.append(next_time)
                current_time = next_time

            if found_sequence and len(timestamps) >= 2:
                time_span = max(timestamps) - min(timestamps)
                if time_span <= within_seconds:
                    match_result = {
                        "matched": True,
                        "rule_id": chain_rule.get("id"),
                        "rule_name": chain_rule.get("name"),
                        "description": chain_rule.get("description"),
                        "severity": chain_rule.get("severity", "CRITICAL"),
                        "mitre_technique": chain_rule.get("mitre_technique", "T1020"),
                        "action": chain_rule.get("action", "kill"),
                        "confidence": chain_rule.get("confidence", 97),
                        "time_span_seconds": round(time_span, 2),
                    }
                    matched_chains.append(match_result)

        return matched_chains
