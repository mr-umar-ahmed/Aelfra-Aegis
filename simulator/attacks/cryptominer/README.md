# CRYPTOMINER — Cryptominer Fork Bomb Simulator

## What it simulates

A malicious npm `postinstall` script that forks multiple child processes
to consume CPU resources (simulating mining), then connects to a mining
pool's stratum protocol endpoint.

## Attack behavior

1. Forks 4 child processes from the main Node.js process
2. Each child runs a tight CPU loop for 10 seconds (simulates hash computation)
3. Main process attempts TCP connection to `pool.minexmr.com:4444`
4. Connection will fail — no actual mining occurs

## Syscall pattern (what Aegis detects)

- 3+ `execve` syscalls from the same parent PID within a 2-second window
  (rapid process forking is the cryptominer signature)
- `connect` syscall to a known mining pool address

## Real-world references

- **eslint-scope (2018)**: Compromised to steal npm tokens, but same
  postinstall execution vector used by cryptominer packages.
- **colourama (2018)**: Typosquat of `colorama` that installed XMRig
  cryptominer via postinstall hook.
- **ua-parser-js (2021)**: Compromised with a cryptominer that targeted
  both Linux and Windows platforms.

## Running

```bash
docker build -t aegis-cryptominer .
docker run --rm aegis-cryptominer
```
