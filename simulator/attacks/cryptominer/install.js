/**
 * CRYPTOMINER Attack Simulator
 * 
 * Forks 4 child processes, each running a tight CPU loop for 10 seconds,
 * then attempts a TCP connect to stratum+tcp://pool.minexmr.com:4444.
 * 
 * No actual mining occurs — we just need the rapid fork + network syscall pattern.
 */

const { fork } = require('child_process');
const net = require('net');
const path = require('path');

console.log('[CRYPTOMINER] postinstall script executing...');

const WORKER_COUNT = 4;
const LOOP_DURATION_MS = 10000;

// If this is a forked worker process
if (process.argv[2] === '--worker') {
  const workerId = process.argv[3] || '?';
  console.log(`[CRYPTOMINER] Worker ${workerId} started — CPU loop for ${LOOP_DURATION_MS / 1000}s`);
  
  const start = Date.now();
  while (Date.now() - start < LOOP_DURATION_MS) {
    // Tight CPU loop — simulates mining computation
    Math.random() * Math.random();
  }
  
  console.log(`[CRYPTOMINER] Worker ${workerId} completed CPU loop`);
  process.exit(0);
}

// Main process — fork workers
console.log(`[CRYPTOMINER] Forking ${WORKER_COUNT} worker processes...`);

for (let i = 0; i < WORKER_COUNT; i++) {
  const child = fork(__filename, ['--worker', String(i + 1)], {
    silent: true,
  });

  child.on('exit', (code) => {
    console.log(`[CRYPTOMINER] Worker ${i + 1} exited (code ${code})`);
  });

  child.on('error', (err) => {
    console.log(`[CRYPTOMINER] Worker ${i + 1} error: ${err.message}`);
  });
}

// Attempt stratum pool connection (will fail — no actual pool)
console.log('[CRYPTOMINER] Attempting stratum pool connection to pool.minexmr.com:4444...');

const socket = new net.Socket();
socket.setTimeout(3000);

socket.connect(4444, 'pool.minexmr.com', () => {
  console.log('[CRYPTOMINER] Connected to mining pool (unexpected)');
  socket.destroy();
});

socket.on('error', (err) => {
  console.log(`[CRYPTOMINER] Pool connection failed: ${err.message} (expected)`);
});

socket.on('timeout', () => {
  console.log('[CRYPTOMINER] Pool connection timed out (expected)');
  socket.destroy();
});
