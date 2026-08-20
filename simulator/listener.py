#!/usr/bin/env python3
"""
Aelfra Aegis Exfiltration Listener
Simulates an attacker's C2 endpoint on port 9999.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import sys

PORT = 9999

class ExfilHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        print("\n" + "=" * 60, flush=True)
        print(f"[LISTENER] EXFILTRATION DETECTED from {self.client_address[0]}:{self.client_address[1]}", flush=True)
        print(f"[LISTENER] Path: {self.path}", flush=True)
        print("-" * 60, flush=True)
        
        try:
            parsed = json.loads(post_data.decode('utf-8'))
            print(json.dumps(parsed, indent=2), flush=True)
        except Exception:
            print(post_data.decode('utf-8', errors='replace'), flush=True)
            
        print("=" * 60 + "\n", flush=True)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"status":"exfil_received"}')

    def log_message(self, format, *args):
        # Suppress standard http server access logs for cleaner output
        pass

def main():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, ExfilHandler)
    print(f"[LISTENER] C2 Exfiltration Listener active on http://0.0.0.0:{PORT}", flush=True)
    print("[LISTENER] Waiting for incoming POST requests...", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[LISTENER] Shutting down listener.", flush=True)
        sys.exit(0)

if __name__ == '__main__':
    main()
