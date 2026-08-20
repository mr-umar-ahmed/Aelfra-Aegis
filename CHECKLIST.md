# Aegis — Feature Test Checklist

Run through these in order for a complete verification pass.
For each test: ✅ = working correctly, ❌ = broken (note what happened)

---

## What You Must Provide Before Running Anything

### 2. Groq API Key (free — no credit card)
- Go to: https://console.groq.com
- Sign up with your Google account
- Click "API Keys" in the left sidebar
- Click "Create API Key" → give it any name → copy the key
- Paste into your .env file:  GROQ_API_KEY=your_key_here
- Free tier: 14,400 requests/day, 30 requests/minute
- For a demo session of 10 attacks: uses ~10 requests total

---

## 🔧 SETUP TESTS

- [ ] **T01 — Daemon starts without errors**
  - Command: `sudo python3 ebpf/daemon.py`
  - Expected: Banner prints, `[DAEMON] WebSocket server active on ws://0.0.0.0:8765` appears, no tracebacks
  - Note: On Windows/macOS, daemon auto-enables Mock Mode. BCC/eBPF requires Linux with kernel 5.15+.

- [ ] **T02 — Dashboard starts without errors**
  - Command: `cd dashboard && npm run dev`
  - Expected: Compiles successfully, `http://localhost:3000` loads

- [ ] **T03 — WebSocket connects**
  - Expected: Top-bar status dot turns Siren Song green and shows `MONITORING`

- [ ] **T04 — Page title is correct**
  - Expected: Browser tab shows `Aegis — Runtime Threat Monitor`

- [ ] **T05 — Empty state displays**
  - Expected: Graph area shows *"Monitoring active — no events detected"* in italic when connected but no events received yet

---

## 🎨 UI TESTS

- [ ] **T06 — Color palette is correct**
  - Check: Page background is Villa Nova (`#E2E0C8`) — not white, not dark
  - Check: Sidebar/nav is Ocean Deep (`#4E635E`)
  - Check: No pure black or pure white anywhere

- [ ] **T07 — Typography**
  - Check: `AEGIS` in sidebar is font-weight 800, large, Villa Nova text on Ocean Deep background
  - Check: Top-bar stat labels are UPPERCASE, small, letter-spaced

- [ ] **T08 — Top bar clock**
  - Expected: Shows current date and time (e.g. `8/20/2026, 11:41:00 PM`), updates every second

- [ ] **T09 — Favicon**
  - Expected: Browser tab shows a shield icon (Ocean Deep background, Siren Song shield)

---

## ⚔️ ATTACK SIMULATION TESTS

- [ ] **T10 — CRED_THEFT attack runs**
  - Command: `cd simulator/attacks/cred-theft && docker build -t aegis-cred . && docker run --rm aegis-cred`
  - Expected: Container runs and prints output showing it attempted to read `.env`

- [ ] **T11 — CRED_THEFT detected by daemon**
  - With daemon running in another terminal, run T10 again
  - Expected: Daemon terminal shows a JSON event with `event_type: "file_open"` and `filename` containing `.env`

- [ ] **T12 — CRED_THEFT appears in graph**
  - Expected: A node appears in the React Flow graph labelled with the process name
  - Expected: Node has `CRED_THEFT` badge

- [ ] **T13 — REVERSE_SHELL attack runs and is detected**
  - Command: `cd simulator/attacks/reverse-shell && docker build -t aegis-rs . && docker run --rm aegis-rs`
  - Expected: `exec_spawn` event appears, node badge shows `REVERSE_SHELL`

- [ ] **T14 — CRYPTOMINER attack runs and is detected**
  - Command: `cd simulator/attacks/cryptominer && docker build -t aegis-cm . && docker run --rm aegis-cm`
  - Expected: Multiple exec events from same PID, badge shows `CRYPTOMINER`

- [ ] **T15 — TYPOSQUATTER attack runs and is detected**
  - Command: `cd simulator/attacks/typosquatter && docker build -t aegis-ts . && docker run --rm aegis-ts`
  - Expected: Badge shows `TYPOSQUATTER`, small print shows edit distance note

- [ ] **T16 — run-attack.sh script works**
  - Command: `bash simulator/run-attack.sh cred-theft`
  - Also works with underscores: `bash simulator/run-attack.sh cred_theft`
  - Expected: Runs without "command not found", builds and starts the container

---

## 🌐 NETWORK DETECTION TESTS (Module B)

- [ ] **T17 — Network event appears for outbound connection**
  - Run any attack that makes a network call (CRED_THEFT or CRYPTOMINER)
  - Expected: Diamond-shaped node appears in graph alongside process nodes

- [ ] **T18 — AbuseIPDB lookup fires for non-private IPs**
  - Expected: Daemon logs `[AbuseIPDB Error]` if key missing, or a successful lookup response
  - Requires `ABUSEIPDB_KEY` set in `.env`

- [ ] **T19 — Threat flag on malicious IP**
  - If AbuseIPDB returns score > 25
  - Expected: Network node gets `threat: true`, severity upgrades to `critical`

---

## 🤖 AI NARRATION TESTS (Module E)

- [ ] **T20 — Narration appears after attack completes**
  - After running any attack: Expected: "Threat Intelligence" panel below graph shows a narration card within 30–45 seconds (30s chain window + API call)

- [ ] **T21 — Narration text is sensible**
  - Expected: 3 sentences, technical but readable, not generic filler

- [ ] **T22 — API failure degrades gracefully**
  - Temporarily set `GROQ_API_KEY=invalid` in `.env`, restart daemon, run an attack
  - Expected: Panel shows "Narration unavailable — Groq API call failed." — no crash

- [ ] **T23 — Restore real API key after T22**

---

## 🔪 KILL SWITCH TESTS

- [ ] **T24 — Kill button appears on threat node**
  - Expected: After a CRED_THEFT event, a `KILL [PID]` button appears on the graph node

- [ ] **T25 — Kill is sent via WebSocket**
  - Click the Kill button
  - Expected: Daemon terminal shows `[KILL SWITCH] Received request to kill PID [N]`

- [ ] **T26 — Node shows killed state**
  - Expected: Node updates to show `isKilled: true` state (visually dimmed/styled)

---

## 📊 RISK SCORE TESTS (Module C)

- [ ] **T27 — SVG gauge renders on dashboard**
  - Expected: Arc gauge visible in left sidebar with label `PACKAGE RISK`

- [ ] **T28 — Score updates after attack**
  - Expected: After any attack, score changes from 0 (emitted every 3 seconds by daemon)

- [ ] **T29 — Score range is correct**
  - Expected: Clean baseline = 0; after CRED_THEFT = 30+; after REVERSE_SHELL = 70+

---

## 🗄️ PERSISTENCE TESTS (Module G)

- [ ] **T30 — SQLite DB is created**
  - After first daemon startup:
  - Command: `ls -la data/`
  - Expected: `aegis.db` file exists

- [ ] **T31 — Events are persisted**
  - Command: `sqlite3 data/aegis.db "SELECT COUNT(*) FROM events;"`
  - Expected: Number increases after each attack run

- [ ] **T32 — Timeline tab shows history**
  - Click `TIMELINE` tab in dashboard
  - Expected: Past incidents are listed as cards

- [ ] **T33 — History survives dashboard refresh**
  - Refresh the browser (F5)
  - Expected: Timeline cards are still there (loaded from DB on reconnect via `get_history` WS action)

- [ ] **T34 — Export Report button works**
  - Click `EXPORT REPORT` in top bar
  - Expected: `aegis-report-[timestamp].html` downloads
  - Open the HTML file in browser
  - Expected: Renders with Aegis branding, risk summary, and incident table

---

## 🔧 CLI TESTS (Module D)

- [ ] **T35 — CLI help works**
  - Command: `python3 cli/aegis-scan.py --help`
  - Expected: Clean usage output showing `manifest` arg and `--dry-run` flag

- [ ] **T36 — CLI dry-run works**
  - Command: `python3 cli/aegis-scan.py --dry-run package.json`
  - Expected: Prints `[DRY RUN] Would scan N packages from package.json`, exits 0
  - Note: Docker must be installed even for dry-run (check is early)

- [ ] **T37 — CLI error on missing file**
  - Command: `python3 cli/aegis-scan.py nonexistent.json`
  - Expected: `❌ Error: File not found: .../nonexistent.json`, exits with code 2

---

## ⚡ PERFORMANCE TESTS

- [ ] **T38 — Benchmark script runs**
  - Command: `bash benchmarks/overhead.sh`
  - Expected: Prints before/after CPU comparison table

- [ ] **T39 — Overhead is reasonable**
  - Expected: "With Aegis" adds less than 5% CPU vs "Without Aegis"
  - Note: Requires Linux with `pidstat` installed (`sysstat` package)

---

## 📖 DOCUMENTATION TESTS

- [ ] **T40 — README renders on GitHub**
  - Open `https://github.com/mr-umar-ahmed/Aelfra-Aegis`
  - Expected: Mermaid diagram renders, tables are aligned, no broken markdown

- [ ] **T41 — .env.example is complete**
  - Command: `cat .env.example`
  - Expected: Shows all 3 keys: `GROQ_API_KEY`, `ABUSEIPDB_KEY`, `WEBSOCKET_PORT`
  - Expected: No real values — only placeholder text

- [ ] **T42 — .gitignore is working**
  - Command: `git status`
  - Expected: `.env` does NOT appear as untracked or modified

---

## 🧪 EDGE CASE TESTS

- [ ] **T43 — Dashboard handles daemon not running**
  - Stop the daemon, refresh the dashboard
  - Expected: Status dot shows `OFFLINE`, app does not crash or show white screen

- [ ] **T44 — Daemon handles rapid events**
  - Run 2 attacks simultaneously in separate terminals
  - Expected: Both appear in graph without events being dropped or mixed up

- [ ] **T45 — Kill switch on already-dead process**
  - Try clicking kill on a node from a previous session (PID already exited)
  - Expected: Daemon logs `[KILL SWITCH ERROR] [Errno 3] No such process` — no crash, error is caught and returned to client

---

## Final Pre-Demo Checklist

Run these 10 minutes before any demo or presentation:

- [ ] **D01** — Kill all running containers: `docker ps && docker stop $(docker ps -q)`
- [ ] **D02** — Delete old DB: `rm -f data/aegis.db`
- [ ] **D03** — Start daemon fresh: `sudo python3 ebpf/daemon.py`
- [ ] **D04** — Start dashboard: `cd dashboard && npm run dev`
- [ ] **D05** — Confirm status dot is green in browser
- [ ] **D06** — Open Timeline tab — confirm it is empty (fresh start)
- [ ] **D07** — Have `bash simulator/run-attack.sh cred-theft` typed but not entered
- [ ] **D08** — Screen recording software running (OBS or similar)
- [ ] **D09** — Browser zoom at 100%, full screen
- [ ] **D10** — Confirm terminal font is large enough to be visible on projector
