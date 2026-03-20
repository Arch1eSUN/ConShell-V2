#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# ConShellV2 — Release Verification Script (Round 19.9 G6)
#
# Runs the minimum verification gates required before any
# round can be considered "complete". Exit code 0 = all pass.
# ═══════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  printf "  %-40s" "$label"
  if "$@" > /dev/null 2>&1; then
    echo "✅ PASS"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL"
    FAIL=$((FAIL + 1))
  fi
}

echo "╔═══════════════════════════════════════════════╗"
echo "║  ConShellV2 Release Verification              ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# ── Gate 1: Core tests ──
echo "Gate 1: Core Tests"
check "packages/core vitest" bash -c "cd '$ROOT/packages/core' && npx vitest run > /dev/null"

# ── Gate 2: Dashboard TypeScript ──
echo "Gate 2: Dashboard TypeScript"
check "packages/dashboard tsc --noEmit" bash -c "cd '$ROOT/packages/dashboard' && npx tsc --noEmit"

# ── Gate 3: Dashboard Build ──
echo "Gate 3: Dashboard Build"
check "packages/dashboard vite build" bash -c "cd '$ROOT/packages/dashboard' && npx vite build"

# ── Gate 4: No untyped posture fallbacks ──
echo "Gate 4: Code Quality"
check "No (as any).agenda patterns" bash -c "! grep -rn 'as any).agenda' '$ROOT/packages/dashboard/src/'"

# ── Gate 5: CLI TypeScript ──
echo "Gate 5: CLI TypeScript"
check "packages/cli tsc --noEmit" bash -c "cd '$ROOT/packages/cli' && npx tsc --noEmit"

echo ""
echo "───────────────────────────────────────────────"
echo "  Results: $PASS passed, $FAIL failed"
echo "───────────────────────────────────────────────"

if [ "$FAIL" -gt 0 ]; then
  echo "  ⛔ RELEASE BLOCKED — fix failures above"
  exit 1
else
  echo "  ✅ ALL GATES PASSED — ready to release"
  exit 0
fi
