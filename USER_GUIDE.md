# Aegis User Guide — Complete Feature Walkthrough

> **Prerequisites**: Ubuntu 22.04+ (kernel 5.15+), Docker, Node.js 20+, Python 3.11+, `sudo` access.
> On Windows/macOS the daemon runs in **Mock Mode** (simulated events) — all UI features are still fully testable.

---

## Starting the System

### Step 1 — Configure your environment

```bash
git clone https://github.com/mr-umar-ahmed/Aelfra-Aegis.git
cd Aelfra-Aegis
cp .env.example .env
nano .env   # Paste your ANTHROPIC_API_KEY and ABUSEIPDB_KEY
```

Your `.env` must contain:
```
ANTHROPIC_API_KEY=sk-ant-...
ABUSEIPDB_KEY=...
WEBSOCKET_PORT=8765
```

### Step 2 — Start the eBPF Daemon

```bash
# Linux (with real eBPF probes):
sudo python3 ebpf/daemon.py

# Windows / macOS (Mock Mode — simulated events):
python3 ebpf/daemon.py
```

You should see:
```
[DAEMON] WebSocket server active on ws://0.0.0.0:8765
```

### Step 3 — Start the Dashboard

In a new terminal:
```bash
cd dashboard
npm install   # first time only
npm run dev
```

Open `http://localhost:3000` in your browser.

### Step 4 — Verify Connection

In the top bar of the dashboard you should see a pulsing green dot labelled **MONITORING**. The live clock in the centre of the top bar will start ticking.

If you see **OFFLINE**, your daemon is not running. Check Step 2.

---

## Feature 1: Running Your First Attack (CRED_THEFT)

This simulates a malicious npm postinstall script that reads your `.env` credentials and attempts to exfiltrate them over HTTP.

```bash
# Build and run the attack container:
docker build -t aegis-cred simulator/attacks/cred-theft/
docker run --rm aegis-cred
```

Or use the convenience wrapper:
```bash
bash simulator/run-attack.sh cred-theft
```

**What to watch on the dashboard:**
1. Within 1–2 seconds, a new **process node** appears in the graph area labelled `node` or the relevant process name.
2. The node has a **CRED_THEFT** badge in Ocean Deep.
3. An `ALERT` banner appears at the top: *"Active credential theft detected"*.
4. In the Event Stream sidebar (right), new events scroll in with `file_open` type and a `.env` path.

---

## Feature 2: Attack Pattern Library — All 4 Attacks

### CRED_THEFT
**What it simulates**: Reads `~/.env` and `~/.aws/credentials`, then POSTs to an external server.
```bash
bash simulator/run-attack.sh cred-theft
```
**On screen**: `file_open` events with `.env` in filename, `CRED_THEFT` badge, network diamond node to `localhost:9999`.

### REVERSE_SHELL
**What it simulates**: Spawns a bash subprocess and attempts `nc -e /bin/bash localhost 4444`.
```bash
bash simulator/run-attack.sh reverse-shell
```
**On screen**: `exec_spawn` event, `REVERSE_SHELL` badge on the spawned process node.

### CRYPTOMINER
**What it simulates**: Forks 4 CPU-intensive worker processes, then connects to `stratum+tcp://pool.minexmr.com:4444`.
```bash
bash simulator/run-attack.sh cryptominer
```
**On screen**: Multiple child nodes spawned from one parent PID, `CRYPTOMINER` badge, diamond network node for port 4444.

### TYPOSQUATTER
**What it simulates**: A package named `lodsh` (1 edit distance from `lodash`) runs the same credential theft logic from its `postinstall`.
```bash
bash simulator/run-attack.sh typosquatter
```
**On screen**: `TYPOSQUATTER` badge, event stream shows edit-distance detection note.

---

## Feature 3: Network Exfiltration Map

When any attack makes an outbound TCP connection, a **diamond-shaped node** appears in the graph connected to the offending process node via a dashed animated edge.

**Reading the diamond node:**
- Label: `dest_ip:dest_port` (e.g. `45.14.224.197:4444`)
- If the edge is a dotted animated line → this is a network event
- If the node pulses with Siren Song colour → AbuseIPDB flagged this IP as malicious (score > 25)

**AbuseIPDB integration:**
The daemon automatically checks every non-private outbound IP against `api.abuseipdb.com`. Results are cached in-memory (LRU, max 200 entries) to avoid rate-limiting. Private ranges (`127.*`, `10.*`, `192.168.*`) are skipped.

---

## Feature 4: AI Threat Narration

After an attack chain closes (defined as: ≥1 file event **and** ≥1 exec event from the same PID within a 30-second window), the daemon sends the event list to the Anthropic Claude API.

**Where it appears**: The **Threat Intelligence** panel, below the process graph.

**How long to wait**: 30–45 seconds from the start of the attack (30s window + ~5s API call).

**If it doesn't appear:**
1. Check `ANTHROPIC_API_KEY` is set correctly in `.env`
2. Confirm the attack triggered both a `file_open` AND an `exec_spawn` event from the same PID
3. On Mock Mode, the mock sequence does include both event types — narration will still fire

**API cost note**: Each narration call uses ~400 tokens (300 max output + ~100 input). At Claude Sonnet pricing, this is approximately $0.002 per narration.

---

## Feature 5: The Kill Switch

**Step 1**: Identify a process node in the graph with a red/critical badge.

**Step 2**: Click the **KILL [PID]** button on the node.

**Step 3**: The daemon receives the WebSocket kill request and runs:
```python
os.kill(pid, signal.SIGKILL)
```

**Step 4**: The node updates to show a killed/dimmed state.

**What SIGKILL means**: Unlike SIGTERM (which can be caught and ignored), SIGKILL is sent directly by the kernel and cannot be intercepted by the target process. The process is immediately terminated with no cleanup.

**On Windows (Mock Mode)**: The kill request is sent but `os.kill` is skipped (guarded by `os.name != 'nt'`). You'll see the `kill_result` WebSocket response but no actual process termination.

---

## Feature 6: Risk Score Gauge

The SVG arc gauge in the left sidebar shows the current overall **Package Risk Score** (0–100), updated every 3 seconds by the daemon.

**Reading the gauge:**
| Score | Colour | Meaning |
|---|---|---|
| 0–30 | Siren Song (muted green) | Normal baseline activity |
| 31–60 | Big River (grey-green) | Elevated — investigate |
| 61–100 | Ocean Deep (dark teal) | High risk — likely attack |

**How scoring works**: The daemon compares live event counts (file opens, process spawns, network connections) against the median baseline values from `/baselines/baseline.json` (derived from 10 known-clean packages). Each threshold breach adds 30–40 points.

**Why CRYPTOMINER scores highest**: It triggers all three anomaly detectors simultaneously — excessive CPU (process spawns), file activity, and a network connection to a mining pool port.

---

## Feature 7: Timeline & History

**Switching tabs**: In the top bar, click **TIMELINE** (next to **GRAPH**).

**What each incident card shows**:
- Attack type badge (e.g. `CRED_THEFT`) — Ocean Deep background
- PID and timestamp
- Risk score at time of detection
- Status: `ACTIVE` (red) or `TERMINATED` (Siren Song, after kill switch used)

**Expanding a card**: Click any card to expand it inline. You'll see:
- The full AI threat narration (if narration was generated)
- A raw event ledger (timestamp, event type, filename/comm) in a monospace table

**Search/filter**: Use the search bar at the top of the Timeline tab to filter by attack type name or PID number.

**History after refresh**: When you press F5, the dashboard reconnects and immediately sends `{"action":"get_history","limit":50}` to the daemon. The daemon queries SQLite and pushes back the last 50 incidents — your timeline is always up to date.

---

## Feature 8: Exporting an Incident Report

**Step 1**: Click the **EXPORT REPORT** button in the top bar (right side, Siren Song background).

**Step 2**: Your browser downloads `aegis-report-[timestamp].html` to your Downloads folder.

**Step 3**: Open the file in any browser (no server needed — it's fully self-contained).

**What the HTML report contains**:
- **Header**: Aegis branding, generation timestamp
- **Risk Summary**: Total incidents, maximum risk score, count of active threats
- **Incident Table**: One row per incident with columns: Time, PID, Attack Type, Risk Score, Status
- **Narration rows**: If a narration was generated, it appears in an expanded row below the incident

**Sharing**: The HTML file has no external dependencies — you can email it directly or attach it to a ticket.

---

## Feature 9: CLI Scanner

The standalone CLI scanner wraps the full Aegis pipeline (Docker isolation + eBPF daemon) into a single command suitable for CI/CD pipelines.

```bash
# Basic scan:
python3 cli/aegis-scan.py path/to/package.json

# Dry-run (no Docker, no eBPF — just validate the manifest):
python3 cli/aegis-scan.py --dry-run path/to/package.json

# Help:
python3 cli/aegis-scan.py --help
```

**Understanding the output:**
```
✅ AEGIS SCAN COMPLETE — 0 threats detected (23 packages scanned)
```
or
```
❌ AEGIS SCAN BLOCKED — 2 threats detected:
   • lodsh: TYPOSQUATTER (edit distance check triggered)
   • xross-env: CRED_THEFT (confidence: 94%)
```

**Exit codes**: `0` = clean, `1` = threats detected, `2` = error (file not found, Docker not running)

**In CI**: The GitHub Action in `.github/workflows/aegis-scan.yml` runs this automatically on every push and pull request against the root `package.json`.

---

## Feature 10: Benchmark

The benchmark script measures the CPU overhead added by running Aegis alongside an `npm install`:

```bash
bash benchmarks/overhead.sh
```

**Reading the output:**
```
Metric               | Without Aegis | With Aegis
--------------------------------------------------
Time Taken           | 4.2s          | 4.4s
NPM CPU usage        | 8.3%          | 9.1%
```

**Numbers to cite in interviews**: Aegis adds approximately **0.8–1% CPU overhead** during package installation — negligible for any CI/CD pipeline. This is a direct result of the eBPF architecture: probes run inside the kernel using pre-verified bytecode, avoiding user-space context switches.

**Requirements**: `sysstat` package for `pidstat` (`sudo apt-get install sysstat`). Falls back to `ps`-based polling on systems without `pidstat`.

---

## The Full Demo Flow (3 Minutes)

This is the exact sequence to rehearse before a presentation. Practice until it takes under 3 minutes.

**Step 1 — Show the empty dashboard** *(15 seconds)*
> "This is Aegis — a real-time eBPF-based supply chain attack detector. The graph is empty because no packages have been installed yet. Notice the status dot is green — we're connected to the kernel-level sensor."

**Step 2 — Run CRED_THEFT in terminal** *(15 seconds)*
```bash
bash simulator/run-attack.sh cred-theft
```
> "I'm installing a malicious npm package. The postinstall script will try to read `.env` credentials and exfiltrate them."

**Step 3 — Point to graph nodes** *(30 seconds)*
> "Within one second, Aegis detected it. This node is the npm process. This node is the child process that opened `.env`. The dashed edge to that diamond node shows a network connection attempt to the exfiltration server. The badge says CRED_THEFT — that's our classifier identifying the attack family."

**Step 4 — Wait for narration** *(30 seconds)*
> "Aegis is now calling the Claude API to narrate what happened. In about 30 seconds..." [narration appears] "There it is — 3 sentences, technically accurate, written for a SOC analyst."

**Step 5 — Kill the process** *(20 seconds)*
> "The process is still running. I'll click Kill on the node." [click] "The daemon sent SIGKILL directly. The process is terminated. The node is now marked as killed."

**Step 6 — Switch to Timeline** *(20 seconds)*
> "I'll click the Timeline tab. This incident is now persisted in a local SQLite database. If I refresh the page, it will still be here — pulled from the database on reconnect. I can expand it to see the raw event ledger and the full narration."

**Step 7 — Export the report** *(20 seconds)*
> "Finally, I'll click Export Report." [file downloads] "This generates a fully self-contained HTML incident report — no external dependencies — that I can email to a security team or attach to a Jira ticket."

**Total time: approximately 3 minutes** ✅

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Status dot stays grey/CONNECTING | Daemon not running | Run `sudo python3 ebpf/daemon.py` |
| No events in graph after attack | BCC/eBPF not loaded | Check you used `sudo`; verify Linux kernel ≥ 5.15 |
| Narration never appears | API key invalid or 30s window not triggered | Check `ANTHROPIC_API_KEY` in `.env`; ensure attack has both file and exec events |
| Docker: permission denied | Not in docker group | Run `sudo usermod -aG docker $USER` then log out/in |
| `uname -r` shows 4.x kernel | Kernel too old for eBPF | Upgrade Ubuntu or use a VM |
| Kill switch has no effect | Process already exited | Expected — daemon logs the error, no crash |
| Timeline is empty after refresh | Daemon restarted fresh | History is per-daemon-session unless daemon writes to DB |
| Benchmark shows no CPU difference | `pidstat` not installed | `sudo apt-get install sysstat` |
| Graph not rendering | `@xyflow/react` CSS not loaded | Check `globals.css` imports `@xyflow/react/dist/style.css` |
