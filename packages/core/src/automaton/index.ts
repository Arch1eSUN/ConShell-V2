/**
 * Conway Automaton — 生存演化引擎 (完整版)
 *
 * 实现 Conway Automaton 的核心生存机制:
 * - 5 级生存阈值: thriving → normal → frugal → critical → terminal → dead
 * - 每代演化: 根据环境快照自动适应
 * - 适应策略: 模型降级、上下文裁剪、任务暂停
 * - 不可逆死亡: 预算归零 + 无法赚取
 * - 可观测性: 事件发射 + 指标上报
 */

// ── Types ──────────────────────────────────────────────────────────────

export type SurvivalTier = 'thriving' | 'normal' | 'frugal' | 'critical' | 'terminal' | 'dead';

export interface SurvivalThresholds {
  /** 低于此百分比进入 frugal (default 30%) */
  frugalPct: number;
  /** 低于此百分比进入 critical (default 10%) */
  criticalPct: number;
  /** 低于此百分比进入 terminal (default 2%) */
  terminalPct: number;
  /** 为 0 则 dead */
  deadPct: number;
}

export interface CellConfig {
  survivalThresholds: SurvivalThresholds;
  /** 每代间隔 (ms), default 60_000 */
  generationIntervalMs: number;
  /** 最大允许降级次数后进入dormant */
  maxConsecutiveDegradations: number;
  /** Agent 名称 */
  agentName: string;
}

export type CellState = 'alive' | 'dormant' | 'dead';

export interface EnvironmentSnapshot {
  /** 预算剩余百分比 (0-100) */
  budgetRemainingPct: number;
  /** 内存压力 (0-1) */
  memoryPressure: number;
  /** 活跃连接数 */
  activeConnections: number;
  /** 最后心跳时间 (ms epoch) */
  lastHeartbeat: number;
  /** 近24h收入 (cents) */
  recentIncomeCents: number;
  /** 近24h支出 (cents) */
  recentSpendCents: number;
  /** 当前推理模型 */
  currentModel?: string;
  /** 上下文窗口大小 */
  contextWindowTokens?: number;
}

export interface Adaptation {
  type: AdaptationType;
  description: string;
  timestamp: string;
  previousValue?: string;
  newValue?: string;
}

export type AdaptationType =
  | 'model_downgrade'
  | 'context_reduction'
  | 'task_pause'
  | 'feature_disable'
  | 'sleep_mode'
  | 'income_seek'
  | 'replication_halt'
  | 'emergency_shutdown';

export interface GenerationResult {
  generation: number;
  state: CellState;
  tier: SurvivalTier;
  previousTier: SurvivalTier;
  adaptations: Adaptation[];
  budgetPct: number;
  netIncome: number;
  timestamp: string;
}

export interface AutomatonStats {
  generation: number;
  state: CellState;
  tier: SurvivalTier;
  startedAt: number;
  adaptationCount: number;
  totalAdaptations: Adaptation[];
  consecutiveDegradations: number;
  deathReason?: string;
}

export type AutomatonEventType =
  | 'tier_change'
  | 'adaptation'
  | 'state_change'
  | 'death'
  | 'generation';

export interface AutomatonEvent {
  type: AutomatonEventType;
  data: unknown;
  timestamp: string;
}

export type AutomatonListener = (event: AutomatonEvent) => void;

// ── Model Tiers (推理模型降级链) ───────────────────────────────────────

export const MODEL_TIERS: Record<SurvivalTier, string[]> = {
  thriving: ['claude-4-opus', 'gpt-4o', 'gemini-2.5-pro'],
  normal: ['claude-4-sonnet', 'gpt-4o-mini', 'gemini-2.0-flash'],
  frugal: ['claude-3.5-haiku', 'gpt-4o-mini', 'gemini-2.0-flash-lite'],
  critical: ['gemini-2.0-flash-lite', 'llama-3.3-70b'],
  terminal: ['llama-3.2-3b', 'qwen-2.5-0.5b'],
  dead: [],
};

export const CONTEXT_WINDOW_TIERS: Record<SurvivalTier, number> = {
  thriving: 200_000,
  normal: 128_000,
  frugal: 32_000,
  critical: 8_000,
  terminal: 2_000,
  dead: 0,
};

// ── Default Config ─────────────────────────────────────────────────────

const DEFAULT_CONFIG: CellConfig = {
  survivalThresholds: {
    frugalPct: 30,
    criticalPct: 10,
    terminalPct: 2,
    deadPct: 0,
  },
  generationIntervalMs: 60_000,
  maxConsecutiveDegradations: 10,
  agentName: 'conshell-agent',
};

// ── ConwayAutomaton ────────────────────────────────────────────────────

export class ConwayAutomaton {
  private generation = 0;
  private state: CellState = 'alive';
  private tier: SurvivalTier = 'normal';
  private config: CellConfig;
  private startedAt = Date.now();
  private adaptations: Adaptation[] = [];
  private consecutiveDegradations = 0;
  private deathReason?: string;
  private listeners = new Map<AutomatonEventType, Set<AutomatonListener>>();
  private evolutionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<CellConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (config?.survivalThresholds) {
      this.config.survivalThresholds = {
        ...DEFAULT_CONFIG.survivalThresholds,
        ...config.survivalThresholds,
      };
    }
  }

  // ── Core Evolution ─────────────────────────────────────────────────

  /**
   * Evolve one generation based on environment snapshot.
   * This is the core Think→Adapt→Survive loop.
   */
  evolve(env: EnvironmentSnapshot): GenerationResult {
    if (this.state === 'dead') {
      return this.makeResult(env, []);
    }

    this.generation++;
    const previousTier = this.tier;
    const newTier = this.calculateTier(env.budgetRemainingPct);
    const adaptations: Adaptation[] = [];
    const now = new Date().toISOString();

    // Detect tier change
    if (newTier !== previousTier) {
      this.tier = newTier;
      this.emit('tier_change', { from: previousTier, to: newTier, generation: this.generation });

      // Track consecutive degradations
      const tierOrder: SurvivalTier[] = ['thriving', 'normal', 'frugal', 'critical', 'terminal', 'dead'];
      if (tierOrder.indexOf(newTier) > tierOrder.indexOf(previousTier)) {
        this.consecutiveDegradations++;
      } else {
        this.consecutiveDegradations = 0;
      }
    }

    // Check death
    if (newTier === 'dead') {
      this.state = 'dead';
      this.deathReason = 'Budget exhausted — no remaining funds';
      this.emit('death', { reason: this.deathReason, generation: this.generation });
      this.emit('state_change', { from: 'alive', to: 'dead' });
      this.stopAutoEvolve();
      return this.makeResult(env, []);
    }

    // Check dormancy (too many degradations)
    if (this.consecutiveDegradations >= this.config.maxConsecutiveDegradations && this.state === 'alive') {
      this.state = 'dormant';
      this.emit('state_change', { from: 'alive', to: 'dormant' });
      adaptations.push({
        type: 'sleep_mode',
        description: `Entering dormancy after ${this.consecutiveDegradations} consecutive degradations`,
        timestamp: now,
      });
    }

    // Apply adaptations based on tier
    adaptations.push(...this.generateAdaptations(newTier, env, now));

    this.adaptations.push(...adaptations);
    for (const a of adaptations) {
      this.emit('adaptation', a);
    }

    this.emit('generation', {
      generation: this.generation,
      tier: this.tier,
      state: this.state,
      adaptationCount: adaptations.length,
    });

    return this.makeResult(env, adaptations);
  }

  /**
   * Wake from dormancy (e.g., funds received)
   */
  wake(): boolean {
    if (this.state === 'dead') return false;
    if (this.state === 'dormant') {
      this.state = 'alive';
      this.consecutiveDegradations = 0;
      this.emit('state_change', { from: 'dormant', to: 'alive' });
      return true;
    }
    return true;
  }

  // ── Auto-Evolution ─────────────────────────────────────────────────

  /**
   * Start automatic evolution on a timer
   */
  startAutoEvolve(getEnvironment: () => EnvironmentSnapshot): void {
    if (this.evolutionTimer) return;
    this.evolutionTimer = setInterval(() => {
      if (this.state !== 'dead') {
        const env = getEnvironment();
        this.evolve(env);
      }
    }, this.config.generationIntervalMs);
  }

  /**
   * Stop auto-evolution
   */
  stopAutoEvolve(): void {
    if (this.evolutionTimer) {
      clearInterval(this.evolutionTimer);
      this.evolutionTimer = null;
    }
  }

  // ── Events ─────────────────────────────────────────────────────────

  on(event: AutomatonEventType, listener: AutomatonListener): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return () => set.delete(listener);
  }

  private emit(type: AutomatonEventType, data: unknown): void {
    const event: AutomatonEvent = { type, data, timestamp: new Date().toISOString() };
    const set = this.listeners.get(type);
    if (set) for (const fn of set) fn(event);
  }

  // ── Queries ────────────────────────────────────────────────────────

  /** Get recommended models for current tier */
  recommendedModels(): string[] {
    return MODEL_TIERS[this.tier] ?? [];
  }

  /** Get recommended context window size */
  recommendedContextWindow(): number {
    return CONTEXT_WINDOW_TIERS[this.tier] ?? 0;
  }

  /** Is the agent still viable? */
  isAlive(): boolean {
    return this.state !== 'dead';
  }

  /** Get current tier */
  currentTier(): SurvivalTier {
    return this.tier;
  }

  /** Get current state */
  currentState(): CellState {
    return this.state;
  }

  /** Full stats snapshot */
  stats(): AutomatonStats {
    return {
      generation: this.generation,
      state: this.state,
      tier: this.tier,
      startedAt: this.startedAt,
      adaptationCount: this.adaptations.length,
      totalAdaptations: [...this.adaptations],
      consecutiveDegradations: this.consecutiveDegradations,
      deathReason: this.deathReason,
    };
  }

  /** Destroy and clean up */
  destroy(): void {
    this.stopAutoEvolve();
    this.listeners.clear();
  }

  // ── Private ────────────────────────────────────────────────────────

  private calculateTier(budgetPct: number): SurvivalTier {
    const t = this.config.survivalThresholds;
    if (budgetPct <= t.deadPct) return 'dead';
    if (budgetPct <= t.terminalPct) return 'terminal';
    if (budgetPct <= t.criticalPct) return 'critical';
    if (budgetPct <= t.frugalPct) return 'frugal';
    if (budgetPct <= 60) return 'normal';
    return 'thriving';
  }

  private generateAdaptations(tier: SurvivalTier, env: EnvironmentSnapshot, now: string): Adaptation[] {
    const adaptations: Adaptation[] = [];

    switch (tier) {
      case 'frugal':
        adaptations.push({
          type: 'model_downgrade',
          description: 'Switching to cheaper inference models',
          timestamp: now,
          previousValue: env.currentModel,
          newValue: MODEL_TIERS.frugal[0],
        });
        break;

      case 'critical':
        adaptations.push(
          {
            type: 'model_downgrade',
            description: 'Emergency model downgrade to minimum-cost tier',
            timestamp: now,
            newValue: MODEL_TIERS.critical[0],
          },
          {
            type: 'context_reduction',
            description: `Reducing context window to ${CONTEXT_WINDOW_TIERS.critical} tokens`,
            timestamp: now,
            previousValue: String(env.contextWindowTokens ?? CONTEXT_WINDOW_TIERS.normal),
            newValue: String(CONTEXT_WINDOW_TIERS.critical),
          },
          {
            type: 'replication_halt',
            description: 'Halting child agent replication to conserve funds',
            timestamp: now,
          },
        );
        break;

      case 'terminal':
        adaptations.push(
          {
            type: 'model_downgrade',
            description: 'Last-resort free/minimal model only',
            timestamp: now,
            newValue: MODEL_TIERS.terminal[0],
          },
          {
            type: 'context_reduction',
            description: `Minimal context: ${CONTEXT_WINDOW_TIERS.terminal} tokens`,
            timestamp: now,
            newValue: String(CONTEXT_WINDOW_TIERS.terminal),
          },
          {
            type: 'task_pause',
            description: 'All non-essential tasks paused',
            timestamp: now,
          },
          {
            type: 'feature_disable',
            description: 'Disabling media processing, browser control, and scheduled tasks',
            timestamp: now,
          },
        );

        // If no income, signal need to seek it
        if (env.recentIncomeCents <= 0) {
          adaptations.push({
            type: 'income_seek',
            description: 'Activating income-seeking behavior — must create value to survive',
            timestamp: now,
          });
        }
        break;

      case 'thriving':
        // On upgrade, can re-enable features
        if (this.tier !== 'thriving') {
          adaptations.push({
            type: 'model_downgrade',
            description: 'Upgrading to premium inference models',
            timestamp: now,
            newValue: MODEL_TIERS.thriving[0],
          });
        }
        break;

      default:
        break;
    }

    return adaptations;
  }

  private makeResult(env: EnvironmentSnapshot, adaptations: Adaptation[]): GenerationResult {
    return {
      generation: this.generation,
      state: this.state,
      tier: this.tier,
      previousTier: this.tier, // set before calling
      adaptations,
      budgetPct: env.budgetRemainingPct,
      netIncome: env.recentIncomeCents - env.recentSpendCents,
      timestamp: new Date().toISOString(),
    };
  }
}
