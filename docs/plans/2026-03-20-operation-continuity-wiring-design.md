# Operation Continuity Wiring / Scheduler Canonicalization Design

## Overview
This design document addresses the requirement to finalize the "Continuous Autonomy" feature in ConShellV2 (Round 18.8). In Round 18.7, `SchedulerService` snapshot persistence was implemented but not wired into the actual runtime. This design bridges that gap, implementing the **Kernel-Driven Executive** approach to achieve operation continuity across system restarts.

## 1. Canonical Wiring (Architecture)

**Canonical Owner**: The `Kernel` assumes canonical ownership of operation continuity.
- **Initialization**: During `Kernel.start()` (around Step 8), the Kernel discovers whether a previous session exists by calling `ContinuityService.loadSchedulerSnapshot()`.
- **Instantiation**: The Kernel builds `SchedulerService` using the `MemorySchedulerBackend`.
- **Restoration**: If a valid snapshot is returned by `ContinuityService`, the Kernel immediately passes it to `SchedulerService.restore(snapshot)`. All previously serialized tasks are re-loaded into memory in their last known state (pending/overdue).
- **Persistence Hooks**: During `Kernel.checkpointTurn()` and `Kernel.safeStop()`, the Kernel retrieves the latest state via `scheduler.snapshot()` and delegates the physical write to `ContinuityService.saveSchedulerSnapshot(snapshot)`.

## 2. Runtime Resume Semantics (Execution Integration)

**Canonical Driver**: The `HeartbeatDaemon`.
- **Tick Registration**: The Kernel registers a new phase in the `HeartbeatDaemon` called `"scheduler-tick"`.
- **Periodic Evaluation**: Each time the heartbeat runs, it invokes `scheduler.tick()`. This isolates the execution of time-delayed or overdue operations to the heartbeat lifecycle, rather than an arbitrary `setInterval` within `SchedulerService` or `AgentLoop`.

**Execution Handler Wiring**:
- How do scheduled tasks actually run when they are restored? When instantiated, `SchedulerService` is injected with a `DispatchHandler` that is fully aware of `AgendaStore` and `TaskQueue`.
- **Resumption**: When `scheduler.tick()` discovers overdue tasks (e.g. from the restored snapshot), it passes each task to the `DispatchHandler`.
- **Re-injection**: The Handler parses the `task.commitmentId` and calls `agenda.get(commitmentId)`. If the corresponding Commitment is still pending/active, the Handler injects an actionable `QueuedTask` into the `TaskQueue`, making it available for the `AgentLoop`.

## 3. Fault Discipline (Idempotency and Rollbacks)

- **Malformed / Corrupt Snapshots**: If `ContinuityService` fails to parse `scheduler-snapshot.json` or detects a schema mismatch, it returns `null`. The Kernel logs a warning and initializes a fresh `SchedulerService`, preventing boot failures.
- **Duplicate Execution / Stale Data**: The `DispatchHandler` defensively checks the `AgendaStore` before injecting tasks into the queue.
  - If a snapshot was restored but the underlying Commitment was somehow already `completed` or `cancelled` in the database, the Handler immediately returns `success: true` for the scheduled task without executing it, avoiding redundant operations.
  - The `SchedulerBackend` natively marks tasks as `dispatched` before invoking the handler, handling concurrent or misaligned ticks gracefully.
