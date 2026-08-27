"""
Aelfra Aegis — aegis doctor command
Performs comprehensive environment capability detection and surfaces actionable diagnostic reports.
"""

import argparse
import sys
from typing import Optional

from aegis.core.doctor import run_doctor


def run_doctor_cmd(args: Optional[argparse.Namespace] = None) -> int:
    diag = run_doctor()

    print("════════════════════════════════════════════════════════════════")
    print("               AELFRA AEGIS SYSTEM DIAGNOSTICS                  ")
    print("════════════════════════════════════════════════════════════════")

    # 1. Environment & Kernel
    print(f"\n[1/4] Operating System & Environment:")
    print(f"   • OS Platform      : {diag['os']} ({diag['arch']})")
    print(f"   • Kernel Version   : {diag['kernel']}")
    print(f"   • Python Runtime   : Python {diag['python_version']}")

    # 2. Kernel Telemetry & Instrumentation Capabilities
    print(f"\n[2/4] Kernel & OS Telemetry Capabilities:")
    telemetry = diag.get("telemetry", {})
    selected_backend = telemetry.get("selected_backend", "Unknown")
    active_info = telemetry.get("active", {})

    print(f"   • Active Backend   : ✅ {selected_backend}")
    print(f"   • Backend Status   : {'✅ ACTIVE' if active_info.get('available') else '⚠️ DEGRADED'}")

    if diag["is_root"]:
        print("   • Process Privilege: ✅ Root / Elevated (Capable of live kernel probe attachment)")
    elif active_info.get("is_admin"):
        print("   • Process Privilege: ✅ Administrator (Full Windows telemetry access)")
    else:
        if diag["os"] == "Linux":
            print("   • Process Privilege: ⚠️ Non-Root (Run with sudo for live kernel interception)")
        elif diag["os"] == "Windows":
            print("   • Process Privilege: ℹ️ Standard User (Win32 Process & Socket Telemetry Active)")
        else:
            print("   • Process Privilege: ℹ️ Standard User (Mock Mode)")

    if diag["os"] == "Linux":
        if diag["btf_available"]:
            print("   • Kernel BTF       : ✅ Detected (/sys/kernel/btf/vmlinux exists for CO-RE)")
        else:
            print("   • Kernel BTF       : ⚠️ Not Available (Linux 5.15+ BTF recommended for CO-RE)")

        if diag["bcc_available"]:
            print("   • BCC Toolchain    : ✅ Installed (BCC BPF Python module importable)")
        else:
            print("   • BCC Toolchain    : ⚠️ Not Installed (Required on Linux for live kernel probes)")

    # 3. Containerization & Telemetry Daemon
    print(f"\n[3/4] Containerization & Telemetry:")
    docker = diag["docker"]
    if docker["installed"] and docker["running"]:
        print(f"   • Docker Engine    : ✅ Active (v{docker['version']}) — Isolated scanner ready")
    elif docker["installed"] and not docker["running"]:
        print("   • Docker Engine    : ⚠️ Installed but daemon is not running")
    else:
        print("   • Docker Engine    : ⚠️ Not Installed (Install Docker for containerized scanning)")

    daemon = diag["daemon"]
    if daemon["running"]:
        print(f"   • Aegis Daemon     : ✅ Running (PID: {daemon['pid']})")
    else:
        print("   • Aegis Daemon     : ⚪ Inactive (Run 'aegis start' to activate)")

    # 4. Final Capability Status Assessment
    print(f"\n[4/4] Capability Assessment:")
    cap = diag["capability"]
    if cap == "READY":
        print(f"   🎉 STATUS: READY — {diag['mode_desc']}")
    elif cap == "LIMITED":
        print(f"   ℹ️  STATUS: LIMITED — {diag['mode_desc']}")
    elif cap == "MOCK":
        print(f"   ℹ️  STATUS: MOCK — {diag['mode_desc']}")
    else:
        print(f"   ❌ STATUS: MISCONFIGURED — {diag['mode_desc']}")

    print("════════════════════════════════════════════════════════════════\n")
    return 0
