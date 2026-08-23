#!/usr/bin/env python3
"""
Forwarding wrapper / module alias for daemon.rule_engine
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "daemon"))
from rule_engine import RuleEngine

__all__ = ["RuleEngine"]
