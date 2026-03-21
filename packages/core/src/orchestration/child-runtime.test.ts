/**
 * Round 20.4 — Governed Child Runtime Tests
 *
 * Tests for ChildFundingLease, ChildSession 6-state FSM (pause/resume),
 * SessionRegistry reporting/governance, and childRuntimeSummary.
 */
import { describe, it, expect } from 'vitest';
import { ChildFundingLease, createFundingLease } from './child-funding-lease.js';
import { ChildSession, createChildSession, type ChildGovernanceAction } from './child-session.js';
import { SessionRegistry, type ChildProgressReport } from './session-registry.js';

// ── ChildFundingLease ───────────────────────────────────────────────

describe('ChildFundingLease', () => {
  const baseCfg = () => ({
    sessionId: 'csn_test',
    allocatedCents: 1000,
    reserveFreezeCents: 1000,
    spendCeilingCents: 500,
    purpose: 'test-task',
    expectedUtilityCents: 1500,
  });

  it('creates with active status and correct fields', () => {
    const lease = createFundingLease(baseCfg());
    expect(lease.status).toBe('active');
    expect(lease.allocatedCents).toBe(1000);
    expect(lease.spentCents).toBe(0);
    expect(lease.remainingCents).toBe(1000);
    expect(lease.utilizationPercent).toBe(0);
    expect(lease.isTerminal).toBe(false);
    expect(lease.leaseId).toMatch(/^lease_/);
  });

  it('records spend and reduces remaining', () => {
    const lease = createFundingLease(baseCfg());
    const remaining = lease.recordSpend(300);
    expect(remaining).toBe(700);
    expect(lease.spentCents).toBe(300);
    expect(lease.utilizationPercent).toBe(30);
  });

  it('enforces per-spend ceiling', () => {
    const lease = createFundingLease(baseCfg());
    expect(() => lease.recordSpend(600)).toThrow('exceeds per-spend ceiling');
  });

  it('enforces total budget limit', () => {
    const lease = createFundingLease(baseCfg());
    lease.recordSpend(400);
    lease.recordSpend(400);
    expect(() => lease.recordSpend(300)).toThrow('would exceed allocated budget');
  });

  it('auto-transitions to exhausted when budget fully consumed', () => {
    const lease = createFundingLease({ ...baseCfg(), spendCeilingCents: 0 });
    lease.recordSpend(1000);
    expect(lease.status).toBe('exhausted');
    expect(lease.isTerminal).toBe(true);
    expect(lease.remainingCents).toBe(0);
    expect(lease.utilizationPercent).toBe(100);
  });

  it('blocks spend on non-active lease', () => {
    const lease = createFundingLease(baseCfg());
    lease.revoke('budget cut');
    expect(() => lease.recordSpend(100)).toThrow('Cannot spend on lease in status');
  });

  it('revokes with reason and timestamp', () => {
    const lease = createFundingLease(baseCfg());
    lease.revoke('governance recall');
    expect(lease.status).toBe('revoked');
    expect(lease.revokeReason).toBe('governance recall');
    expect(lease.revokedAt).toBeDefined();
    expect(lease.isTerminal).toBe(true);
  });

  it('expires lease', () => {
    const lease = createFundingLease(baseCfg());
    lease.expire();
    expect(lease.status).toBe('expired');
    expect(lease.isTerminal).toBe(true);
  });

  it('settles active lease', () => {
    const lease = createFundingLease(baseCfg());
    lease.recordSpend(200);
    lease.settle();
    expect(lease.status).toBe('settled');
    expect(lease.settledAt).toBeDefined();
    expect(lease.isTerminal).toBe(true);
  });

  it('prevents double terminal transitions', () => {
    const lease = createFundingLease(baseCfg());
    lease.revoke('done');
    expect(() => lease.expire()).toThrow('terminal status');
    expect(() => lease.revoke('again')).toThrow('terminal status');
  });

  it('checkExpiry auto-expires when time exceeds', () => {
    const past = new Date(Date.now() - 60000).toISOString();
    const lease = createFundingLease({ ...baseCfg(), expiresAt: past });
    const expired = lease.checkExpiry();
    expect(expired).toBe(true);
    expect(lease.status).toBe('expired');
  });

  it('checkExpiry does not expire if before deadline', () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    const lease = createFundingLease({ ...baseCfg(), expiresAt: future });
    const expired = lease.checkExpiry();
    expect(expired).toBe(false);
    expect(lease.status).toBe('active');
  });

  it('serializes to JSON with all fields', () => {
    const lease = createFundingLease(baseCfg());
    lease.recordSpend(250);
    const json = lease.toJSON();
    expect(json.status).toBe('active');
    expect(json.spentCents).toBe(250);
    expect(json.remainingCents).toBe(750);
    expect(json.utilizationPercent).toBe(25);
    expect(json.purpose).toBe('test-task');
  });
});

// ── ChildSession 6-state (Round 20.4) ──────────────────────────────

describe('ChildSession 6-state (Round 20.4)', () => {
  it('supports pause → resume flow', () => {
    const s = createChildSession({
      name: 'pausable',
      manifest: { role: 'worker', task: 'long compute' },
      budgetCents: 500,
    });
    s.start();
    s.pause('economic pressure');
    expect(s.status).toBe('paused');
    expect(s.pausedAt).toBeDefined();

    s.resume();
    expect(s.status).toBe('running');
    expect(s.pausedAt).toBeUndefined();
  });

  it('allows recall from paused state', () => {
    const s = createChildSession({
      name: 'paused-recall',
      manifest: { role: 'worker', task: 'interruptible' },
      budgetCents: 200,
    });
    s.start();
    s.pause();
    s.recall('budget exhausted');
    expect(s.status).toBe('recalled');
    expect(s.recallReason).toBe('budget exhausted');
  });

  it('prevents pause on non-running session', () => {
    const s = createChildSession({
      name: 'bad-pause',
      manifest: { role: 'worker', task: 'test' },
      budgetCents: 100,
    });
    expect(() => s.pause()).toThrow('Cannot pause');
  });

  it('prevents resume on non-paused session', () => {
    const s = createChildSession({
      name: 'bad-resume',
      manifest: { role: 'worker', task: 'test' },
      budgetCents: 100,
    });
    s.start();
    expect(() => s.resume()).toThrow('Cannot resume');
  });

  it('stores leaseId when provided', () => {
    const s = createChildSession({
      name: 'funded',
      manifest: { role: 'worker', task: 'test' },
      budgetCents: 500,
      leaseId: 'lease_abc',
    });
    expect(s.leaseId).toBe('lease_abc');
    expect(s.toJSON().leaseId).toBe('lease_abc');
  });

  it('supports merge result on completion', () => {
    const s = createChildSession({
      name: 'merger',
      manifest: { role: 'researcher', task: 'research' },
      budgetCents: 300,
    });
    s.start();
    s.complete('Found 5 results', 'merge into parent context');
    expect(s.resultSummary).toBe('Found 5 results');
    expect(s.mergeResult).toBe('merge into parent context');
    expect(s.toJSON().mergeResult).toBe('merge into parent context');
  });

  it('manifest includes specialization fields', () => {
    const s = createChildSession({
      name: 'specialist',
      manifest: {
        role: 'researcher',
        task: 'deep analysis',
        scope: 'economic data only',
        expectedCapabilities: ['web_search', 'data_analysis'],
        allowedToolCategories: ['search', 'compute'],
        reportingExpectation: {
          heartbeatIntervalMs: 30000,
          checkpointFrequency: 'per-milestone',
        },
        specialization: 'economic-researcher',
      },
      budgetCents: 1000,
    });
    expect(s.manifest.scope).toBe('economic data only');
    expect(s.manifest.expectedCapabilities).toContain('web_search');
    expect(s.manifest.specialization).toBe('economic-researcher');
    expect(s.manifest.reportingExpectation?.heartbeatIntervalMs).toBe(30000);
  });
});

// ── SessionRegistry Reporting + Governance (Round 20.4) ─────────────

describe('SessionRegistry Round 20.4', () => {
  it('manages leases (register, get, list)', () => {
    const registry = new SessionRegistry();
    const lease = createFundingLease({
      sessionId: 'csn_x',
      allocatedCents: 1000,
      reserveFreezeCents: 1000,
      spendCeilingCents: 500,
      purpose: 'test',
      expectedUtilityCents: 1500,
    });

    registry.registerLease(lease);
    expect(registry.getLease(lease.leaseId)).toBe(lease);
    expect(registry.getSessionLease('csn_x')).toBe(lease);
    expect(registry.listLeases().length).toBe(1);
    expect(registry.listLeases({ status: 'active' }).length).toBe(1);
  });

  it('submits and retrieves progress reports', () => {
    const registry = new SessionRegistry();
    const report: ChildProgressReport = {
      sessionId: 'csn_r',
      kind: 'checkpoint',
      progress: 50,
      budgetUsedCents: 200,
      checkpoint: 'Phase 1 complete',
      findings: 'Found 3 potential targets',
      risks: ['budget running high'],
      reportedAt: new Date().toISOString(),
    };

    registry.submitReport(report);
    expect(registry.getReports('csn_r').length).toBe(1);
    expect(registry.getLatestReport('csn_r')?.progress).toBe(50);

    // Second report
    registry.submitReport({
      sessionId: 'csn_r',
      kind: 'heartbeat',
      progress: 75,
      budgetUsedCents: 350,
      reportedAt: new Date().toISOString(),
    });
    expect(registry.getReports('csn_r').length).toBe(2);
    expect(registry.getLatestReport('csn_r')?.progress).toBe(75);
  });

  it('returns empty for unknown session reports', () => {
    const registry = new SessionRegistry();
    expect(registry.getReports('nonexistent').length).toBe(0);
    expect(registry.getLatestReport('nonexistent')).toBeUndefined();
  });

  it('records and retrieves governance actions', () => {
    const registry = new SessionRegistry();
    const action: ChildGovernanceAction = {
      actionType: 'pause',
      sessionId: 'csn_g',
      actor: 'governance',
      reason: 'economic pressure',
      fromStatus: 'running',
      toStatus: 'paused',
      leaseImpact: 'frozen',
      timestamp: new Date().toISOString(),
    };

    registry.recordGovernanceAction(action);
    expect(registry.getGovernanceActions().length).toBe(1);
    expect(registry.getGovernanceActions('csn_g').length).toBe(1);
    expect(registry.getGovernanceActions('csn_other').length).toBe(0);
  });

  it('produces childRuntimeSummary for truth surface', () => {
    const registry = new SessionRegistry();

    // Register sessions
    const s1 = createChildSession({ name: 'a', manifest: { role: 'w', task: 't' }, budgetCents: 500 });
    s1.start();
    const s2 = createChildSession({ name: 'b', manifest: { role: 'w', task: 't' }, budgetCents: 300 });
    s2.start();
    s2.complete('done');

    registry.registerSession(s1);
    registry.registerSession(s2);

    // Register lease
    const lease = createFundingLease({
      sessionId: s1.id,
      allocatedCents: 500,
      reserveFreezeCents: 500,
      spendCeilingCents: 0,
      purpose: 'test',
      expectedUtilityCents: 800,
    });
    lease.recordSpend(100);
    registry.registerLease(lease);

    // Record action
    registry.recordGovernanceAction({
      actionType: 'start',
      sessionId: s1.id,
      actor: 'system',
      reason: 'auto-start',
      fromStatus: 'pending',
      toStatus: 'running',
      timestamp: new Date().toISOString(),
    });

    const summary = registry.childRuntimeSummary();
    expect(summary.activeChildren).toBe(1);
    expect(summary.totalChildren).toBe(2);
    expect(summary.statusBreakdown['running']).toBe(1);
    expect(summary.statusBreakdown['completed']).toBe(1);
    expect(summary.leaseSummary.totalAllocatedCents).toBe(500);
    expect(summary.leaseSummary.totalSpentCents).toBe(100);
    expect(summary.leaseSummary.activeLeases).toBe(1);
    expect(summary.recentOutcomes.length).toBe(1);
    expect(summary.recentGovernanceActions.length).toBe(1);
    expect(summary.generatedAt).toBeDefined();
  });

  it('diagnostics include Round 20.4 fields', () => {
    const registry = new SessionRegistry();

    const lease = createFundingLease({
      sessionId: 'csn_diag',
      allocatedCents: 500,
      reserveFreezeCents: 500,
      spendCeilingCents: 0,
      purpose: 'test',
      expectedUtilityCents: 800,
    });
    registry.registerLease(lease);

    registry.submitReport({
      sessionId: 'csn_diag',
      kind: 'heartbeat',
      progress: 25,
      budgetUsedCents: 50,
      reportedAt: new Date().toISOString(),
    });

    registry.recordGovernanceAction({
      actionType: 'start',
      sessionId: 'csn_diag',
      actor: 'system',
      reason: 'init',
      fromStatus: 'pending',
      toStatus: 'running',
      timestamp: new Date().toISOString(),
    });

    const diag = registry.diagnostics();
    expect(diag.totalLeases).toBe(1);
    expect(diag.leasesByStatus['active']).toBe(1);
    expect(diag.totalReports).toBe(1);
    expect(diag.totalGovernanceActions).toBe(1);
  });
});
