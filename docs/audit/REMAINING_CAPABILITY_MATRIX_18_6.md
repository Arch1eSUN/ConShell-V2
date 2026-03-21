# ConShell Remaining Capability Matrix
## Pre-Release (18.6) vs Post-Release (19.x+) Boundary

This matrix defines the final functional and optimization gaps categorized into what MUST be closed in Round 18.6 before the 0.1.0 release, what SHOULD be closed, and what CAN DEFER to 19.x+.

| Capability Area | Current State | Remaining Gap | Priority | Status (18.6 vs 19.x) |
| :--- | :--- | :--- | :--- | :--- |
| **Testing & Health** | 95/95 18.x Tests Passed. 5 failed suites in full test run. | `ox` module resolution error in `viem`. Outdated API route count in `economic-17-9.test.ts` and `economic-16-9-1.test.ts`. | P0 | MUST-FINISH-NOW (18.6) |
| **Continuous Autonomy** | Scheduler, agenda loop, and basic commitments exist. | Durable scheduler; Wakeup continuity across restarts; Mission continuity for long-horizon tasks; Deeper mode/agenda/survival coupling. | P1 | SHOULD-FINISH-NOW (18.6) |
| **Economic Full-System Integration** | Settlement primitive, truth surface, and writeback layer v1 exist. | Full wiring of `SettlementOutcome` to `EconomicStateService`, `ProfitabilityEvaluator`, `AgendaGenerator`, and `TaskFeedbackHeuristic`. | P1 | MUST-FINISH-NOW (18.6) |
| **Governed Self-Mod & Evolution** | Self-mod, lineage, and collective foundations exist. | Complete proposal → approval → apply → verify → rollback loop. Viability gating for replication. Quarantine/revoke for lineage. | P2 | SHOULD-FINISH-NOW (18.6) |
| **Collective / Lineage Depth** | Collective modules, multi-agent concepts exist. | Strengthened collective governance; deeper peer trust/delegation; distributed resource coupling; explicit capability inheritance. | P2 | CAN-DEFER (19.x+) |
| **OpenClaw Integration** | Channels, plugins, webchat, sessions exist. | Full Control UI/operator plane unification; deeper multi-session orchestration; node/gateway/cron native absorption. | P3 | CAN-DEFER (19.x+) |
| **System Reliability / Recovery** | Doctor, verification context, kernel integrity exist. | Cold start consistency; high-risk path failure handling; long-session stability; checkpoint/replay discipline. | P3 | SHOULD-FINISH-NOW (18.6) |
| **Web4 Truth Surface & Posture** | Identity anchor exists. Basic truth surfaces exist. | External readable machine declarations; formalized Web4 viability proofs and external identity projections. | P4 | CAN-DEFER (19.x+) |

### Completion Boundary Definition (18.6)
**Round 18.6 is considered complete when:**
1. **Full-Test Zero Failures:** All integration and unit tests pass with 0 failures.
2. **Economic Writeback Deep Wiring:** The `SettlementRuntimeService` actively alters the continuous agenda and profitability scores in real-time.
3. **Autonomy Continuity:** Autonomy cycles seamlessly recover from interruptions.
4. **Self-Modification Loop safety:** Self-modification and lineage replication operations are strictly guarded by comprehensive governance validation and rollback capabilities.
5. **Recovery & Reliability optimizations:** Essential cold start and state consistency operations are stabilized for external consumer usage.

*All other systemic expansions (e.g., full multi-agent federation, full OpenClaw UI absorption, complete Web4 machine declaration surfaces) are deferred to 19.x+ architecture milestones.*
