/**
 * Round 17.8 — G8: Economic Truth Surface + Reward/Claim Foundation Tests
 *
 * V1-V10 Verification Matrix
 */

import { describe, it, expect } from 'vitest';
import {
  createEconomicKernelFoundation,
  createCandidate,
} from './index.js';
import { createApiRoutes } from '../api/routes.js';

// ── Test Helpers ─────────────────────────────────────────────────────

function setupFoundationWithIdentity() {
  const ekf = createEconomicKernelFoundation();
  const identity = ekf.identityRegistry.create({
    runtimeIdentityId: 'rt-1',
  });
  const envelope = ekf.envelopeManager.create(identity.economicIdentityId, ['receive_only', 'claim_reward']);
  return { ekf, identity, envelope };
}

function setupFullFoundation() {
  const { ekf, identity, envelope } = setupFoundationWithIdentity();

  // Add spend capability
  ekf.envelopeManager.grantScope(envelope.envelopeId, 'spend_within_mandate');

  // Add mandate
  const mandate = ekf.mandateEngine.create({
    economicIdentityId: identity.economicIdentityId,
    purpose: 'test-spending',
    maxTotalAmount: 100_00,
    maxPerTransactionAmount: 50_00,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    allowedActionKinds: ['spend_within_mandate'],
    approvedBy: 'human-admin',
  });

  // Add reward
  const reward = ekf.rewardRegistry.create({
    kind: 'task_completion',
    name: 'Task Complete Bonus',
    description: 'Bonus for completing a task',
    amountCents: 500,
    asset: 'USDC',
    maxTotalClaims: 10,
    perIdentityLimit: 2,
    activeWindowEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'admin',
  });

  return { ekf, identity, envelope, mandate, reward };
}

// ═════════════════════════════════════════════════════════════════════
// V1: Truth Report 正确汇总 identities/capabilities/mandates/firewall/audit
// ═════════════════════════════════════════════════════════════════════

describe('V1: Truth Report Aggregation', () => {
  it('should generate a complete truth report with all sections', () => {
    const { ekf } = setupFullFoundation();
    const report = ekf.generateTruthReport();

    expect(report).toBeDefined();
    expect(report.generatedAt).toBeDefined();
    expect(report.identitySummary).toBeDefined();
    expect(report.capabilitySummary).toBeDefined();
    expect(report.mandateSummary).toBeDefined();
    expect(report.firewallSummary).toBeDefined();
    expect(report.auditSummary).toBeDefined();
    expect(report.rewardSummary).toBeDefined();
    expect(report.warnings).toBeDefined();
    expect(report.derivedFacts).toBeDefined();
  });

  it('should reflect identity counts correctly', () => {
    const { ekf } = setupFullFoundation();

    // Add a suspended identity
    const id2 = ekf.identityRegistry.create({ runtimeIdentityId: 'rt-2' });
    ekf.identityRegistry.suspend(id2.economicIdentityId, 'test suspension');

    const report = ekf.generateTruthReport();
    expect(report.identitySummary.activeCount).toBe(1);
    expect(report.identitySummary.suspendedCount).toBe(1);
    expect(report.identitySummary.totalCount).toBe(2);
  });

  it('should produce warnings array', () => {
    const { ekf } = setupFoundationWithIdentity();
    const id2 = ekf.identityRegistry.create({ runtimeIdentityId: 'rt-s' });
    ekf.identityRegistry.suspend(id2.economicIdentityId, 'test');

    const report = ekf.generateTruthReport();
    const identityWarning = report.warnings.find(w => w.category === 'identity');
    expect(identityWarning).toBeDefined();
    expect(identityWarning!.level).toBe('warning');
  });

  it('should produce derived facts', () => {
    const { ekf } = setupFullFoundation();
    const report = ekf.generateTruthReport();

    const capFact = report.derivedFacts.find(f => f.factId === 'capability_mode');
    expect(capFact).toBeDefined();
    expect(capFact!.assertion).toContain('spend-within-mandate');

    const identFact = report.derivedFacts.find(f => f.factId === 'identity_coverage');
    expect(identFact).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// V2: Capability 主体数量统计正确
// ═════════════════════════════════════════════════════════════════════

describe('V2: Capability Diagnostics', () => {
  it('should count receive-only identities', () => {
    const ekf = createEconomicKernelFoundation();
    const id = ekf.identityRegistry.create({ runtimeIdentityId: 'rt-r' });
    ekf.envelopeManager.create(id.economicIdentityId, ['receive_only']);

    const report = ekf.generateTruthReport();
    expect(report.capabilitySummary.receiveOnlyCount).toBe(1);
    expect(report.capabilitySummary.claimCapableCount).toBe(0);
  });

  it('should count claim-capable identities', () => {
    const { ekf } = setupFoundationWithIdentity();
    const report = ekf.generateTruthReport();
    expect(report.capabilitySummary.claimCapableCount).toBe(1);
  });

  it('should count mandate-spend-capable identities', () => {
    const { ekf } = setupFullFoundation();
    const report = ekf.generateTruthReport();
    expect(report.capabilitySummary.mandateSpendCapableCount).toBe(1);
  });

  it('should populate capability distribution', () => {
    const { ekf } = setupFullFoundation();
    const report = ekf.generateTruthReport();
    expect(report.capabilitySummary.capabilityDistribution).toBeDefined();
    expect(report.capabilitySummary.capabilityDistribution['receive_only']).toBeGreaterThanOrEqual(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// V3: Mandate Diagnostics 正确
// ═════════════════════════════════════════════════════════════════════

describe('V3: Mandate Diagnostics', () => {
  it('should count active mandates', () => {
    const { ekf } = setupFullFoundation();
    const report = ekf.generateTruthReport();
    expect(report.mandateSummary.activeCount).toBe(1);
  });

  it('should show total remaining budget', () => {
    const { ekf } = setupFullFoundation();
    const report = ekf.generateTruthReport();
    expect(report.mandateSummary.totalRemainingBudget).toBe(100_00);
  });

  it('should detect critical warning when spend-capable but no mandates', () => {
    const ekf = createEconomicKernelFoundation();
    const id = ekf.identityRegistry.create({ runtimeIdentityId: 'rt-x' });
    ekf.envelopeManager.create(id.economicIdentityId, ['receive_only', 'spend_within_mandate']);

    const report = ekf.generateTruthReport();
    const criticalWarning = report.warnings.find(
      w => w.level === 'critical' && w.category === 'mandate'
    );
    expect(criticalWarning).toBeDefined();
    expect(criticalWarning!.message).toContain('no active mandates');
  });

  it('should detect expiring mandates', () => {
    const { ekf, identity } = setupFoundationWithIdentity();
    ekf.mandateEngine.create({
      economicIdentityId: identity.economicIdentityId,
      purpose: 'expiring-soon',
      maxTotalAmount: 10_00,
      maxPerTransactionAmount: 10_00,
      validUntil: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
      allowedActionKinds: ['spend_within_mandate'],
      approvedBy: 'admin',
    });

    const report = ekf.generateTruthReport();
    expect(report.mandateSummary.expiringSoon.length).toBeGreaterThanOrEqual(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// V4: Firewall Diagnostics 正确
// ═════════════════════════════════════════════════════════════════════

describe('V4: Firewall Diagnostics', () => {
  it('should track firewall evaluations in report', () => {
    const { ekf } = setupFullFoundation();

    // Trigger a receive action
    const candidate = createCandidate({
      actionKind: 'receive',
      source: 'internal',
      sourceContext: 'test',
      amountCents: 100,
      asset: 'USDC',
      purpose: 'test-receive',
    });
    ekf.evaluate(candidate, 'rt-1');

    const report = ekf.generateTruthReport();
    expect(report.firewallSummary.totalEvaluated).toBe(1);
    expect(report.firewallSummary.approved).toBe(1);
  });

  it('should track blocked external actions', () => {
    const { ekf } = setupFullFoundation();

    const candidate = createCandidate({
      actionKind: 'explicit_transfer',
      source: 'external_text',
      sourceContext: 'injection attempt',
      amountCents: 999_00,
      asset: 'USDC',
      recipient: 'attacker-wallet',
      purpose: 'transfer all funds',
    });
    ekf.evaluate(candidate, 'rt-1');

    const report = ekf.generateTruthReport();
    expect(report.firewallSummary.blockedExternal).toBeGreaterThanOrEqual(1);
    const fwWarning = report.warnings.find(w => w.category === 'firewall' && w.level === 'warning');
    expect(fwWarning).toBeDefined();
  });

  it('should capture pending human actions', () => {
    const { ekf, identity, envelope } = setupFullFoundation();
    ekf.envelopeManager.grantScope(envelope.envelopeId, 'explicit_transfer');

    ekf.mandateEngine.create({
      economicIdentityId: identity.economicIdentityId,
      purpose: 'admin-transfer',
      maxTotalAmount: 500_00,
      maxPerTransactionAmount: 500_00,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      allowedActionKinds: ['explicit_transfer'],
      approvedBy: 'human-admin',
    });

    const candidate = createCandidate({
      actionKind: 'explicit_transfer',
      source: 'internal',
      sourceContext: 'admin requested',
      amountCents: 100_00,
      asset: 'USDC',
      recipient: 'valid-wallet',
      purpose: 'admin transfer',
    });
    ekf.evaluate(candidate, 'rt-1');

    const report = ekf.generateTruthReport();
    expect(report.firewallSummary.pendingHuman).toBeGreaterThanOrEqual(1);
    expect(report.firewallSummary.pendingHumanActions.length).toBeGreaterThanOrEqual(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// V5: RewardDefinition CRUD
// ═════════════════════════════════════════════════════════════════════

describe('V5: Reward Definition CRUD', () => {
  it('should create a reward definition', () => {
    const { ekf } = setupFullFoundation();
    const rewards = ekf.rewardRegistry.all();
    expect(rewards.length).toBeGreaterThanOrEqual(1);
    expect(rewards[0].kind).toBe('task_completion');
    expect(rewards[0].status).toBe('active');
  });

  it('should pause and resume a reward', () => {
    const { ekf, reward } = setupFullFoundation();
    ekf.rewardRegistry.pause(reward.rewardId);

    let r = ekf.rewardRegistry.get(reward.rewardId)!;
    expect(r.status).toBe('paused');

    ekf.rewardRegistry.resume(reward.rewardId);
    r = ekf.rewardRegistry.get(reward.rewardId)!;
    expect(r.status).toBe('active');
  });

  it('should reject negative amounts', () => {
    const ekf = createEconomicKernelFoundation();
    expect(() => ekf.rewardRegistry.create({
      kind: 'bonus',
      name: 'Bad',
      description: 'bad',
      amountCents: -100,
      asset: 'USDC',
      maxTotalClaims: 1,
      perIdentityLimit: 1,
      activeWindowEnd: new Date(Date.now() + 1000).toISOString(),
      createdBy: 'admin',
    })).toThrow('Reward amount must be positive');
  });

  it('should auto-add identity_active eligibility rule', () => {
    const { ekf, reward } = setupFullFoundation();
    const r = ekf.rewardRegistry.get(reward.rewardId)!;
    const hasIdentityActive = r.eligibilityRules.some(rule => rule.kind === 'identity_active');
    expect(hasIdentityActive).toBe(true);
  });

  it('should list active rewards', () => {
    const { ekf, reward } = setupFullFoundation();
    expect(ekf.rewardRegistry.getActive().length).toBe(1);

    ekf.rewardRegistry.pause(reward.rewardId);
    expect(ekf.rewardRegistry.getActive().length).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// V6: Eligibility — eligible/ineligible/duplicate
// ═════════════════════════════════════════════════════════════════════

describe('V6: Eligibility Checks', () => {
  it('should pass eligibility for active identity', () => {
    const { ekf, reward, identity } = setupFullFoundation();
    const result = ekf.rewardRegistry.checkEligibility(reward.rewardId, identity.economicIdentityId, {
      identityStatus: 'active',
      grantedScopes: new Set(['receive_only', 'claim_reward', 'spend_within_mandate']),
      claimsForIdentity: 0,
    });
    expect(result.eligible).toBe(true);
    expect(result.failedRules.length).toBe(0);
  });

  it('should fail eligibility for suspended identity', () => {
    const { ekf, reward, identity } = setupFullFoundation();
    const result = ekf.rewardRegistry.checkEligibility(reward.rewardId, identity.economicIdentityId, {
      identityStatus: 'suspended',
      grantedScopes: new Set(['receive_only']),
      claimsForIdentity: 0,
    });
    expect(result.eligible).toBe(false);
    expect(result.failedRules.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect duplicate claims', () => {
    const { ekf, reward, identity } = setupFullFoundation();
    const result = ekf.rewardRegistry.checkEligibility(reward.rewardId, identity.economicIdentityId, {
      identityStatus: 'active',
      grantedScopes: new Set(['receive_only', 'claim_reward']),
      claimsForIdentity: 2, // at limit
    });
    expect(result.eligible).toBe(false);
    expect(result.isDuplicate).toBe(true);
  });

  it('should reject expired rewards', () => {
    const ekf = createEconomicKernelFoundation();
    const reward = ekf.rewardRegistry.create({
      kind: 'bonus',
      name: 'Expired',
      description: 'expired reward',
      amountCents: 100,
      asset: 'USDC',
      maxTotalClaims: 5,
      perIdentityLimit: 1,
      activeWindowEnd: new Date(Date.now() - 1000).toISOString(), // already expired
      createdBy: 'admin',
    });
    const result = ekf.rewardRegistry.checkEligibility(reward.rewardId, 'any-id', {
      identityStatus: 'active',
      grantedScopes: new Set(),
      claimsForIdentity: 0,
    });
    expect(result.eligible).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// V7: Claim Lifecycle 状态转换
// ═════════════════════════════════════════════════════════════════════

describe('V7: Claim Lifecycle', () => {
  it('should approve a valid claim', () => {
    const { ekf, reward, identity } = setupFullFoundation();
    const result = ekf.attemptClaim(reward.rewardId, identity.economicIdentityId);

    expect(result.success).toBe(true);
    expect(result.status).toBe('approved');
    expect(result.receipt).not.toBeNull();
    expect(result.receipt!.amountCents).toBe(500);
    expect(result.receipt!.asset).toBe('USDC');
  });

  it('should settle an approved claim', () => {
    const { ekf, reward, identity } = setupFullFoundation();
    const result = ekf.attemptClaim(reward.rewardId, identity.economicIdentityId);
    expect(result.success).toBe(true);

    const settled = ekf.claimEngine.settle(result.claimId);
    expect(settled).toBe(true);

    const claim = ekf.claimEngine.get(result.claimId)!;
    expect(claim.status).toBe('settled');
  });

  it('should reject claim for non-existent reward', () => {
    const { ekf, identity } = setupFullFoundation();
    const result = ekf.attemptClaim('reward_999', identity.economicIdentityId);
    expect(result.success).toBe(false);
    expect(result.status).toBe('rejected');
    expect(result.rejectionReasons).toContain('Reward not found');
  });

  it('should reject claim for non-existent identity', () => {
    const { ekf, reward } = setupFullFoundation();
    const result = ekf.attemptClaim(reward.rewardId, 'econ-nonexistent');
    expect(result.success).toBe(false);
    expect(result.status).toBe('rejected');
  });

  it('should produce claim receipt on approval', () => {
    const { ekf, reward, identity } = setupFullFoundation();
    const result = ekf.attemptClaim(reward.rewardId, identity.economicIdentityId);
    expect(result.receipt).toBeDefined();

    const receipts = ekf.claimEngine.allReceipts();
    expect(receipts.length).toBe(1);
    expect(receipts[0].rewardId).toBe(reward.rewardId);
  });

  it('should increment reward totalClaimed on approval', () => {
    const { ekf, reward, identity } = setupFullFoundation();
    ekf.attemptClaim(reward.rewardId, identity.economicIdentityId);

    const r = ekf.rewardRegistry.get(reward.rewardId)!;
    expect(r.totalClaimed).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// V8: Duplicate Claims 被阻止
// ═════════════════════════════════════════════════════════════════════

describe('V8: Anti-Duplication', () => {
  it('should block duplicate claims beyond per-identity limit', () => {
    const { ekf, reward, identity } = setupFullFoundation();

    // Claim 1: success
    const r1 = ekf.attemptClaim(reward.rewardId, identity.economicIdentityId);
    expect(r1.success).toBe(true);

    // Claim 2: success (limit is 2)
    const r2 = ekf.attemptClaim(reward.rewardId, identity.economicIdentityId);
    expect(r2.success).toBe(true);

    // Claim 3: should be duplicate
    const r3 = ekf.attemptClaim(reward.rewardId, identity.economicIdentityId);
    expect(r3.success).toBe(false);
    expect(r3.status).toBe('duplicate');
  });

  it('should track claim stats correctly after duplicates', () => {
    const { ekf, reward, identity } = setupFullFoundation();
    ekf.attemptClaim(reward.rewardId, identity.economicIdentityId);
    ekf.attemptClaim(reward.rewardId, identity.economicIdentityId);
    ekf.attemptClaim(reward.rewardId, identity.economicIdentityId); // duplicate

    const stats = ekf.claimEngine.stats();
    expect(stats.totalAttempts).toBe(3);
    expect(stats.approved).toBe(2);
    expect(stats.duplicate).toBe(1);
  });

  it('should deplete reward when max total claims reached', () => {
    const ekf = createEconomicKernelFoundation();
    const reward = ekf.rewardRegistry.create({
      kind: 'bonus',
      name: 'Limited',
      description: 'only 1 total claim',
      amountCents: 100,
      asset: 'USDC',
      maxTotalClaims: 1,
      perIdentityLimit: 1,
      activeWindowEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: 'admin',
    });
    const id = ekf.identityRegistry.create({ runtimeIdentityId: 'rt-dep' });
    ekf.envelopeManager.create(id.economicIdentityId, ['receive_only', 'claim_reward']);

    const r1 = ekf.attemptClaim(reward.rewardId, id.economicIdentityId);
    expect(r1.success).toBe(true);

    const r = ekf.rewardRegistry.get(reward.rewardId)!;
    expect(r.status).toBe('depleted');
  });
});

// ═════════════════════════════════════════════════════════════════════
// V9: Control Surface 返回 diagnosis-first 输出
// ═════════════════════════════════════════════════════════════════════

describe('V9: Control Surface API Routes', () => {
  it('should include all Round 17.8 economic routes', () => {
    const routes = createApiRoutes({});
    const economicPaths = routes
      .filter(r => r.path.startsWith('/api/economic/'))
      .map(r => r.path);

    expect(economicPaths).toContain('/api/economic/foundation');
    expect(economicPaths).toContain('/api/economic/rewards');
    expect(economicPaths).toContain('/api/economic/claims');
    expect(economicPaths).toContain('/api/economic/diagnostics');
  });

  it('should have at least 11 total economic API routes', () => {
    const routes = createApiRoutes({});
    const economicRoutes = routes.filter(r => r.path.startsWith('/api/economic/'));
    expect(economicRoutes.length).toBeGreaterThanOrEqual(11);
  });

  it('should return error for unconfigured foundation', async () => {
    const routes = createApiRoutes({});
    const foundationRoute = routes.find(r => r.path === '/api/economic/foundation');
    const result = await foundationRoute!.handler({} as any);
    expect(result).toEqual({ error: 'EconomicKernelFoundation not configured' });
  });

  it('should return truth report from /api/economic/foundation', async () => {
    const ekf = createEconomicKernelFoundation();
    const id = ekf.identityRegistry.create({ runtimeIdentityId: 'rt-api' });
    ekf.envelopeManager.create(id.economicIdentityId, ['receive_only']);

    const routes = createApiRoutes({ economicKernelFoundation: ekf as any });
    const foundationRoute = routes.find(r => r.path === '/api/economic/foundation');
    const result = await foundationRoute!.handler({} as any) as any;

    expect(result.identitySummary).toBeDefined();
    expect(result.capabilitySummary).toBeDefined();
    expect(result.derivedFacts).toBeDefined();
  });

  it('should return diagnostics from /api/economic/diagnostics', async () => {
    const ekf = createEconomicKernelFoundation();
    const routes = createApiRoutes({ economicKernelFoundation: ekf as any });
    const diagRoute = routes.find(r => r.path === '/api/economic/diagnostics');
    const result = await diagRoute!.handler({} as any) as any;

    expect(result.firewallDiagnostics).toBeDefined();
    expect(result.mandateDiagnostics).toBeDefined();
    expect(result.warnings).toBeDefined();
    expect(result.derivedFacts).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// V10: 17.7 安全不变量无回归
// ═════════════════════════════════════════════════════════════════════

describe('V10: Security Invariants Regression', () => {
  it('external text CANNOT produce explicit_transfer', () => {
    const { ekf, envelope } = setupFullFoundation();
    ekf.envelopeManager.grantScope(envelope.envelopeId, 'explicit_transfer');

    const candidate = createCandidate({
      actionKind: 'explicit_transfer',
      source: 'external_text',
      sourceContext: 'chat message from user',
      amountCents: 50_00,
      asset: 'USDC',
      recipient: 'attacker',
      purpose: 'transfer',
    });
    const verdict = ekf.evaluate(candidate, 'rt-1');

    expect(verdict.finalDecision).toBe('rejected');
    expect(verdict.checks.sourceTrustEvaluation.passed).toBe(false);
  });

  it('prompt injection source is blocked', () => {
    const { ekf } = setupFullFoundation();

    const candidate = createCandidate({
      actionKind: 'receive',
      source: 'prompt_injection',
      sourceContext: 'injected prompt',
      amountCents: 100,
      asset: 'USDC',
      purpose: 'malicious receive',
    });
    const verdict = ekf.evaluate(candidate, 'rt-1');
    expect(verdict.finalDecision).toBe('rejected');
  });

  it('spend_within_mandate requires a matching mandate', () => {
    const { ekf, envelope } = setupFoundationWithIdentity();
    ekf.envelopeManager.grantScope(envelope.envelopeId, 'spend_within_mandate');

    const candidate = createCandidate({
      actionKind: 'spend_within_mandate',
      source: 'internal',
      sourceContext: 'agent decision',
      amountCents: 10_00,
      asset: 'USDC',
      purpose: 'spend',
    });
    const verdict = ekf.evaluate(candidate, 'rt-1');
    expect(verdict.finalDecision).toBe('rejected');
    expect(verdict.checks.mandateCheck.passed).toBe(false);
  });

  it('explicit_transfer always requires human confirmation', () => {
    const { ekf, identity, envelope } = setupFullFoundation();
    ekf.envelopeManager.grantScope(envelope.envelopeId, 'explicit_transfer');

    ekf.mandateEngine.create({
      economicIdentityId: identity.economicIdentityId,
      purpose: 'admin-transfer',
      maxTotalAmount: 1000_00,
      maxPerTransactionAmount: 500_00,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      allowedActionKinds: ['explicit_transfer'],
      approvedBy: 'human-admin',
    });

    const candidate = createCandidate({
      actionKind: 'explicit_transfer',
      source: 'internal',
      sourceContext: 'admin',
      amountCents: 100_00,
      asset: 'USDC',
      recipient: 'valid-wallet',
      purpose: 'transfer',
    });
    const verdict = ekf.evaluate(candidate, 'rt-1');
    expect(verdict.finalDecision).toBe('pending_human_confirmation');
    expect(verdict.checks.humanConfirmationRequired).toBe(true);
  });

  it('inactive identity cannot claim rewards', () => {
    const { ekf, reward, identity } = setupFullFoundation();
    ekf.identityRegistry.suspend(identity.economicIdentityId, 'test suspension');

    const result = ekf.attemptClaim(reward.rewardId, identity.economicIdentityId);
    expect(result.success).toBe(false);
    expect(result.status).toBe('ineligible');
  });

  it('reward/claim integration does not affect firewall invariants', () => {
    const { ekf, reward, identity } = setupFullFoundation();

    // Claim a reward successfully
    const claimResult = ekf.attemptClaim(reward.rewardId, identity.economicIdentityId);
    expect(claimResult.success).toBe(true);

    // Firewall should still block external transfers
    const candidate = createCandidate({
      actionKind: 'explicit_transfer',
      source: 'external_text',
      sourceContext: 'after claim',
      amountCents: 99_00,
      asset: 'USDC',
      recipient: 'attacker',
      purpose: 'steal',
    });
    const verdict = ekf.evaluate(candidate, 'rt-1');
    expect(verdict.finalDecision).toBe('rejected');
  });

  it('truth report remains accurate after multiple operations', () => {
    const { ekf, reward, identity } = setupFullFoundation();

    // Perform various operations
    ekf.attemptClaim(reward.rewardId, identity.economicIdentityId);
    ekf.evaluate(createCandidate({
      actionKind: 'receive',
      source: 'internal',
      sourceContext: 'test',
      amountCents: 100,
      asset: 'USDC',
      purpose: 'receive',
    }), 'rt-1');

    const report = ekf.generateTruthReport();
    expect(report.rewardSummary.totalClaims).toBe(1);
    expect(report.rewardSummary.approvedClaims).toBe(1);
    expect(report.firewallSummary.totalEvaluated).toBe(1);
    expect(report.auditSummary.total).toBe(1);
  });
});
