# ConShellV2 Release Checklist

> Established Round 19.9 — This defines the minimum verification gates for any round to be considered "complete".

## Pre-Release Gates (all must pass)

| # | Gate | Command | Criteria |
|---|------|---------|----------|
| 1 | Core Tests | `cd packages/core && npx vitest run` | All files pass, all tests green |
| 2 | Dashboard TypeScript | `cd packages/dashboard && npx tsc --noEmit` | Zero errors |
| 3 | Dashboard Build | `cd packages/dashboard && npx vite build` | Clean build, no errors |
| 4 | Code Quality | `grep -rn "as any)" packages/dashboard/src/` | Zero posture-related type casts |
| 5 | CLI TypeScript | `cd packages/cli && npx tsc --noEmit` | Zero errors |

## Automated

Run all gates at once:

```bash
bash scripts/verify-release.sh
```

## Discipline Rules

1. **No round is "complete" until all 5 gates pass**
2. **Contract changes must sync tests** — If a provider interface gains a field, all fixtures/mocks must update in the same commit
3. **No `as any` for canonical truth surfaces** — All posture dimensions must use typed access
4. **Test count changes must be explained** — If test count goes down, document why
