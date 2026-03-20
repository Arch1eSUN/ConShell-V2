/**
 * ConflictReasoner — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { ConflictReasoner } from './conflict-reasoner.js';
import type { AgendaStateProvider, ExecutionContextProvider } from './conflict-reasoner.js';
import type { Commitment } from '../agenda/commitment-model.js';

function makeCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: 'cmt-1',
    name: 'Test Task',
    kind: 'maintenance',
    origin: 'self',
    status: 'active',
    priority: 'normal',
    expectedValueCents: 100,
    estimatedCostCents: 50,
    mustPreserve: false,
    revenueBearing: false,
    taskType: 'health-check',
    materializedTaskCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProviders(overrides: {
  getCommitment?: (id: string) => Commitment | undefined;
  findSimilar?: (c: Commitment) => Commitment[];
  currentFingerprint?: () => string;
  currentSurvivalTier?: () => string;
} = {}) {
  const agenda: AgendaStateProvider = {
    getCommitment: overrides.getCommitment ?? ((id: string) => makeCommitment({ id })),
    findSimilar: overrides.findSimilar ?? (() => []),
  };
  const context: ExecutionContextProvider = {
    currentFingerprint: overrides.currentFingerprint ?? (() => 'fp-abc'),
    currentSurvivalTier: overrides.currentSurvivalTier ?? (() => 'normal'),
  };
  return { agenda, context };
}

const noopLogger = { info: () => {}, warn: () => {}, debug: () => {}, error: () => {}, child: () => noopLogger } as any;

describe('ConflictReasoner', () => {
  it('returns proceed when no conflicts', () => {
    const { agenda, context } = makeProviders();
    const r = new ConflictReasoner(agenda, context, noopLogger);
    const report = r.evaluate(makeCommitment());
    expect(report.resolution).toBe('proceed');
    expect(report.conflicts).toHaveLength(0);
  });

  it('detects stale — commitment no longer in agenda', () => {
    const { agenda, context } = makeProviders({
      getCommitment: () => undefined,
    });
    const r = new ConflictReasoner(agenda, context, noopLogger);
    const report = r.evaluate(makeCommitment());
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0].kind).toBe('stale');
    expect(report.conflicts[0].severity).toBe('blocking');
    expect(report.resolution).toBe('abandon');
  });

  it('detects stale — status divergence (blocking for terminal)', () => {
    const { agenda, context } = makeProviders({
      getCommitment: (id) => makeCommitment({ id, status: 'abandoned' }),
    });
    const r = new ConflictReasoner(agenda, context, noopLogger);
    const report = r.evaluate(makeCommitment({ status: 'active' }));
    const stale = report.conflicts.filter(c => c.kind === 'stale');
    expect(stale.length).toBeGreaterThanOrEqual(1);
    expect(stale.some(s => s.severity === 'blocking')).toBe(true);
  });

  it('detects stale — data updated since materialization', () => {
    const { agenda, context } = makeProviders({
      getCommitment: (id) => makeCommitment({ id, updatedAt: '2026-02-01T00:00:00Z' }),
    });
    const r = new ConflictReasoner(agenda, context, noopLogger);
    const report = r.evaluate(makeCommitment({ updatedAt: '2026-01-01T00:00:00Z' }));
    const staleData = report.conflicts.find(c => c.message.includes('updated since'));
    expect(staleData).toBeDefined();
    expect(staleData!.severity).toBe('warning');
  });

  it('detects duplicate — same taskType active', () => {
    const dupe = makeCommitment({ id: 'cmt-dupe', status: 'active', taskType: 'health-check' });
    const { agenda, context } = makeProviders({
      findSimilar: () => [dupe],
    });
    const r = new ConflictReasoner(agenda, context, noopLogger);
    const report = r.evaluate(makeCommitment());
    const dup = report.conflicts.find(c => c.kind === 'duplicate');
    expect(dup).toBeDefined();
  });

  it('detects live_drift — fingerprint changed', () => {
    const { agenda, context } = makeProviders({
      currentFingerprint: () => 'fp-CHANGED',
    });
    const r = new ConflictReasoner(agenda, context, noopLogger);
    const c = makeCommitment({
      identityContext: {
        identityId: 'id-1',
        fingerprint: 'fp-original',
        status: 'active',
      },
    });
    const report = r.evaluate(c);
    const drift = report.conflicts.find(c => c.kind === 'live_drift');
    expect(drift).toBeDefined();
  });

  it('detects partial_restore — crash recovery with prior tasks', () => {
    const { agenda, context } = makeProviders();
    const r = new ConflictReasoner(agenda, context, noopLogger);
    const report = r.evaluate(makeCommitment({
      recoveredFromCrash: true,
      materializedTaskCount: 3,
    }));
    const partial = report.conflicts.find(c => c.kind === 'partial_restore');
    expect(partial).toBeDefined();
  });

  it('detects superseded — newer commitment exists', () => {
    const newer = makeCommitment({
      id: 'cmt-newer',
      status: 'active',
      taskType: 'health-check',
      createdAt: '2026-06-01T00:00:00Z',
    });
    const { agenda, context } = makeProviders({
      findSimilar: () => [newer],
    });
    const r = new ConflictReasoner(agenda, context, noopLogger);
    const report = r.evaluate(makeCommitment({ createdAt: '2026-01-01T00:00:00Z' }));
    expect(report.resolution).toBe('abandon');
  });

  it('revalidates when 3+ warnings accumulate', () => {
    const dupe = makeCommitment({ id: 'cmt-dupe', status: 'active', taskType: 'health-check' });
    const { agenda, context } = makeProviders({
      getCommitment: (id) => makeCommitment({ id, updatedAt: '2026-02-01T00:00:00Z' }),
      findSimilar: () => [dupe],
      currentFingerprint: () => 'fp-CHANGED',
    });
    const r = new ConflictReasoner(agenda, context, noopLogger);
    const report = r.evaluate(makeCommitment({
      updatedAt: '2026-01-01T00:00:00Z',
      identityContext: { identityId: 'id-1', fingerprint: 'fp-original', status: 'active' },
      recoveredFromCrash: true,
      materializedTaskCount: 1,
    }));
    // Should have stale(data), duplicate, live_drift, partial_restore = 4 warnings
    expect(report.resolution).toBe('revalidate');
  });

  it('tracks stats', () => {
    const { agenda, context } = makeProviders();
    const r = new ConflictReasoner(agenda, context, noopLogger);
    r.evaluate(makeCommitment());
    r.evaluate(makeCommitment());
    const stats = r.stats();
    expect(stats.total).toBe(2);
    expect(stats.proceeded).toBe(2);
  });
});
