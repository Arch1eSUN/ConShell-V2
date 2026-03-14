# Memory Ownership Contract

> This document is the canonical specification for memory tier ownership in ConShell V2.
> All owned tiers MUST carry `owner_id` on write; all shared tiers are explicitly identity-neutral.

## Owned Tiers

Owned tiers represent **self-specific knowledge** — observations, summaries, and soul state
tied to a particular identity instance. Writes MUST include `owner_id`; reads MUST filter
by owner when `ownerId` is configured.

| Tier | Table | Why owned |
|------|-------|-----------|
| Episodic Memory | `episodic_memory` | Personal experience records, inherently self-specific |
| Session Summaries | `session_summaries` | Distilled continuity of self — a session's meaning belongs to the identity that lived it |
| Soul History | `soul_history` | SOUL.md evolution snapshots — core identity ledger |

### Write invariant

```
ownerId is set → every INSERT/UPSERT into an owned tier MUST include owner_id
ownerId is unset → field defaults to NULL (single-owner mode)
```

### Read invariant

```
ownerId is set → query MUST filter by owner_id (e.g. findRecentByOwner())
ownerId is unset → no filter (single-owner backward compatibility)
```

## Shared Tiers

Shared tiers represent **identity-neutral knowledge** — facts, skills, and social structure
that transcend any single self instance. They are NOT owned.

| Tier | Table | Why shared |
|------|-------|------------|
| Semantic Memory | `semantic_memory` | Factual knowledge — "SQLite uses WAL mode" is true irrespective of who learned it |
| Procedural Memory | `procedural_memory` | Operational know-how — skill procedures are transferable across identity instances |
| Relationship Memory | `relationship_memory` | Social graph knowledge — entity relationships exist independently of the observer |

### Semantic justification for sharing

A forked identity should inherit the same factual and procedural knowledge base.
Only *experience* (episodic), *continuity records* (session summaries), and
*self-evolution* (soul history) are identity-bound.

## Code enforcement

- `MemoryTierManager.saveSessionSummary()` → passes `opts.ownerId` to `upsert()`
- `MemoryTierManager.saveSoulSnapshot()` → passes `opts.ownerId` to `insert()`
- `MemoryTierManager.remember()` (episodic) → passes `opts.ownerId` to `insert()`
- `MemoryTierManager.buildContext()` → uses `findRecentByOwner()` when `ownerId` is set
- Shared tier writes (`storeSemanticFact`, `storeProcedure`) → no `owner_id` parameter
