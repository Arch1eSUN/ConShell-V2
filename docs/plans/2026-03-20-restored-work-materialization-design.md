# Restored Work Execution Materialization Design

## Overview
This design implements Round 19.0 objectives: materializing scheduled commitments into actual runtime executable tasks, establishing execution ownership, enforcing pre-execution conflict reasoning (G2), and maintaining agenda state coherence (G4/G5).

## 1. Execution Ownership (CommitmentMaterializer)
Instead of hardcoding execution paths in `Kernel`, we will introduce a new adapter interface and implementation: `CommitmentMaterializer`.
**Location:** `packages/core/src/runtime/materializer.ts`

**Responsibilities:**
- Takes a `Commitment` and a `ScheduledTask`.
- Translates `inference`/`cognitive` tasks into a closure that calls `AgentLoop.processMessage()`.
- Translates `tool_call` tasks into a closure that calls `ToolExecutor.executeMany()`.
- Wires the generated closures into a `QueuedTask` that the `Kernel` can safely enqueue to `TaskQueue`.

## 2. Final Conflict Reasoning (JIT Validation)
To prevent "live state drift" (e.g., identity revoked or mode changed while the task was waiting in the queue), the materializer's `execute` closure will perform **Just-In-Time Re-evaluation** before doing any real work:
1. Call `agenda.isExecutionEligible(commitmentId)`.
2. Check if the commitment was externally marked terminal, abandoned, or blocked.
3. If invalid, return a skipped status and cleanly abort, leaving state coherent without executing the business payload.

## 3. Agenda State Coherence & Fault Discipline
The `execute` closure will completely own the lifecycle resolution of the `Commitment`:
- **Success:** Calls `agenda.markCompleted(commitmentId)`.
- **Failure:** Calls `agenda.markFailed(commitmentId, reason)`.
- **Pre-execution Veto:** Leaves the state as blocked/abandoned depending on the veto reason (or relies on the external event that triggered the veto).

## 4. Kernel Integration
Inside `packages/core/src/kernel/index.ts` Step 8:
- Instantiate `CommitmentMaterializer` passing `agentLoop`, `toolExecutor`, and `agenda`.
- In `scheduler.setHandler(task => ...)`:
  - Find commitment via `agenda.get(task.commitmentId)`.
  - Materialize standard `QueuedTask` via `materializer.materialize(commitment)`.
  - Pass the result to `taskQueue.enqueue(queuedTask)`.

## 5. Payloads & Materialization Rules
- **Cognitive / Inference:** The `description` (fallback to `name`) serves as the `userMessage` pushed to `AgentLoop` under a designated background `sessionId` (e.g., `__background_worker__`).
- **Tool Call:** Parses `name` as the tool identity and `description` as the stringified JSON argument, feeding directly into `ToolExecutor`.

---
*If this design looks correct, please approve and we can proceed to write the Implementation Plan.*
