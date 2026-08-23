#!/usr/bin/env python3
"""
Aelfra Aegis Loki Log Shipper (Industry Upgrade 4)
Asynchronously streams SIEM events to Grafana Loki's HTTP Push API.
Non-blocking worker queue, zero external dependencies, and graceful fallback.
"""

import json
import os
import queue
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Optional


class LokiShipper:
    def __init__(self, loki_url: Optional[str] = None):
        if loki_url is None:
            loki_url = os.environ.get("AEGIS_LOKI_URL", "http://localhost:3100")

        self.loki_url = loki_url.strip() if loki_url else ""
        self.enabled = bool(self.loki_url)
        self.push_url = f"{self.loki_url.rstrip('/')}/loki/api/v1/push" if self.enabled else ""

        self._queue: queue.Queue = queue.Queue(maxsize=2000)
        self._warned_unreachable = False

        if self.enabled:
            self._worker_thread = threading.Thread(
                target=self._shipping_worker, daemon=True, name="AegisLokiShipper"
            )
            self._worker_thread.start()
            print(f"[LOKI SHIPPER] Initialized background shipper targeting {self.push_url}", flush=True)

    def ship(self, record: Dict[str, Any], custom_labels: Optional[Dict[str, str]] = None):
        """
        Enqueues a structured event record to be shipped asynchronously to Loki.
        """
        if not self.enabled:
            return

        ts_nano = str(int(time.time() * 1e9))
        payload_str = json.dumps(record, ensure_ascii=False)

        labels = {
            "job": "aegis",
            "severity": record.get("severity", "INFO"),
            "rule_id": record.get("rule_id", "GENERAL"),
            "mitre_technique": record.get("mitre_technique", "N/A"),
        }
        if custom_labels:
            labels.update(custom_labels)

        loki_payload = {
            "streams": [
                {
                    "stream": labels,
                    "values": [
                        [ts_nano, payload_str]
                    ],
                }
            ]
        }

        try:
            self._queue.put_nowait(loki_payload)
        except queue.Full:
            pass  # Avoid memory bloat if Loki is down for prolonged duration

    def _shipping_worker(self):
        """Background thread worker that POSTs log batches to Loki without blocking main event loops."""
        while True:
            try:
                payload = self._queue.get()
                data_bytes = json.dumps(payload).encode("utf-8")

                req = urllib.request.Request(
                    self.push_url,
                    data=data_bytes,
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "Aegis-Loki-Shipper/1.0",
                    },
                    method="POST",
                )

                try:
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        if resp.status in (200, 204):
                            self._warned_unreachable = False
                except (urllib.error.URLError, urllib.error.HTTPError, socket.error, Exception) as err:
                    if not self._warned_unreachable:
                        print(f"[LOKI SHIPPER WARNING] Loki endpoint unreachable at {self.push_url} ({err}). Logging will continue normally.", flush=True)
                        self._warned_unreachable = True

                self._queue.task_done()
            except Exception:
                time.sleep(0.5)
