#!/usr/bin/env python3
"""
Forwarding alias for daemon.loki_shipper
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "daemon"))
from loki_shipper import LokiShipper

__all__ = ["LokiShipper"]
