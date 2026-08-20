#!/usr/bin/env python3
"""
Aelfra Aegis eBPF Daemon Wrapper
"""
import os
import sys

# Import from main ebpf module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ebpf"))
import daemon

if __name__ == "__main__":
    daemon.main()
