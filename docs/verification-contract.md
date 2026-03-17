# ConShell V2 — Verification Contract

> Canonical reference for test execution paths and terminology.

## Canonical Working Directory

All `packages/core` tests **must** run from `packages/core/`, not the monorepo root.

```
/Users/archiesun/Desktop/ConShellV2/packages/core
```

## Canonical Commands

| Scope | Command |
|-------|---------|
| Economic tests only | `pnpm test:economic` (from root) |
| Economic tests only | `./scripts/verify-economic.sh` |
| All core tests | `pnpm --filter core exec vitest run` |
| Single test file | `pnpm --filter core exec vitest run src/economic/<file>.test.ts` |

## Why Root `pnpm test` Fails for Economic Tests

The root `pnpm test` runs `pnpm -r test`, which delegates to each package's own `test` script. If `packages/core/package.json` doesn't define a `test` script, or the script runs `vitest` without the correct config, tests may not be discovered.

The reliable path is always `pnpm --filter core exec vitest run src/economic/`.

## Verification Terminology

| Term | Meaning |
|------|---------|
| **implemented** | Code written, compiles, no runtime proof |
| **tested** | Tests written and passing locally at least once |
| **locally re-verified** | Tests re-run after changes, output attached |
| **claimed but not re-verified** | Previously tested, not re-run after recent changes |

## Test File Registry

| File | Tests | Round |
|------|-------|-------|
| `economic-survival-loop.test.ts` | 90 | 15.7 |
| `economic-integration.test.ts` | 17 | 15.7B |
| `economic-runtime.test.ts` | 27 | 15.8 |
| `economic-feedback.test.ts` | ~20 | 15.9 |
