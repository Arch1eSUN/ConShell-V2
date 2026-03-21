# Operation Continuity Contract

This contract defines the architectural rules surrounding **Operation Continuity**, specifically how the `SchedulerService` ensures cross-session resilience and time-based task waking within the ConShell V2 runtime.

## Rationale
Prior to Round 18.8, ConShell recovered Identity Continuity (who the agent is) and Commitment Recovery (what their active mission is) but lacked true Execution Continuity (what was supposed to happen at a specific time). The `SchedulerService` introduces Operation Continuity, allowing the agent to persist scheduled wake-ups, background tasks, and chronological commitments safely across unexpected shutdowns and explicit reboots.

## 1. Storage Backend Independence
- The `SchedulerService` interacts only with a backend implementing `SchedulerBackend`.
- By default, the Kernel injects the `MemorySchedulerBackend`.
- Storage persistence is **not** managed by the backend natively; instead, it is dehydrated via `snapshot()` and re-hydrated via `restore()`.

## 2. Canonical Recovery Lifecycle
1. **Boot Hydration**: During Kernel Boot (Step 7.5), the `ContinuityService` provides the last known `SchedulerSnapshot` via `loadSchedulerSnapshot()`. If present, the Kernel immediately calls `scheduler.restore(snapshot)` before `AgentLoop` activates.
2. **Turn Checkpointing**: On every checkpoint tick (via `checkpointTurn()`), the Kernel invokes `scheduler.snapshot()` and writes to `scheduler-snapshot.json` using `ContinuityService.saveSchedulerSnapshot()`.
3. **Safe Shutdown**: The Kernel explicitly flushes the snapshot to disk on `shutdown()` ensuring no delayed tasks or state transitions are lost in memory.

## 3. Dispatched Task Execution
The Scheduler does **not** execute tasks directly. To preserve the boundaries of execution capability, it routes scheduled tasks into the main `taskQueue` via its `dispatchHandler`.
- Tasks are translated into either `inference` (cognitive) or `tool_call` execution routines.
- This creates a unified pipeline through the `AgentLoop`, maintaining the system's strict step-by-step traceably governed execution.

## 4. Continuity Drift Protection
- Malformed snapshots or parsing failures in `scheduler-snapshot.json` must defensively initialize an empty scheduler state rather than catastrophically failing the boot sequence.
- All scheduled tasks define a `maxRetries` and track `attempts`. Tasks that persistently fail to resolve will be marked 'abandoned' by the executor, preventing scheduler gridlock.

## 5. Execution Consistency & Fault Discipline (Round 18.9)

To harden the runtime resume semantics against synchronization drift, strict boundaries govern task dispatching:

### 5.1 Deduplication (Queue Authoritative)
The `SchedulerService` is agnostic to task duplication. The canonical enforcer for execution deduplication is the `TaskQueue`.
- The `TaskQueue` tracks an active set of `commitmentId`s currently in flight.
- Any identically dispatched commitments are rejected by the queue, guaranteeing that overdue overlapping snapshot recoveries do not result in duplicated parallel labor.

### 5.2 Stale Snapshot Suppression (Agenda Canonical)
Before the `SchedulerService`'s dispatcher transforms a scheduled task into an execution payload, it must consult the `Agenda.isExecutionEligible(commitmentId)` predicate.
- The `isExecutionEligible` method serves as the **single source of truth** suppressing stale snapshots.
- It validates that the underlying commitment exists, is not in a terminal state (`completed`, `abandoned`, `failed`), and is not `blocked` due to identity revocation or survival resource restrictions.
- Ineligible tasks are cleanly discarded by the scheduler dispatcher, rather than failing and looping.
