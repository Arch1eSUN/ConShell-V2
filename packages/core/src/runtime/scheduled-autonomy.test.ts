/**
 * ScheduledAutonomy — Unit Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { ScheduledAutonomy } from './scheduled-autonomy.js';
import type { AgendaActionSink, DiagnosticsActionSink } from './scheduled-autonomy.js';

const noopLogger = { info: () => {}, warn: () => {}, debug: () => {}, error: () => {}, child: () => noopLogger } as any;

function makeSinks() {
  const agenda: AgendaActionSink = {
    createCommitmentFromRule: vi.fn(),
    requestRevalidation: vi.fn(),
  };
  const diagnostics: DiagnosticsActionSink = {
    runHealthCheck: vi.fn(),
    takePostureSnapshot: vi.fn(),
  };
  return { agenda, diagnostics };
}

describe('ScheduledAutonomy', () => {
  it('registers a rule', () => {
    const { agenda, diagnostics } = makeSinks();
    const sa = new ScheduledAutonomy(agenda, diagnostics, noopLogger);
    const rule = sa.registerRule({
      name: 'Daily check',
      description: 'Daily health check',
      action: 'health_check',
      triggerId: 'wt_1',
    });
    expect(rule.enabled).toBe(true);
    expect(sa.activeRules()).toHaveLength(1);
  });

  it('disables and enables a rule', () => {
    const { agenda, diagnostics } = makeSinks();
    const sa = new ScheduledAutonomy(agenda, diagnostics, noopLogger);
    const rule = sa.registerRule({ name: 'R', description: 'D', action: 'health_check', triggerId: 'wt_1' });
    sa.disableRule(rule.id);
    expect(sa.activeRules()).toHaveLength(0);
    sa.enableRule(rule.id);
    expect(sa.activeRules()).toHaveLength(1);
  });

  it('processes fired triggers and calls health_check', () => {
    const { agenda, diagnostics } = makeSinks();
    const sa = new ScheduledAutonomy(agenda, diagnostics, noopLogger);
    sa.registerRule({ name: 'Health', description: 'D', action: 'health_check', triggerId: 'wt_1' });
    const effects = sa.processFiredTriggers(['wt_1']);
    expect(effects).toHaveLength(1);
    expect(effects[0].result).toBe('executed');
    expect(diagnostics.runHealthCheck).toHaveBeenCalledTimes(1);
  });

  it('processes fired triggers and calls create_commitment', () => {
    const { agenda, diagnostics } = makeSinks();
    const sa = new ScheduledAutonomy(agenda, diagnostics, noopLogger);
    sa.registerRule({
      name: 'Auto task',
      description: 'D',
      action: 'create_commitment',
      triggerId: 'wt_2',
      commitmentTemplate: { name: 'Maintenance', kind: 'maintenance', taskType: 'cleanup', priority: 'low' },
    });
    const effects = sa.processFiredTriggers(['wt_2']);
    expect(agenda.createCommitmentFromRule).toHaveBeenCalledTimes(1);
    expect(effects[0].result).toBe('executed');
  });

  it('processes revalidate_agenda action', () => {
    const { agenda, diagnostics } = makeSinks();
    const sa = new ScheduledAutonomy(agenda, diagnostics, noopLogger);
    sa.registerRule({ name: 'Reval', description: 'D', action: 'revalidate_agenda', triggerId: 'wt_3' });
    sa.processFiredTriggers(['wt_3']);
    expect(agenda.requestRevalidation).toHaveBeenCalledTimes(1);
  });

  it('processes posture_snapshot action', () => {
    const { agenda, diagnostics } = makeSinks();
    const sa = new ScheduledAutonomy(agenda, diagnostics, noopLogger);
    sa.registerRule({ name: 'Posture', description: 'D', action: 'posture_snapshot', triggerId: 'wt_4' });
    sa.processFiredTriggers(['wt_4']);
    expect(diagnostics.takePostureSnapshot).toHaveBeenCalledTimes(1);
  });

  it('skips disabled rules', () => {
    const { agenda, diagnostics } = makeSinks();
    const sa = new ScheduledAutonomy(agenda, diagnostics, noopLogger);
    const rule = sa.registerRule({ name: 'Off', description: 'D', action: 'health_check', triggerId: 'wt_5' });
    sa.disableRule(rule.id);
    const effects = sa.processFiredTriggers(['wt_5']);
    expect(effects).toHaveLength(0);
  });

  it('handles no matching triggers gracefully', () => {
    const { agenda, diagnostics } = makeSinks();
    const sa = new ScheduledAutonomy(agenda, diagnostics, noopLogger);
    const effects = sa.processFiredTriggers(['wt_unknown']);
    expect(effects).toHaveLength(0);
  });

  it('handles action failures', () => {
    const agenda: AgendaActionSink = {
      createCommitmentFromRule: () => { throw new Error('boom'); },
      requestRevalidation: vi.fn(),
    };
    const diagnostics: DiagnosticsActionSink = {
      runHealthCheck: vi.fn(),
      takePostureSnapshot: vi.fn(),
    };
    const sa = new ScheduledAutonomy(agenda, diagnostics, noopLogger);
    sa.registerRule({ name: 'Fail', description: 'D', action: 'create_commitment', triggerId: 'wt_6' });
    const effects = sa.processFiredTriggers(['wt_6']);
    expect(effects[0].result).toBe('failed');
    expect(effects[0].reason).toContain('boom');
  });

  it('tracks stats', () => {
    const { agenda, diagnostics } = makeSinks();
    const sa = new ScheduledAutonomy(agenda, diagnostics, noopLogger);
    sa.registerRule({ name: 'A', description: 'D', action: 'health_check', triggerId: 'wt_1' });
    sa.processFiredTriggers(['wt_1']);
    const stats = sa.stats();
    expect(stats.totalRules).toBe(1);
    expect(stats.executedEffects).toBe(1);
  });
});
