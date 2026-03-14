# Identity & Continuity Contract

> This document is the canonical specification for identity continuity verification in ConShell V2.
> The contract ensures runtime self-state is verifiable against persisted evidence.

## ContinuityService Hash Chain Contract

The `ContinuityService` maintains a cryptographic hash chain of SOUL.md evolution:

| Property | Specification |
|----------|--------------|
| **Chain storage** | `continuity_records` table: version, soulHash, previousHash, createdAt |
| **Genesis** | First record: `previousHash = "genesis"` |
| **Advance** | Each advance: `previousHash = SHA-256(previous soulHash)` |
| **Verification** | `verifyContinuityChain()` validates entire chain is unbroken |
| **Hydration** | On boot, `ContinuityService.hydrate()` rebuilds `SelfState` from DB |

## SelfState Runtime Contract

`ContinuityService.getCurrentState()` returns a `SelfState` object:

```typescript
interface SelfState {
  mode: 'genesis' | 'continuing' | 'forked' | 'unknown';
  chainValid: boolean;
  chainLength: number;
  soulDrifted: boolean;
  explanation: {
    continuityBasis: string;
    identityBasis: string;
  };
}
```

### Invariants
- `chainValid` MUST match `verifyContinuityChain()` result against DB
- `chainLength` MUST equal `continuity_records` row count
- `soulDrifted` MUST reflect actual hash comparison of current SOUL vs latest record

## Doctor Verification Contract

Doctor's `checkIdentityCoherence()` (check id: `runtime-self-state-consistent`):
1. Receives `selfState` from `Kernel.getDiagnosticsOptions()`
2. Cross-checks every `selfState` field against fresh DB evidence
3. Any divergence → blocker-severity failure

## Production Path

```
Kernel.boot()
  → ContinuityService.hydrate()         // builds live SelfState
  → this.services.selfState             // stored in service registry
  → Kernel.getDiagnosticsOptions()      // exposes selfState to callers
  → /api/health endpoint                // passes to runDiagnostics()
  → checkIdentityCoherence(db, soul, selfState)  // Doctor verifies
```

## Code Enforcement

- `ContinuityService` — [continuity-service.ts](file:///packages/core/src/identity/continuity-service.ts)
- `checkIdentityCoherence` — [checks/identity.ts](file:///packages/core/src/doctor/checks/identity.ts)
- `getDiagnosticsOptions` — [kernel/index.ts](file:///packages/core/src/kernel/index.ts)
- `/api/health` endpoint — [kernel/index.ts](file:///packages/core/src/kernel/index.ts) (registered during boot)
