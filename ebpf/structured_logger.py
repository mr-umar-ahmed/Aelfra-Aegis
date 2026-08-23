#!/usr/bin/env python3
"""
Forwarding alias for daemon.structured_logger
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "daemon"))
from structured_logger import StructuredLogger, MITRE_TACTICS

__all__ = ["StructuredLogger", "MITRE_TACTICS"]
