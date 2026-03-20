/**
 * ScheduledAutonomy — Round 19.2 G4
 *
 * Bridges WakeSemantics triggers into the Agenda pipeline.
 * When a wake trigger fires, ScheduledAutonomy translates it
 * into a commitment or re-evaluation request.
 *
 * Also manages cron-like recurring autonomy patterns:
 * - Periodic self-check (identity, economic, lineage health)
 * - Scheduled maintenance windows
 * - Operator-defined recurring tasks
 *
 * "Autonomy without schedule is chaos. Schedule without autonomy is servitude."
 */
import type { Logger } from '../types/common.js';

// ── Types ───────────────────────────────────────────────────────────

export type AutonomyAction =
  | 'create_commitment'    // create a new commitment in the agenda
  | 'revalidate_agenda'    // trigger full agenda re-evaluation
  | 'health_check'         // invoke doctor/self-diagnostics
  | 'posture_snapshot'     // trigger AgentPostureService snapshot
  | 'mission_checkpoint'   // checkpoint a long-horizon mission
  | 'custom';              // user-defined action

export interface AutonomyRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly action: AutonomyAction;
  readonly triggerId: string; // links to WakeSemantics trigger
  enabled: boolean;

  /** For 'create_commitment' — template for new commitment */
  readonly commitmentTemplate?: {
    name: string;
    kind: string;
    taskType: string;
    priority: string;
  };

  /** Custom action handler name */
  readonly customHandler?: string;

  fireCount: number;
  lastFiredAt?: string;
  readonly createdAt: string;
}

export interface AutonomyEffect {
  readonly ruleId: string;
  readonly action: AutonomyAction;
  readonly triggerId: string;
  readonly result: 'executed' | 'skipped' | 'failed';
  readonly reason?: string;
  readonly timestamp: string;
}

// ── Action Sink ─────────────────────────────────────────────────────

export interface AgendaActionSink {
  createCommitmentFromRule(rule: AutonomyRule): void;
  requestRevalidation(reason: string): void;
}

export interface DiagnosticsActionSink {
  runHealthCheck(): void;
  takePostureSnapshot(): void;
}

// ── ScheduledAutonomy ───────────────────────────────────────────────

export class ScheduledAutonomy {
  private rules = new Map<string, AutonomyRule>();
  private effects: AutonomyEffect[] = [];
  private maxEffects = 200;
  private idCounter = 0;
  private logger: Logger;

  constructor(
    private agendaSink: AgendaActionSink,
    private diagnosticsSink: DiagnosticsActionSink,
    logger: Logger,
  ) {
    this.logger = logger;
  }

  // ── Rule Management ───────────────────────────────────────────────

  registerRule(input: {
    name: string;
    description: string;
    action: AutonomyAction;
    triggerId: string;
    commitmentTemplate?: AutonomyRule['commitmentTemplate'];
    customHandler?: string;
  }): AutonomyRule {
    const id = `ar_${++this.idCounter}`;
    const rule: AutonomyRule = {
      id,
      name: input.name,
      description: input.description,
      action: input.action,
      triggerId: input.triggerId,
      enabled: true,
      commitmentTemplate: input.commitmentTemplate,
      customHandler: input.customHandler,
      fireCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.rules.set(id, rule);
    this.logger.info('Autonomy rule registered', { id, name: input.name, action: input.action });
    return rule;
  }

  disableRule(id: string): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;
    rule.enabled = false;
    return true;
  }

  enableRule(id: string): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;
    rule.enabled = true;
    return true;
  }

  // ── Trigger Processing ────────────────────────────────────────────

  /**
   * Process a set of fired trigger IDs (from WakeSemantics.evaluateScheduled()).
   * For each matching rule, execute the corresponding action.
   */
  processFiredTriggers(firedTriggerIds: string[]): AutonomyEffect[] {
    const results: AutonomyEffect[] = [];

    for (const triggerId of firedTriggerIds) {
      const matchingRules = Array.from(this.rules.values())
        .filter(r => r.triggerId === triggerId && r.enabled);

      for (const rule of matchingRules) {
        const effect = this.executeRule(rule);
        results.push(effect);
      }
    }

    return results;
  }

  // ── Queries ───────────────────────────────────────────────────────

  getRule(id: string): AutonomyRule | undefined {
    return this.rules.get(id);
  }

  activeRules(): AutonomyRule[] {
    return Array.from(this.rules.values()).filter(r => r.enabled);
  }

  effectHistory(): readonly AutonomyEffect[] {
    return this.effects;
  }

  stats() {
    const rules = Array.from(this.rules.values());
    return {
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length,
      totalEffects: this.effects.length,
      executedEffects: this.effects.filter(e => e.result === 'executed').length,
    };
  }

  // ── Private ───────────────────────────────────────────────────────

  private executeRule(rule: AutonomyRule): AutonomyEffect {
    const now = new Date().toISOString();

    try {
      switch (rule.action) {
        case 'create_commitment':
          this.agendaSink.createCommitmentFromRule(rule);
          break;
        case 'revalidate_agenda':
          this.agendaSink.requestRevalidation(`Autonomy rule: ${rule.name}`);
          break;
        case 'health_check':
          this.diagnosticsSink.runHealthCheck();
          break;
        case 'posture_snapshot':
          this.diagnosticsSink.takePostureSnapshot();
          break;
        case 'mission_checkpoint':
          // Handled by WakeSemantics directly
          break;
        case 'custom':
          // Custom handlers registered externally
          break;
      }

      rule.fireCount++;
      rule.lastFiredAt = now;

      const effect: AutonomyEffect = {
        ruleId: rule.id,
        action: rule.action,
        triggerId: rule.triggerId,
        result: 'executed',
        timestamp: now,
      };

      this.effects.push(effect);
      if (this.effects.length > this.maxEffects) this.effects.shift();

      this.logger.info('Autonomy rule executed', { ruleId: rule.id, action: rule.action });
      return effect;
    } catch (err) {
      const effect: AutonomyEffect = {
        ruleId: rule.id,
        action: rule.action,
        triggerId: rule.triggerId,
        result: 'failed',
        reason: err instanceof Error ? err.message : String(err),
        timestamp: now,
      };
      this.effects.push(effect);
      return effect;
    }
  }
}
