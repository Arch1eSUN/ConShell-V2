# Operation Continuity Wiring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire `SchedulerService` snapshot persistence into the canonical `Kernel` runtime, giving it true execution resume semantics via `HeartbeatDaemon` and `AgendaStore`.

**Architecture:** The Kernel will instantiate `SchedulerService` during boot, restoring its state from `ContinuityService.loadSchedulerSnapshot()`. A new `scheduler-tick` phase will be registered on the `HeartbeatDaemon` to drive overdue tasks. When dispatched, tasks will be validated against the `AgendaStore` and injected into the `TaskQueue` to prevent duplicate execution and enable active recovery.

**Tech Stack:** TypeScript, ConShellV2 Kernel, Vitest

---

### Task 1: Wire Scheduler into Kernel Boot

**Files:**
- Modify: `packages/core/src/kernel/index.ts`
- Modify: `packages/core/src/scheduler/index.ts` (export needed classes)

**Step 1.1: Instantiate SchedulerService and load snapshot**
Inside `Kernel.start()` (after agenda initialization):
- Instantiate `MemorySchedulerBackend`.
- Instantiate `SchedulerService` wrapping the backend.
- Create a `DispatchHandler` that looks up the task's `commitmentId` from `agenda`. If the commitment is pending/active, push a `QueuedTask` to `taskQueue` and mark the commitment. Return success. Else, return success without pushing.
- Call `continuity.loadSchedulerSnapshot()`. If found, call `scheduler.restore(snapshot)`.

**Step 1.2: Register Heartbeat Phase**
In the heartbeat initialization block of `Kernel.start()`:
- Register phase: `{ name: 'scheduler-tick', execute: async () => { scheduler.tick(); }, enabled: true }`.

### Task 2: Implement Persistence Hooks (Checkpoint/Stop)

**Files:**
- Modify: `packages/core/src/kernel/index.ts`

**Step 2.1: Update checkpointTurn() & safeStop()**
- Extract `const snap = this.services.scheduler.snapshot()`.
- Save `this.services.continuity.saveSchedulerSnapshot(snap)`.

### Task 3: Recovery Testing

**Files:**
- Create: `packages/core/src/kernel/kernel-scheduler-resume.test.ts`

**Step 3.1: Write isolation tests**
- Boot a kernel, add a task, call `checkpointTurn()`, stop kernel.
- Boot a *new* kernel sharing the `agentHome`.
- Manually run `scheduler.tick()` or the heartbeat phase.
- Assert the task was processed and injected into `TaskQueue`.

**Step 3.2: Verify full suite**
- Run: `npx vitest run src`
- Expected: 1693+ tests pass.

### Task 4: Operation Continuity Boundary Document

**Files:**
- Create: `packages/core/docs/architecture/operation-continuity.md`

**Step 4.1: Write conceptual definition**
- Clarify layers: identity, session, agenda, scheduler, runtime.
- Define what 18.8 achieves.
