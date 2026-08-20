import type { IncidentData } from "./types";

export function exportReportToHTML(incidents: IncidentData[]) {
  const currentTimestamp = new Date().toISOString();
  
  const rows = incidents.map(inc => `
    <tr>
      <td>${new Date(inc.start_time).toLocaleString()}</td>
      <td>${inc.pid}</td>
      <td><span class="badge ${inc.attack_type.toLowerCase()}">${inc.attack_type}</span></td>
      <td><strong>${inc.risk_score}</strong></td>
      <td>
        <span class="status ${inc.status === 'terminated' ? 'terminated' : 'active'}">
          ${inc.status.toUpperCase()}
        </span>
      </td>
    </tr>
    ${inc.narration_text ? `
    <tr class="narration-row">
      <td colspan="5">
        <div class="narration-box">
          <strong>Threat Narrative:</strong> ${inc.narration_text}
        </div>
      </td>
    </tr>` : ''}
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Aegis Incident Report</title>
    <style>
        :root {
          --ocean: #4E635E;
          --villa: #E2E0C8;
          --siren: #A6B49E;
          --river: #818C78;
        }
        body {
            font-family: 'Inter', -apple-system, sans-serif;
            background-color: var(--villa);
            color: var(--ocean);
            margin: 0;
            padding: 40px;
        }
        .report-container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            border: 1px solid var(--river);
        }
        header {
            border-bottom: 2px solid var(--ocean);
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        h1 { margin: 0; font-size: 28px; letter-spacing: -0.5px; }
        p { color: var(--river); font-size: 14px; }
        h2 { font-size: 18px; margin-top: 30px; color: var(--ocean); border-bottom: 1px solid var(--siren); padding-bottom: 8px; }
        
        .summary-box {
            background: var(--ocean);
            color: var(--villa);
            padding: 20px;
            border-radius: 6px;
            display: flex;
            gap: 40px;
        }
        .summary-stat {
            display: flex;
            flex-direction: column;
        }
        .summary-stat .val { font-size: 32px; font-weight: 800; }
        .summary-stat .lbl { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--siren); }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 14px;
        }
        th, td {
            text-align: left;
            padding: 12px 16px;
            border-bottom: 1px solid var(--siren);
        }
        th {
            background-color: var(--ocean);
            color: var(--villa);
            font-weight: 600;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 0.5px;
        }
        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            background: var(--ocean);
            color: var(--villa);
        }
        .status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
        }
        .status.terminated { background: var(--siren); color: var(--ocean); }
        .status.active { background: #fee2e2; color: #991b1b; }
        
        .narration-row td {
            border-bottom: 2px solid var(--ocean);
            padding: 0 16px 16px 16px;
            background: #fafafa;
        }
        .narration-box {
            background: var(--villa);
            padding: 12px;
            border-left: 4px solid var(--ocean);
            border-radius: 0 4px 4px 0;
            font-size: 13px;
            color: var(--ocean);
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="report-container">
        <header>
            <h1>AEGIS SECURITY REPORT</h1>
            <p>Generated: ${currentTimestamp}</p>
        </header>
        
        <section class="summary">
            <h2>Risk Summary</h2>
            <div class="summary-box">
                <div class="summary-stat">
                    <span class="val">${incidents.length}</span>
                    <span class="lbl">Total Incidents</span>
                </div>
                <div class="summary-stat">
                    <span class="val">${Math.max(...incidents.map(i => i.risk_score), 0)}</span>
                    <span class="lbl">Max Risk Score</span>
                </div>
                <div class="summary-stat">
                    <span class="val">${incidents.filter(i => i.status === 'active').length}</span>
                    <span class="lbl">Active Threats</span>
                </div>
            </div>
        </section>

        <section class="incident-list">
            <h2>Incident Details</h2>
            <table>
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>PID</th>
                        <th>Attack Type</th>
                        <th>Risk Score</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="5">No incidents recorded.</td></tr>'}
                </tbody>
            </table>
        </section>
    </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aegis-report-${new Date().getTime()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
