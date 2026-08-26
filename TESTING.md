# 🧪 Aelfra Aegis — Complete Step-by-Step Testing & Industry Guide

Welcome to the **Aelfra Aegis** testing guide! This document provides clear, copy-pasteable instructions for **Windows (PowerShell / Command Prompt)** and **Linux / WSL2**, covering everything from 1-click in-browser simulations to real enterprise SIEM and CI/CD pipelines.

---

> [!NOTE]
> **Windows Note:** On Windows, always use `python` (do **NOT** use `python3` and do **NOT** use `sudo`). On Linux/WSL2, use `sudo python3`.

---

## 📑 Quick Navigation

- [Track 1: In-Browser / Zero-Setup Testing (Fastest — Any OS)](#-track-1-in-browser--zero-setup-testing-fastest--any-os)
- [Track 2: Local Windows Terminal Testing (4 Terminals)](#-track-2-local-windows-terminal-testing-4-terminals)
- [Track 3: Testing the 4 Industry Production Upgrades](#-track-3-testing-the-4-industry-production-upgrades)
  - [3.1: Autonomous Headless Auto-Block & Incident Reports](#31-test-autonomous-headless-mode-auto-kill--report)
  - [3.2: SIEM-Compatible JSONL Audit Logs](#32-test-siem-structured-logging)
  - [3.3: Grafana + Loki Enterprise Monitoring Stack](#33-test-grafana--loki-monitoring-stack)
  - [3.4: Standalone CLI Scanner & CI/CD Gate](#34-test-cli-scanner--cicd-gate)
- [Track 4: How Industry & DevSecOps Teams Use Aegis in Real Production](#-track-4-how-industry--devsecops-teams-use-aegis-in-real-production)
- [🛠️ Troubleshooting & Windows FAQs](#-troubleshooting--windows-faqs)

---

## 🌐 Track 1: In-Browser / Zero-Setup Testing (Fastest — Any OS)

*No Linux kernel or daemon installation required! Test all visual provenance graphs, threat narrations, and kill switches immediately.*

### Step 1: Open the Dashboard
- **Live Hosted App:** [**https://aelfra-aegis.vercel.app/**](https://aelfra-aegis.vercel.app/)
- **Or Run Locally on Windows:**
  ```powershell
  cd dashboard
  npm run dev
  ```
  Open **`http://localhost:3000`** in your browser.

### Step 2: Experience Onboarding & Enter Console
1. Step through the 5-slide interactive guided onboarding tour.
2. Enter your Agent Callsign (e.g. `Agent Umar`) and click **`INITIALIZE SESSION →`**.

### Step 3: Trigger Attack Scenarios with 1 Click
Click the white **`SIMULATE`** button in the top navigation bar:
- **Option 1: `Run Full Attack Chain`**
  - **T=0s**: Spawns `npm` node with yellow typosquatter alert badge.
  - **T=1.2s**: `node` process reads `.env`, turns crimson (`CRITICAL`), and opens animated red dash edge to `127.0.0.1:9999`.
  - **T=2.4s**: `bash` reverse shell node spawns from `node`.
  - **Threat Panel**: Behavioral intelligence updates in real time with AI narration.
  - **Risk Score Gauge**: Automatically jumps to `95/100 (HIGH RISK)`.
- **Option 2: `.env Credential Theft`** — Simulates isolated secret harvesting.
- **Option 3: `Reverse Shell Spawn`** — Simulates unauthorized child shell execution.

### Step 4: Test the Kill Switch & Report Export
1. On the compromised red `node` process node, click the red **`KILL [5820]`** button.
2. The node instantly turns gray with a **`TERMINATED ✓`** badge, and the killed counter increments.
3. Click the top-right **`REPORT`** button to download a self-contained HTML Incident Report.

---

## 💻 Track 2: Local Windows Terminal Testing (4 Terminals)

To test the complete local system on Windows, open **4 separate Windows Terminal (PowerShell or CMD) tabs** in your project root:

```text
Project Folder: C:\Users\DELL\OneDrive\Desktop\PROJECTS\Aelfra Aegis
```

---

### 🟢 Terminal 1: Start Mock C2 Exfiltration Listener
Simulates an external attacker Command & Control (C2) server waiting for stolen credentials.

```powershell
python simulator/listener.py
```
*Expected Output:*
```text
[LISTENER] C2 Exfiltration Listener active on http://0.0.0.0:9999
[LISTENER] Waiting for incoming POST requests...
```

---

### 🟢 Terminal 2: Start Aegis Security Daemon
Runs the daemon in Interactive Mode, establishing the WebSocket bridge on port `8765`.

```powershell
python daemon/daemon.py --mode=interactive
```
*(On Linux/WSL2, run: `sudo python3 daemon/daemon.py --mode=interactive`)*

*Expected Output:*
```text
[NOTICE] Running in Mock Event Mode (Windows environment).
[DAEMON] WebSocket server active on ws://0.0.0.0:8765
[POLICY ENGINE] Initialized with 4 active detection rules from config/rules.json
[STRUCTURED LOGGER] SIEM log stream initialized: data/audit/aegis-2026-08-26.jsonl
```

---

### 🟢 Terminal 3: Start Next.js React Flow Dashboard
Launches the frontend visualization console.

```powershell
cd dashboard
npm run dev
```
*Expected Output:*
```text
Ready in 1.5s - Local: http://localhost:3000
```
Open **`http://localhost:3000`** in your browser. The connection badge will display **`LIVE EBPF DAEMON CONNECTED`**.

---

### 🟢 Terminal 4: Trigger the Malicious Package Attack
Executes a simulated malicious package installation containing a postinstall credential stealer.

```powershell
cd simulator/target-app
npm install --foreground-scripts
```

*What Happens in Real-Time:*
1. **Terminal 4:** Prints `[AEGIS-SIMULATOR] postinstall script running... Found target secrets in ../../.env`.
2. **Terminal 1 (Listener):** Receives the stolen credentials: `[POST] Exfiltration received: AWS_SECRET_ACCESS_KEY=...`.
3. **Terminal 2 (Daemon):** Enriches the event, matches rule `CRED_001`, and streams JSON to WebSocket.
4. **Terminal 3 / Browser:** Instantly draws the process tree graph, alerts on `.env` read, and logs the event in the Live Event Stream!

---

## 🚀 Track 3: Testing the 4 Industry Production Upgrades

### 3.1: Test Autonomous Headless Mode (Auto-Kill & Report)
*Tests autonomous sub-50ms process termination with zero human intervention.*

1. In Terminal 2, start daemon in Headless Mode:
   ```powershell
   python daemon/daemon.py --mode=headless --threshold=90
   ```
2. In Terminal 4, run the attack:
   ```powershell
   cd simulator/target-app
   npm install --foreground-scripts
   ```
3. Check the generated incident report:
   ```powershell
   type data/incidents/*.json
   ```
   *Output shows structured incident with `action_taken: "SIGKILL"`, `rule_id: "CHAIN_001"`, and `confidence: 95%`.*

---

### 3.2: Test SIEM Structured Logging
*Verifies unbuffered, daily-rotated JSON Lines (JSONL) audit logs.*

Run the log verification tool in PowerShell:
```powershell
python scripts/verify-logs.py
```
*Expected Output:*
```text
[+] Parsing audit log: data/audit/aegis-2026-08-26.jsonl
[+] Total Lines Checked : 12
[+] Malformed Lines     : 0
[+] MITRE Techniques   : T1552.001 (Credential Access), T1059.004 (Execution)
[+] VERIFICATION STATUS: 100% SIEM-COMPLIANT JSONL
```

---

### 3.3: Test Grafana + Loki Monitoring Stack
*Tests the local enterprise telemetry and visual SIEM dashboards.*

1. Start Docker containers:
   ```powershell
   cd monitoring
   docker compose up -d
   ```
2. Start daemon with Loki shipping enabled:
   ```powershell
   $env:AEGIS_LOKI_URL="http://localhost:3100"; python daemon/daemon.py --mode=interactive
   ```
3. Open Grafana in your browser: **`http://localhost:3001`** (Anonymous Admin access is pre-configured).
4. View the 4 pre-built panels:
   - **Events Over Time** (Timeseries graph).
   - **Critical Events** (Tabular log feed).
   - **MITRE ATT&CK Techniques** (Bar chart breakdown).
   - **Recent Events** (Live LogQL query stream).

---

### 3.4: Test CLI Scanner & CI/CD Gate
*Tests automated dependency manifest scanning and CI gate enforcement.*

1. Run the standalone CLI scanner on clean dependencies:
   ```powershell
   python cli/aegis-scan.py package.json --dry-run
   ```
   *Expected: `✅ AEGIS SCAN COMPLETE — 0 threats detected`*

2. Run the CI Gate Test Suite (in Git Bash / WSL):
   ```bash
   bash tests/test_ci_gate.sh
   ```
   *Expected: `✅ AEGIS GATE TESTS ALL PASSED`*

---

## 🏢 Track 4: How Industry & DevSecOps Teams Use Aegis in Real Production

Aegis is deployed across **3 enterprise operational tiers**:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                 HOW ENTERPRISES USE AELFRA AEGIS                            │
├──────────────────────────┬──────────────────────────────────────────────────┤
│ Operational Tier         │ How Industry Teams Deploy & Use Aegis            │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ 1. DevSecOps CI/CD Gate  │ Added to GitHub Actions / GitLab CI pipelines.   │
│                          │ Runs in audit mode to block builds (exit 1) if   │
│                          │ dependencies contain malicious postinstall hooks.│
├──────────────────────────┼──────────────────────────────────────────────────┤
│ 2. SOC & Incident Triage │ Real-time visual monitoring via React Flow UI    │
│                          │ and SIEM ingestion (Splunk, Elastic, Loki) with  │
│                          │ MITRE ATT&CK taxonomy tags & AI narration.       │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ 3. Build Server / Runner │ Headless daemon on Kubernetes build runners      │
│    Autonomous Protection │ auto-killing malicious PIDs (< 50ms) to protect  │
│                          │ runner IAM credentials (AWS keys, npm tokens).   │
└──────────────────────────┴──────────────────────────────────────────────────┘
```

### 1. DevSecOps: Automated CI/CD Dependency Gate
- **Workflow File:** `.github/workflows/aegis-scan.yml`
- **How it Works:** Every pull request runs `cli/aegis-scan.py`. Dependencies are installed in an isolated container. If any package attempts to read `.env` or spawn a shell, Aegis catches the syscall, writes an incident report, and **fails the PR build (`exit 1`)**, preventing compromised code from reaching production.

### 2. SOC Teams: Visual Incident Triage & Forensic Audit
- **How it Works:** Instead of digging through thousands of raw log lines in Splunk, SOC analysts open the **React Flow Temporal Provenance Console** to visually inspect the exact parent-child process tree (`npm` &rarr; `node` &rarr; `bash` &rarr; `C2 Socket`).
- The **AI Threat Narrator** gives analysts an instant 3-sentence technical summary of the attack vector.

### 3. Cloud Infrastructure: Autonomous Host Defense
- **How it Works:** Aegis runs as a background service in `--mode=headless --threshold=90`. When an attack chain (`CHAIN_001`) is detected, Aegis terminates the malicious process in **under 50ms via `SIGKILL`**, protecting production build nodes without waiting for human intervention.

---

## 🛠️ Troubleshooting & Windows FAQs

#### Q1: Error: `Python was not found` or `python3: command not found`
- **Fix:** On Windows, run `python` instead of `python3`. If Python is still not found, make sure Python is added to your Windows PATH (or run `py simulator/listener.py`).

#### Q2: Error: `sudo: command not found`
- **Fix:** `sudo` only exists on Linux/macOS. On Windows PowerShell / CMD, run commands directly without `sudo` (e.g. `python daemon/daemon.py`).

#### Q3: The dashboard says `LIVE EBPF DAEMON OFFLINE`
- **Fix:** That is expected if the Python daemon is not running. You can click **`Try In-Browser Simulation`** or click **`SIMULATE`** to run in-browser attacks, OR run `python daemon/daemon.py --mode=interactive` in Terminal 2 to connect.

#### Q4: How do I test the Kill Switch on Windows?
- **Fix:** On Windows, the daemon runs in Mock Event Mode. Clicking **`KILL [PID]`** in the web dashboard sends a WebSocket command to the daemon, which verifies the signal and transitions the node to **`TERMINATED ✓`**.

---

*© 2026 Aelfra Aegis — Built with Precision by Umar Ahmed.*
