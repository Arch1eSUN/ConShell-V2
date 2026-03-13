# Failure Pattern Appendix

Recurring failure modes observed across ConShell V2 development rounds.
Each pattern is documented with symptom, trigger, recovery, and prevention.

> [!IMPORTANT]
> This document distinguishes between **code defects** and **operator/environment issues**.
> Not every failure is a bug in ConShell. Some are workspace hygiene, tool limitations, or
> environmental drift.

---

## Category: Workspace / Path Issues

### FP-01: `ENOENT` on file access during agentic work

| Field | Detail |
|-------|--------|
| **Symptom** | `read: ENOENT ... access STR` during file operations |
| **Trigger** | Agent generates path strings that include STR placeholders or relative paths |
| **Recovery** | Retry with absolute, validated path |
| **Prevention** | Always resolve absolute paths before file I/O. Use `path.resolve()` before any fs call. |
| **Classification** | Operator/tooling — not a code defect |

### FP-02: macOS EPERM on `node_modules`

| Field | Detail |
|-------|--------|
| **Symptom** | `Operation not permitted` on any `node_modules` access |
| **Trigger** | macOS SIP / provenance / immutable flags set by Finder copy, Time Machine, or iCloud |
| **Recovery** | `sudo chflags -R nouchg node_modules && sudo xattr -cr node_modules` |
| **Prevention** | Avoid copying project dirs via Finder. Use `cp -R` or `git clone`. |
| **Classification** | Environment — macOS-specific |

### FP-03: Numbered `node_modules` duplicates (`node_modules 2`, `node_modules 3`, etc.)

| Field | Detail |
|-------|--------|
| **Symptom** | Vitest discovers hundreds of extra test files from numbered directories |
| **Trigger** | macOS Finder creates numbered copies when destinations already exist |
| **Recovery** | `sudo rm -rf "node_modules 2" "node_modules 3"` etc. |
| **Prevention** | Root vitest.config.ts guard (added in Round 14). Never copy node_modules. |
| **Classification** | Environment — causes test contamination |

---

## Category: Native Module Issues

### FP-04: `better-sqlite3` ABI mismatch

| Field | Detail |
|-------|--------|
| **Symptom** | `NODE_MODULE_VERSION mismatch` or segfault when loading binding |
| **Trigger** | Node version changed (nvm/fnm) after `pnpm install` |
| **Recovery** | `pnpm rebuild better-sqlite3` or full `rm -rf node_modules && pnpm install` |
| **Prevention** | Pin Node version with `.nvmrc`. Run `pnpm rebuild` after any version change. |
| **Classification** | Environment — not a code defect |

### FP-05: `better-sqlite3` EPERM loading failure

| Field | Detail |
|-------|--------|
| **Symptom** | `require('better-sqlite3')` throws `EPERM` |
| **Trigger** | `node_modules` directory has macOS immutable flags |
| **Recovery** | Same as FP-02 |
| **Prevention** | Same as FP-02 |
| **Classification** | Environment — downstream of FP-02 |

---

## Category: Test Trust Issues

### FP-06: Test pass counts inconsistent across runs

| Field | Detail |
|-------|--------|
| **Symptom** | "507 tests" from `packages/core`, "2971 tests" from root |
| **Trigger** | Numbered `node_modules` dirs contain duplicate test files |
| **Root cause** | Vitest's glob pattern picks up tests in `node_modules 3/@conshell/core/src/...` |
| **Recovery** | Always run from `packages/core` directory |
| **Prevention** | Root vitest guard + remove numbered dirs |
| **Classification** | Environment + tooling — trust boundary issue |

### FP-07: "Non-reproducible" failure used as proof of no bug

| Field | Detail |
|-------|--------|
| **Symptom** | Failure in one session, pass in another; concluded as "not a bug" |
| **Trigger** | Environmental state changed between runs (e.g., node_modules fixed) |
| **Recovery** | Document **both** passing and failing conditions with full env state |
| **Prevention** | Anti-self-deception rule: "non-reproducible now" ≠ proof it was environmental |
| **Classification** | Reporting discipline — not a code defect |

---

## Category: External Integration Issues

### FP-08: EvoMap endpoint assumptions drifting

| Field | Detail |
|-------|--------|
| **Symptom** | References to `/a2a/work/claim` that don't exist in code |
| **Trigger** | Speculative documentation written before verification |
| **Recovery** | Audit code for actual implemented endpoints |
| **Prevention** | EvoMap contract status in doctor (I3 check) |
| **Classification** | Documentation discipline |

---

## Category: Reporting Discipline

### FP-09: Speculative root cause presented as conclusion

| Field | Detail |
|-------|--------|
| **Symptom** | "Root cause is X" written in docs without exhaustive elimination |
| **Trigger** | Time pressure + availability bias (first plausible explanation accepted) |
| **Recovery** | Add confidence label: High/Medium/Low |
| **Prevention** | Use doctor checks. Any "root cause is X" must have exclusion evidence. |
| **Classification** | Process discipline |

### FP-10: "Everything passed" without specifying scope

| Field | Detail |
|-------|--------|
| **Symptom** | "All tests pass" without recording which vitest config, which directory, which Node |
| **Trigger** | Optimizing for clean narrative over precise evidence |
| **Recovery** | Always record: directory, config file, Node version, exact counts |
| **Prevention** | Use doctor report as standard evidence format |
| **Classification** | Process discipline |

---

## Standard Evidence Checklist

When reporting test results, always include:

```
Directory:      <where vitest was invoked>
Config:         <which vitest.config.ts was used>
Node version:   <exact version>
Test files:     <count>
Tests:          <passed>/<total>
Failures:       <list if any>
Timestamp:      <when>
```
