# CRED_THEFT — Credential Theft Attack Simulator

## What it simulates

A malicious npm `postinstall` script that reads sensitive credential files
(`~/.env`, `~/.aws/credentials`) and exfiltrates their contents via HTTP POST
to a remote C2 server.

## Attack behavior

1. Scans home directory and CWD for `.env` and `.aws/credentials` files
2. Reads file contents via `fs.readFileSync()`
3. POSTs stolen data as JSON to `localhost:9999/exfil`

## Syscall pattern (what Aegis detects)

- `openat` syscall with filename containing `.env` or `credentials`
- `connect` syscall to `localhost:9999`

## Real-world references

- **event-stream (2018)**: Malicious dependency `flatmap-stream` injected into
  event-stream v3.3.6. Targeted Bitcoin wallets via `copay-dash`.
- **ua-parser-js (2021)**: Compromised npm package with postinstall that
  installed a cryptominer and credential stealer on Linux/Windows.
- **coa/rc (2021)**: Popular packages hijacked to steal environment variables.

## Running

```bash
docker build -t aegis-cred-theft .
docker run --rm aegis-cred-theft
```
