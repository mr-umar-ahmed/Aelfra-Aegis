# Aegis Monitoring Stack (Grafana + Loki)

This directory provides a 100% free, local SIEM-compatible monitoring and log aggregation stack for Aelfra Aegis using Grafana and Loki.

---

## Architecture

```text
[eBPF Kernel Probes]
        ↓
[Aegis Python Daemon] 
        ↓ (HTTP POST /loki/api/v1/push)
   [Grafana Loki] (Port 3100)
        ↓ (Datasource)
  [Grafana Web UI] (Port 3001)
```

---

## Quick Start

### 1. Start Grafana & Loki via Docker Compose

```bash
cd monitoring
docker compose up -d
```

### 2. Run Aegis Daemon with Loki Shipping Enabled

```bash
# In interactive mode
AEGIS_LOKI_URL=http://localhost:3100 sudo python3 daemon/daemon.py --mode=interactive

# Or in autonomous headless mode
AEGIS_LOKI_URL=http://localhost:3100 sudo python3 daemon/daemon.py --mode=headless
```

### 3. Open Grafana Dashboard

Navigate to **[http://localhost:3001](http://localhost:3001)** in your browser.

- **Authentication**: Anonymous Admin access is pre-configured (no login or password needed).
- **Datasource**: Pre-configured to `http://loki:3100`.
- **Dashboard**: Pre-loaded under `Aegis -> Aelfra Aegis — SIEM Threat Dashboard`.

---

## Included Panels

1. **Events Over Time**: Timeseries volume graph categorized by severity.
2. **Critical Events**: Real-time table of `CRITICAL` supply chain incidents with JSON attributes.
3. **MITRE ATT&CK Techniques**: Bar chart aggregation across MITRE technique codes.
4. **Recent Events**: Live, interactive log stream viewer with search filtering.
