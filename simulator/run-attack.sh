#!/bin/bash
# Aegis Attack Simulator Runner
# Usage: ./simulator/run-attack.sh <attack-name>
# Attack names: cred-theft | reverse-shell | cryptominer | typosquatter
# Alias names also accepted: cred_theft | reverse_shell | cryptominer | typosquatter

set -e

ATTACK_NAME="${1:-}"

# Normalise underscores to hyphens (e.g. cred_theft -> cred-theft)
ATTACK_NAME="${ATTACK_NAME//_/-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ATTACKS_DIR="$SCRIPT_DIR/attacks"

VALID_ATTACKS=("cred-theft" "reverse-shell" "cryptominer" "typosquatter")

if [ -z "$ATTACK_NAME" ]; then
    echo "Usage: $0 <attack-name>"
    echo "Available attacks: ${VALID_ATTACKS[*]}"
    exit 1
fi

VALID=false
for a in "${VALID_ATTACKS[@]}"; do
    if [ "$a" == "$ATTACK_NAME" ]; then
        VALID=true
        break
    fi
done

if [ "$VALID" = false ]; then
    echo "❌ Unknown attack: '$ATTACK_NAME'"
    echo "   Valid options: ${VALID_ATTACKS[*]}"
    exit 1
fi

ATTACK_DIR="$ATTACKS_DIR/$ATTACK_NAME"
IMAGE_NAME="aegis-$ATTACK_NAME"

if [ ! -d "$ATTACK_DIR" ]; then
    echo "❌ Attack directory not found: $ATTACK_DIR"
    exit 1
fi

echo "════════════════════════════════════════"
echo "  AEGIS ATTACK SIMULATOR — $ATTACK_NAME"
echo "════════════════════════════════════════"
echo ""
echo "▶  Building Docker image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" "$ATTACK_DIR"

echo ""
echo "▶  Running attack container..."
echo "   (eBPF daemon should be running in another terminal)"
echo ""
docker run --rm "$IMAGE_NAME"

echo ""
echo "✅ Attack container finished. Check Aegis dashboard for detected events."
