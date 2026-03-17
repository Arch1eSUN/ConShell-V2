#!/usr/bin/env bash
# Canonical verification script for ConShell economic subsystem tests
# Usage: ./scripts/verify-economic.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CORE_DIR="$ROOT_DIR/packages/core"

echo "═══ ConShell Economic Verification ═══"
echo "Working directory: $CORE_DIR"
echo ""

cd "$CORE_DIR"

# Run all economic tests
exec npx vitest run src/economic/ "$@"
