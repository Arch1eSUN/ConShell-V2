# Runtime Adoption Map — Economic Module Canonical Owners

> Round 15.7B — 经济模块运行时集成 Owner 声明

## 1. Economic State → `EconomicStateService` (Facade)

- **位置**: `packages/core/src/economic/economic-state-service.ts`
- **职责**: 聚合 SpendTracker + ConwayAutomaton + X402Server → 输出 `EconomicState` 冻结快照
- **消费者**: AgentLoop (pre-loop gate), Heartbeat (监控), Gateway (API)
- **不替代**: SpendTracker 仍为持久化 spend/income truth

## 2. Ledger → `EconomicLedger` (审计投影链)

- **位置**: `packages/core/src/economic/economic-ledger.ts` + `ledger-projection.ts`
- **职责**: 从 SpendTracker 事件派生哈希链条目，提供完整性验证
- **Canonical truth**: `SpendRepository` (SQLite) 保持为持久化事实源
- **EconomicLedger**: 内存投影 + 审计链，运行时重建

## 3. Revenue Events → `X402Server` → `SpendTracker.recordIncome()`

- **流程**: `X402Server.verifyPayment()` 成功 → `SpendTracker.recordIncome('x402', amount, txHash)`
- **幂等**: `X402Server.processedTxHashes` Set 保证去重
- **持久化**: `SpendTracker.recordIncome()` → `SpendRepository.insert({ type: 'income' })`

## 4. Survival Enforcement → `AgentLoop` 消费 `SurvivalGate`

- **路径**: `EconomicStateService.getGateDecision()` → 返回 action/modelRestrictions
- **集成点**: `AgentLoop.processMessage()` pre-loop 检查点
- **与现有治理共存**: `SpendTracker.assessPressure()` 保持不变，新增 survival 层级

## 架构图

```
SpendTracker (truth)  ─→  EconomicStateService (facade)  ─→  AgentLoop
    ↑ recordIncome()         ↑ snapshot()                      ↑ pre-loop gate
X402Server ──────────────────┘  ConwayAutomaton ──────────────┘
    ↓ events                     ↓ tier
LedgerProjection → EconomicLedger (audit chain)
```
