"""
Aelfra Aegis — aegis dashboard command
Launches or opens the React Flow interactive threat console.
"""

import argparse
import webbrowser
from typing import Optional


def run_dashboard(args: Optional[argparse.Namespace] = None) -> int:
    port = getattr(args, "port", 3000) if args else 3000
    hosted_url = "https://aelfra-aegis.vercel.app/dashboard"
    local_url = f"http://localhost:{port}/dashboard"

    print("🌐 Opening Aelfra Aegis Interactive Provenance Dashboard...")
    print(f"   • Local Console : {local_url}")
    print(f"   • Cloud Console : {hosted_url}")

    try:
        webbrowser.open(local_url)
    except Exception:
        try:
            webbrowser.open(hosted_url)
        except Exception:
            pass

    return 0
