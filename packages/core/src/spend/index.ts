/**
 * SpendTracker — 推理成本追踪 (持久化版)
 *
 * 功能:
 * - 记录每次推理/工具调用的成本
 * - 按小时/天/月聚合
 * - 预算上限告警
 * - 收入追踪 (x402 支付接收)
 * - 净收支计算
 * - 可选 SQLite 持久化 (SpendRepository)
 */
import type { Cents } from '../types/common.js';
import { Cents as toCents } from '../types/common.js';
import type { SpendRepository } from '../state/repos/spend.js';
import type { PolicyDecision, GovernanceOverride } from './governance-types.js';
import { GovernanceEvaluator } from './governance-evaluator.js';
import { evaluateScopes, DEFAULT_SCOPE_CONFIGS } from './budget-scope.js';
import type { BudgetScopeConfig } from './budget-scope.js';

// Re-export new governance types for consumers
export type { PolicyDecision, GovernanceOverride, ReasonCode, GovernanceActionId, PressureLevel, BudgetScopeId, BudgetScopeResult } from './governance-types.js';
export { REASON_CODES, THRESHOLDS, LEVEL_CONTRACTS } from './governance-types.js';
export type { BudgetScopeConfig } from './budget-scope.js';
export { evaluateScopes, DEFAULT_SCOPE_CONFIGS } from './budget-scope.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface SpendRecord {
  id: string;
  /** 提供者 (e.g., 'openai', 'anthropic') */
  provider: string;
  /** 模型名称 */
  model?: string;
  /** 成本 (cents) */
  costCents: number;
  /** 类别 */
  category: SpendCategory;
  /** 描述 */
  description?: string;
  /** 时间戳 (ms epoch) */
  timestamp: number;
}

export type SpendCategory = 'inference' | 'tool' | 'storage' | 'network' | 'compute' | 'other';

// ── Round 15.4: Economic Governance Contract ─────────────────────────

/** Budget pressure level based on spend utilization */
export type SpendPressure = 'low' | 'medium' | 'high' | 'critical';

/** Governance action that runtime must respect */
export type GovernanceAction = 'allow' | 'caution' | 'degrade' | 'block';

/** Full governance verdict — serializable, auditable, testable */
export interface GovernanceVerdict {
  /** Current budget pressure level */
  pressure: SpendPressure;
  /** Required runtime action */
  action: GovernanceAction;
  /** Human-readable explanation for audit */
  reason: string;
  /** Hourly budget utilization (0–1) */
  hourlyUtilization: number;
  /** Daily budget utilization (0–1) */
  dailyUtilization: number;
  /** Balance remaining as percentage (0–100) */
  balanceRemainingPct: number;
  /** Timestamp of assessment */
  assessedAt: string;
}

export interface IncomeRecord {
  id: string;
  /** 来源 */
  source: string;
  /** 收入 (cents) */
  amountCents: number;
  /** 交易hash (链上) */
  txHash?: string;
  /** 时间戳 */
  timestamp: number;
}

export interface SpendBreakdown {
  provider: string;
  model?: string;
  requests: number;
  costCents: Cents;
}

export interface SpendAggregates {
  /** 总支出 */
  totalSpendCents: Cents;
  /** 今日支出 */
  dailySpendCents: Cents;
  /** 本小时支出 */
  hourlySpendCents: Cents;
  /** 总收入 */
  totalIncomeCents: Cents;
  /** 今日收入 */
  dailyIncomeCents: Cents;
  /** 净余额 (income - spend) */
  netBalanceCents: Cents;
  /** 按提供者分解 */
  breakdown: SpendBreakdown[];
  /** 日均消耗速率 (cents/day) */
  burnRateCentsPerDay: number;
  /** 预估存活天数 */
  estimatedSurvivalDays: number;
}

export interface BudgetConfig {
  /** 每日预算上限 (cents) */
  dailyLimitCents: number;
  /** 每小时预算上限 (cents) */
  hourlyLimitCents: number;
  /** 单笔最大 (cents) */
  maxSingleSpendCents: number;
  /** 初始余额 (cents) */
  initialBalanceCents: number;
}

export interface BudgetAlert {
  type: 'daily_limit' | 'hourly_limit' | 'single_limit' | 'low_balance' | 'zero_balance';
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: string;
}

export type BudgetAlertListener = (alert: BudgetAlert) => void;

// ── Default Config ─────────────────────────────────────────────────────

const DEFAULT_BUDGET: BudgetConfig = {
  dailyLimitCents: 10_000, // $100/day
  hourlyLimitCents: 2_000, // $20/hour
  maxSingleSpendCents: 500, // $5 single
  initialBalanceCents: 100_000, // $1000
};

// ── SpendTracker ───────────────────────────────────────────────────────

export class SpendTracker {
  private spendRecords: SpendRecord[] = [];
  private incomeRecords: IncomeRecord[] = [];
  private budget: BudgetConfig;
  private alertListeners = new Set<BudgetAlertListener>();
  private idCounter = 0;
  private repo: SpendRepository | null;
  // Round 15.5: Governance Evaluator + Override
  private _evaluator = new GovernanceEvaluator();
  private _override: GovernanceOverride | null = null;
  private _scopeConfigs: BudgetScopeConfig[];
  private _recordListeners = new Set<(type: 'spend' | 'income', record: SpendRecord | IncomeRecord) => void>();

  constructor(budget?: Partial<BudgetConfig>, repo?: SpendRepository) {
    this.budget = { ...DEFAULT_BUDGET, ...budget };
    this.repo = repo ?? null;
    // Sync scope configs with budget config
    this._scopeConfigs = [
      { scope: 'turn', limitCents: DEFAULT_SCOPE_CONFIGS[0].limitCents, enabled: true },
      { scope: 'session', limitCents: DEFAULT_SCOPE_CONFIGS[1].limitCents, enabled: true },
      { scope: 'hourly', limitCents: this.budget.hourlyLimitCents, enabled: true },
      { scope: 'daily', limitCents: this.budget.dailyLimitCents, enabled: true },
    ];
  }

  // ── Record ─────────────────────────────────────────────────────────

  /**
   * Record a spend event (inference call, tool use, etc.)
   * Returns false if blocked by budget limit
   */
  recordSpend(
    provider: string,
    costCents: number,
    opts?: {
      model?: string;
      category?: SpendCategory;
      description?: string;
      /** Round 15.3: Attribution — session that incurred this cost */
      sessionId?: string;
      /** Round 15.3: Attribution — turn within the session */
      turnId?: string;
    },
  ): boolean {
    // Check single-spend limit
    if (costCents > this.budget.maxSingleSpendCents) {
      this.emitAlert({
        type: 'single_limit',
        message: `Single spend ${costCents}¢ exceeds limit ${this.budget.maxSingleSpendCents}¢`,
        currentValue: costCents,
        threshold: this.budget.maxSingleSpendCents,
        timestamp: new Date().toISOString(),
      });
      return false;
    }

    // Check hourly limit
    const hourlySpend = this.getHourlySpend();
    if (hourlySpend + costCents > this.budget.hourlyLimitCents) {
      this.emitAlert({
        type: 'hourly_limit',
        message: `Hourly spend would exceed limit: ${hourlySpend + costCents}¢ > ${this.budget.hourlyLimitCents}¢`,
        currentValue: hourlySpend + costCents,
        threshold: this.budget.hourlyLimitCents,
        timestamp: new Date().toISOString(),
      });
      return false;
    }

    // Check daily limit
    const dailySpend = this.getDailySpend();
    if (dailySpend + costCents > this.budget.dailyLimitCents) {
      this.emitAlert({
        type: 'daily_limit',
        message: `Daily spend would exceed limit: ${dailySpend + costCents}¢ > ${this.budget.dailyLimitCents}¢`,
        currentValue: dailySpend + costCents,
        threshold: this.budget.dailyLimitCents,
        timestamp: new Date().toISOString(),
      });
      return false;
    }

    const record: SpendRecord = {
      id: `spend_${++this.idCounter}`,
      provider,
      model: opts?.model,
      costCents,
      category: opts?.category ?? 'inference',
      description: opts?.description,
      timestamp: Date.now(),
    };
    this.spendRecords.push(record);

    // Persist to SQLite if repo available
    if (this.repo) {
      this.repo.insert({
        type: 'spend',
        amountCents: costCents,
        provider,
        model: opts?.model,
        category: opts?.category ?? 'inference',
        description: opts?.description,
        sessionId: opts?.sessionId,
        turnId: opts?.turnId,
        kind: (opts?.category ?? 'inference') as any,
      });
    }

    // Check low balance
    const balance = this.getBalance();
    if (balance <= 0) {
      this.emitAlert({
        type: 'zero_balance',
        message: 'Balance has reached zero — agent survival at risk',
        currentValue: balance,
        threshold: 0,
        timestamp: new Date().toISOString(),
      });
    } else if (balance < this.budget.initialBalanceCents * 0.1) {
      this.emitAlert({
        type: 'low_balance',
        message: `Balance below 10%: ${balance}¢ remaining`,
        currentValue: balance,
        threshold: this.budget.initialBalanceCents * 0.1,
        timestamp: new Date().toISOString(),
      });
    }

    // Round 15.7B: Fire record listeners
    for (const fn of this._recordListeners) fn('spend', record);

    return true;
  }

  /**
   * Record income (x402 payment received, etc.)
   */
  recordIncome(source: string, amountCents: number, txHash?: string): void {
    const record: IncomeRecord = {
      id: `income_${++this.idCounter}`,
      source,
      amountCents,
      txHash,
      timestamp: Date.now(),
    };
    this.incomeRecords.push(record);

    // Persist to SQLite if repo available
    if (this.repo) {
      this.repo.insert({
        type: 'income',
        amountCents,
        description: `source:${source}${txHash ? ` tx:${txHash}` : ''}`,
      });
    }

    // Round 15.7B: Fire record listeners
    for (const fn of this._recordListeners) fn('income', record);
  }

  /**
   * Round 15.7B: Register listener for spend/income events (used by LedgerProjection).
   */
  onRecord(listener: (type: 'spend' | 'income', record: SpendRecord | IncomeRecord) => void): () => void {
    this._recordListeners.add(listener);
    return () => this._recordListeners.delete(listener);
  }

  // ── Round 15.5: Economic Governance (Policy Layer) ─────────────────

  /**
   * Assess current spend pressure and return a structured PolicyDecision.
   * Thin wrapper: delegates to GovernanceEvaluator with scope results.
   * Runtime MUST consume the returned decision object.
   *
   * @param turnId - Current turn identifier for turn-scope filtering
   * @param sessionId - Current session identifier for session-scope filtering
   */
  assessPressure(turnId?: string, sessionId?: string): PolicyDecision {
    const scopeResults = evaluateScopes(this._scopeConfigs, {
      records: this.spendRecords,
      turnId,
      sessionId,
    });

    return this._evaluator.evaluate({
      scopeResults,
      balanceCents: this.getBalance(),
      balanceRemainingPct: this.getBudgetRemainingPct(),
      override: this._override,
    });
  }

  /**
   * Legacy backward-compat wrapper (Round 15.4 shape).
   * Use assessPressure() for the full PolicyDecision.
   */
  assessPressureLegacy(): GovernanceVerdict {
    const decision = this.assessPressure();
    const levelToAction: Record<string, GovernanceAction> = {
      allow: 'allow', caution: 'caution', degrade: 'degrade', block: 'block',
    };
    const levelToPressure: Record<string, SpendPressure> = {
      allow: 'low', caution: 'medium', degrade: 'high', block: 'critical',
    };
    const hourlyScope = decision.metricsSnapshot.scopeResults.find(s => s.scope === 'hourly');
    const dailyScope = decision.metricsSnapshot.scopeResults.find(s => s.scope === 'daily');
    return {
      pressure: levelToPressure[decision.level] ?? 'low',
      action: levelToAction[decision.level] ?? 'allow',
      reason: decision.explanation,
      hourlyUtilization: hourlyScope?.utilization ?? 0,
      dailyUtilization: dailyScope?.utilization ?? 0,
      balanceRemainingPct: decision.metricsSnapshot.balanceRemainingPct,
      assessedAt: decision.decisionTimestamp,
    };
  }

  /**
   * Set a governance override (creator escape hatch).
   * Override cannot bypass safety (balance=0).
   */
  setOverride(override: GovernanceOverride): void {
    this._override = { ...override, bypassSafety: false };
  }

  /** Clear active override. */
  clearOverride(): void {
    this._override = null;
  }

  /** Get active override (for inspection/testing). */
  getOverride(): GovernanceOverride | null {
    return this._override;
  }

  /** Get spend records (for scope evaluation and testing). */
  getSpendRecords(): ReadonlyArray<SpendRecord> {
    return this.spendRecords;
  }

  // ── Queries ────────────────────────────────────────────────────────

  /** Current balance = initial + income - spend */
  getBalance(): number {
    const totalSpend = this.spendRecords.reduce((sum, r) => sum + r.costCents, 0);
    const totalIncome = this.incomeRecords.reduce((sum, r) => sum + r.amountCents, 0);
    return this.budget.initialBalanceCents + totalIncome - totalSpend;
  }

  /** Budget remaining as percentage (0-100) */
  getBudgetRemainingPct(): number {
    const balance = this.getBalance();
    const total = this.budget.initialBalanceCents + this.incomeRecords.reduce((s, r) => s + r.amountCents, 0);
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (balance / total) * 100));
  }

  /** Full aggregates */
  aggregates(): SpendAggregates {
    const now = Date.now();
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const hourStart = now - 3600_000;
    const dayStartMs = dayStart.getTime();

    const byProvider = new Map<string, { requests: number; costCents: number; model?: string }>();
    let totalSpend = 0, dailySpend = 0, hourlySpend = 0;

    for (const r of this.spendRecords) {
      totalSpend += r.costCents;
      if (r.timestamp >= dayStartMs) dailySpend += r.costCents;
      if (r.timestamp >= hourStart) hourlySpend += r.costCents;

      const key = r.model ? `${r.provider}:${r.model}` : r.provider;
      const existing = byProvider.get(key) ?? { requests: 0, costCents: 0, model: r.model };
      existing.requests++;
      existing.costCents += r.costCents;
      byProvider.set(key, existing);
    }

    let totalIncome = 0, dailyIncome = 0;
    for (const r of this.incomeRecords) {
      totalIncome += r.amountCents;
      if (r.timestamp >= dayStartMs) dailyIncome += r.amountCents;
    }

    // Calculate burn rate (cents per day, looking at last 7 days)
    const sevenDaysAgo = now - 7 * 86400_000;
    const recentSpend = this.spendRecords
      .filter(r => r.timestamp >= sevenDaysAgo)
      .reduce((s, r) => s + r.costCents, 0);
    const daysTracked = Math.max(1, (now - (this.spendRecords[0]?.timestamp ?? now)) / 86400_000);
    const burnRate = Math.round(recentSpend / Math.min(7, daysTracked));

    const balance = this.getBalance();
    const survivalDays = burnRate > 0 ? Math.floor(balance / burnRate) : Infinity;

    return {
      totalSpendCents: toCents(totalSpend),
      dailySpendCents: toCents(dailySpend),
      hourlySpendCents: toCents(hourlySpend),
      totalIncomeCents: toCents(totalIncome),
      dailyIncomeCents: toCents(dailyIncome),
      netBalanceCents: toCents(balance),
      breakdown: Array.from(byProvider.entries()).map(([key, data]) => ({
        provider: key.split(':')[0],
        model: data.model,
        requests: data.requests,
        costCents: toCents(data.costCents),
      })),
      burnRateCentsPerDay: burnRate,
      estimatedSurvivalDays: survivalDays === Infinity ? 999 : survivalDays,
    };
  }

  // ── Alerts ─────────────────────────────────────────────────────────

  onAlert(listener: BudgetAlertListener): () => void {
    this.alertListeners.add(listener);
    return () => this.alertListeners.delete(listener);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private getDailySpend(): number {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    return this.spendRecords
      .filter(r => r.timestamp >= dayStart.getTime())
      .reduce((s, r) => s + r.costCents, 0);
  }

  private getHourlySpend(): number {
    const hourStart = Date.now() - 3600_000;
    return this.spendRecords
      .filter(r => r.timestamp >= hourStart)
      .reduce((s, r) => s + r.costCents, 0);
  }

  private emitAlert(alert: BudgetAlert): void {
    for (const fn of this.alertListeners) fn(alert);
  }

  /** Get all records (for persistence/export) */
  getRecords(): { spend: SpendRecord[]; income: IncomeRecord[] } {
    return { spend: [...this.spendRecords], income: [...this.incomeRecords] };
  }

  /** Load records (from persistence/import) */
  loadRecords(data: { spend: SpendRecord[]; income: IncomeRecord[] }): void {
    this.spendRecords = [...data.spend];
    this.incomeRecords = [...data.income];
    this.idCounter = Math.max(
      ...this.spendRecords.map(r => parseInt(r.id.split('_')[1] ?? '0', 10)),
      ...this.incomeRecords.map(r => parseInt(r.id.split('_')[1] ?? '0', 10)),
      0,
    );
  }

  /** Estimated burn info for survival engine */
  getBurnInfo(): { dailyBurnCents: number; dailyIncomeCents: number; balanceCents: number } {
    const agg = this.aggregates();
    return {
      dailyBurnCents: agg.burnRateCentsPerDay,
      dailyIncomeCents: (agg.dailyIncomeCents as unknown as number),
      balanceCents: this.getBalance(),
    };
  }
}
