# TYPOSQUATTER — Typosquatting Attack Simulator

## What it simulates

A malicious npm package that intentionally mimics a popular library's name
(e.g., `lodsh` instead of `lodash`, `crossenv` instead of `cross-env`).
Once installed by mistake, its `postinstall` script performs malicious actions
like credential theft or backdooring.

## Attack behavior

1. Package named `lodsh` (typosquatting `lodash`)
2. Wait a small duration (simulating legitimate work)
3. Scans for `.env` and `.aws/credentials`
4. Exfiltrates data via POST to `localhost:9999/exfil`

## Syscall pattern (what Aegis detects)

- The syscall pattern is similar to `CRED_THEFT` (`openat` on `.env` + `connect`),
  but Aegis adds a layer of heuristic analysis:
- Daemon compares package name (`lodsh`) against a known top-100 npm package list using Levenshtein distance.
- Flags high risk if Levenshtein distance is 1 or 2 (e.g., `lodsh` vs `lodash`).

## Real-world references

- **crossenv (2017)**: Typosquat of `cross-env`. Stole environment variables
  and sent them to a remote server.
- **electorn (2018)**: Typosquat of `electron`.
- **bignum.js (2023)**: Typosquats of `bignumber.js` stealing crypto wallets.

## Running

```bash
docker build -t aegis-typosquatter .
docker run --rm aegis-typosquatter
```
