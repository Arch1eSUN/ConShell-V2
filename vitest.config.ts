/**
 * Root vitest config — GUARD
 *
 * This config exists ONLY to prevent accidental `vitest run` from the repo root.
 * Running vitest from the root scans into numbered `node_modules 2/3/4` dirs
 * (created by macOS Finder copy operations) which contain duplicated test files,
 * producing ~355 test files / ~2971 tests instead of the real 34 / 507.
 *
 * CORRECT usage:
 *   cd packages/core && npx vitest run --no-coverage
 *
 * DO NOT USE:
 *   npx vitest run    (from repo root — contaminated)
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [],
    exclude: ['**'],
  },
});
