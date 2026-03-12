#!/bin/bash
set -e
# Sync source to /tmp build area
rsync -a --delete --exclude node_modules --exclude dist --exclude .git \
  /Users/archiesun/Desktop/ConShellV2/ /tmp/conshell-v2-test/
cd /tmp/conshell-v2-test
pnpm install --no-frozen-lockfile --store-dir /tmp/pnpm-store 2>/dev/null
pnpm exec vitest run "$@"
