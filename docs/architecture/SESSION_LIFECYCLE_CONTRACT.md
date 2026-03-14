# Session Lifecycle Contract

> This document is the canonical specification for session lifecycle management in ConShell V2.
> It defines how sessions are started in production and who is responsible for what.

## Production Path

```
User message arrives
  → AgentLoop.processMessage(message, sessionId)
  → if (sessionId ∉ seenSessions):
      seenSessions.add(sessionId)
      lifecycleHost.startSession(sessionId)    // calls Kernel
  → Kernel.startSession(sessionId)
      → ContinuityService.onSessionStart(sessionId)
      → Logger records session start
```

## Contract Parties

| Party | Responsibility |
|-------|---------------|
| **AgentLoop** | Detects first message per session, calls `lifecycleHost.startSession()` |
| **Kernel** | Implements `SessionLifecycleHost`; broadcasts to ContinuityService |
| **ContinuityService** | Records session event in continuity context |

## Wiring

- Boot-time: `automaton.agentLoop.setLifecycleHost(this)` at kernel line 336
- Interface: `SessionLifecycleHost { startSession(sessionId: string): void }`
- Dedup: `AgentLoop` maintains a `Set<string>` to ensure one-shot-per-session

## Invariants

1. `startSession()` MUST be called exactly once per unique `sessionId`
2. If no `lifecycleHost` is set, `processMessage()` still works (graceful degradation)
3. The wiring happens during boot, not during route registration — it is kernel-level, not server-level

## Code Enforcement

- `AgentLoop.setLifecycleHost()` — [agent-loop.ts](file:///packages/core/src/runtime/agent-loop.ts)
- `Kernel.startSession()` — [kernel/index.ts](file:///packages/core/src/kernel/index.ts)
- Boot wiring — [kernel/index.ts](file:///packages/core/src/kernel/index.ts) line 336
- Tests — [agent-loop-lifecycle.test.ts](file:///packages/core/src/runtime/agent-loop-lifecycle.test.ts) (6 tests)
