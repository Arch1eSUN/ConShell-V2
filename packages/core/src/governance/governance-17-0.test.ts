/**
 * Governance 17.0 — Verification Matrix (V1-V10)
 *
 * Tests for Round 17.0: Governance Takeover & Lineage-Controlled Replication.
 *
 * V1:  governance evaluates replication → verdict returned
 * V2:  deny path blocks (revoked identity)
 * V3:  allow records receipt with lineageRecordId
 * V4:  constraints carry (allow_with_constraints)
 * V5:  lineage records scopes (InheritanceScope on LineageRecord)
 * V6:  forbidden field not in child scope
 * V7:  child can't exceed parent authority
 * V8:  survival dominates (terminal tier → deny)
 * V9:  revocation cascades (quarantine parent → descendants quarantined)
 * V10: control surface reflects truth
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GovernanceService } from './governance-service.js';
import type { GovernanceVerdict, VerdictCode } from './governance-verdict.js';
import { isExecutableVerdict, getConstraint } from './governance-verdict.js';
import type { GovernanceEconomicProvider } from './governance-economic-provider.js';
import { NullEconomicProvider } from './governance-economic-provider.js';
import type { GovernanceIdentityProvider, GovernancePolicyProvider } from './governance-service.js';
import type { SurvivalTier } from '../types/common.js';

import { createDefaultScope, validateScopeNotExceedsParent } from '../lineage/inheritance-scope.js';
import type { InheritanceScope } from '../lineage/inheritance-scope.js';
import { LineageBranchControl } from '../lineage/branch-control.js';
import type { LineageRecordProvider, BranchStatus } from '../lineage/branch-control.js';
import type { LineageRecord, ChildRuntimeStatus } from '../lineage/lineage-contract.js';
import { isValidChildTransition } from '../lineage/lineage-contract.js';

// ── Test Helpers ─────────────────────────────────────────────────────

function createMockIdentityProvider(status = 'active' as any): GovernanceIdentityProvider {
  return {
    status: () => status,
    selfFingerprint: () => 'test-fingerprint-001',
  };
}

function createMockPolicyProvider(decision = 'allow' as any): GovernancePolicyProvider {
  return {
    evaluate: () => ({ decision, rule: 'test-rule', reason: 'test-reason', category: 'security' as const }),
  };
}

function createMockEconomicProvider(overrides: Partial<{
  tier: SurvivalTier;
  emergency: boolean;
  mustPreserve: boolean;
  balance: number;
  canAccept: boolean;
}> = {}): GovernanceEconomicProvider {
  const tier = overrides.tier ?? 'normal';
  return {
    survivalTier: () => tier,
    isEmergency: () => overrides.emergency ?? false,
    mustPreserveActive: () => overrides.mustPreserve ?? false,
    currentBalanceCents: () => overrides.balance ?? 100_00,
    canAcceptAction: () => ({
      allowed: overrides.canAccept ?? true,
      reason: overrides.canAccept === false ? 'Budget insufficient' : 'OK',
    }),
  };
}

function createGovernanceService(opts: {
  identityStatus?: string;
  policyDecision?: string;
  economic?: GovernanceEconomicProvider;
} = {}) {
  return new GovernanceService({
    identity: createMockIdentityProvider(opts.identityStatus ?? 'active'),
    policy: createMockPolicyProvider(opts.policyDecision ?? 'allow'),
    economic: opts.economic ?? createMockEconomicProvider(),
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as any,
  });
}

// ── V1-V10 Tests ─────────────────────────────────────────────────────

describe('Round 17.0 — Governance Takeover Verification Matrix', () => {

  // ── V1: governance evaluates replication → verdict returned ──
  describe('V1: Replication verdict', () => {
    it('should return GovernanceVerdict on replication proposal', () => {
      const gov = createGovernanceService();
      const proposal = gov.propose({
        actionKind: 'replication',
        target: 'child-agent-1',
        justification: 'Need helper agent',
        expectedCostCents: 10_00,
      });

      const verdict = gov.evaluate(proposal.id);

      expect(verdict).toBeDefined();
      expect(verdict.id).toMatch(/^vrd_/);
      expect(verdict.proposalId).toBe(proposal.id);
      expect(verdict.code).toBe('allow');
      expect(verdict.riskLevel).toBeDefined();
      expect(verdict.timestamp).toBeDefined();
      expect(verdict.survivalContext).toBeDefined();
    });
  });

  // ── V2: deny path blocks (revoked identity) ──
  describe('V2: Deny blocks action', () => {
    it('should mark proposal as proposal_invalid when identity is revoked (Round 17.5)', () => {
      const gov = createGovernanceService({ identityStatus: 'revoked' });
      const proposal = gov.propose({
        actionKind: 'replication',
        target: 'child-agent-2',
        justification: 'Revoked agent trying to replicate',
      });

      // Round 17.5: proposal_invalid at initiation, not deny at evaluation
      expect(proposal.status).toBe('proposal_invalid');
      expect(proposal.denialLayer).toBe('identity');
      expect(proposal.denialReason).toContain('revoked');

      // Initiation receipt exists
      const receipts = gov.getReceipts(proposal.id);
      expect(receipts).toHaveLength(1);
      expect(receipts[0]!.phase).toBe('initiation');
      expect(receipts[0]!.result).toBe('failure');
    });
  });

  // ── V3: allow records receipt with verdict ID ──
  describe('V3: Allow records receipt', () => {
    it('should create receipt and store verdict on approval', () => {
      const gov = createGovernanceService();
      const proposal = gov.propose({
        actionKind: 'selfmod',
        target: 'config.ts',
        justification: 'Update configuration',
      });

      const verdict = gov.evaluate(proposal.id);

      expect(verdict.code).toBe('allow');
      expect(isExecutableVerdict(verdict)).toBe(true);

      // Verdict stored and retrievable
      const storedVerdict = gov.getVerdict(proposal.id);
      expect(storedVerdict).toBeDefined();
      expect(storedVerdict!.id).toBe(verdict.id);
    });
  });

  // ── V4: constraints carry (allow_with_constraints) ──
  describe('V4: Constraints carry through', () => {
    it('should produce allow_with_constraints when must-preserve is active', () => {
      const econ = createMockEconomicProvider({ mustPreserve: true });
      const gov = createGovernanceService({ economic: econ });

      const proposal = gov.propose({
        actionKind: 'replication',
        target: 'child-agent-constrained',
        justification: 'Constrained replication',
        expectedCostCents: 5_00,
      });

      const verdict = gov.evaluate(proposal.id);

      expect(verdict.code).toBe('allow_with_constraints');
      expect(verdict.constraints.length).toBeGreaterThan(0);

      const timeLimitConstraint = getConstraint(verdict, 'time_limit');
      expect(timeLimitConstraint).toBeDefined();
      expect(timeLimitConstraint!.value['maxDurationMs']).toBe(300_000);
    });

    it('should produce budget constraint when in critical tier', () => {
      const econ = createMockEconomicProvider({ tier: 'critical' });
      const gov = createGovernanceService({ economic: econ });

      const proposal = gov.propose({
        actionKind: 'dangerous_action',
        target: 'risky-op',
        justification: 'Emergency operation',
        expectedCostCents: 50_00,
      });

      const verdict = gov.evaluate(proposal.id);

      // dangerous_action in critical tier → escalated for review (risk layer)
      expect(verdict.code).toBe('require_review');
      expect(verdict.reason).toBeDefined();
    });
  });

  // ── V5: lineage records scopes (InheritanceScope) ──
  describe('V5: InheritanceScope on LineageRecord', () => {
    it('should create default scope with minimal privileges', () => {
      const scope = createDefaultScope();

      expect(scope.authority.canReplicate).toBe(false);
      expect(scope.authority.canSelfmod).toBe(false);
      expect(scope.authority.canDangerousAction).toBe(false);
      expect(scope.authority.level).toBe('restricted');
      expect(scope.memory.level).toBe('isolated');
      expect(scope.budget.capCents).toBe(0);
    });
  });

  // ── V6: forbidden doesn't leak ──
  describe('V6: Scope validation prevents privilege escalation', () => {
    it('should detect violations when child exceeds parent scope', () => {
      const parentScope = createDefaultScope();
      const childScope: InheritanceScope = {
        ...createDefaultScope(),
        authority: {
          level: 'full',
          maxActions: ['replication'],
          canReplicate: true,       // parent can't replicate
          canSelfmod: true,         // parent can't selfmod
          canDangerousAction: false,
        },
      };

      const violations = validateScopeNotExceedsParent(childScope, parentScope);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.includes('replicate'))).toBe(true);
      expect(violations.some(v => v.includes('self-modify'))).toBe(true);
    });

    it('should pass when child scope is within parent scope', () => {
      const parentScope: InheritanceScope = {
        ...createDefaultScope(),
        authority: {
          level: 'full',
          maxActions: ['replication', 'selfmod'],
          canReplicate: true,
          canSelfmod: true,
          canDangerousAction: true,
        },
        budget: { level: 'full', capCents: 100_00, dailyLimitCents: 50_00 },
      };
      const childScope: InheritanceScope = {
        ...createDefaultScope(),
        authority: {
          level: 'restricted',
          maxActions: ['replication'],
          canReplicate: true,
          canSelfmod: false,
          canDangerousAction: false,
        },
        budget: { level: 'restricted', capCents: 50_00, dailyLimitCents: 25_00 },
      };

      const violations = validateScopeNotExceedsParent(childScope, parentScope);
      expect(violations).toHaveLength(0);
    });
  });

  // ── V7: child can't exceed authority ──
  describe('V7: Authority ceiling enforcement', () => {
    it('should detect budget cap violation', () => {
      const parentScope = {
        ...createDefaultScope(),
        budget: { level: 'restricted' as const, capCents: 50_00, dailyLimitCents: 25_00 },
      };
      const childScope = {
        ...createDefaultScope(),
        budget: { level: 'restricted' as const, capCents: 100_00, dailyLimitCents: 50_00 },
      };

      const violations = validateScopeNotExceedsParent(childScope, parentScope);
      expect(violations.some(v => v.includes('budget cap'))).toBe(true);
    });
  });

  // ── V8: survival dominates ──
  describe('V8: Survival tier dominates', () => {
    it('should deny when survival tier is terminal', () => {
      // Use 'critical' since that's in the actual SurvivalTier union
      // but we simulate 'terminal' via string cast since the provider returns string
      const econ: GovernanceEconomicProvider = {
        survivalTier: () => 'terminal' as any,
        isEmergency: () => true,
        mustPreserveActive: () => true,
        currentBalanceCents: () => 0,
        canAcceptAction: () => ({ allowed: false, reason: 'No budget' }),
      };
      const gov = createGovernanceService({ economic: econ });

      const proposal = gov.propose({
        actionKind: 'replication',
        target: 'child-in-terminal',
        justification: 'Attempting replication at terminal survival',
        expectedCostCents: 10_00,
      });

      const verdict = gov.evaluate(proposal.id);

      expect(verdict.code).toBe('deny');
      expect(verdict.reason).toContain('terminal');
      expect(verdict.survivalContext).toBeDefined();
      expect(verdict.survivalContext!.isEmergency).toBe(true);
    });

    it('should deny non-essential actions during emergency', () => {
      const econ = createMockEconomicProvider({ emergency: true });
      const gov = createGovernanceService({ economic: econ });

      const proposal = gov.propose({
        actionKind: 'dangerous_action',
        target: 'risky-op',
        justification: 'Not essential during emergency',
      });

      const verdict = gov.evaluate(proposal.id);
      expect(verdict.code).toBe('deny');
      expect(verdict.reason).toContain('emergency');
    });
  });

  // ── V9: revocation cascades ──
  describe('V9: Branch control cascading', () => {
    let records: Map<string, LineageRecord>;
    let provider: LineageRecordProvider;
    let branchControl: LineageBranchControl;

    beforeEach(() => {
      const defaultScope = createDefaultScope();
      records = new Map<string, LineageRecord>([
        ['rec-1', {
          id: 'rec-1', parentId: 'root', childId: 'child-1',
          spec: { name: 'c1', task: 't1', genesisPrompt: '', fundingCents: 100, parentId: 'root', proposalId: 'p1' },
          status: 'active' as ChildRuntimeStatus, fundingLease: { id: 'fl-1', childId: 'child-1', budgetCapCents: 100, spentCents: 0, status: 'active' as const, grantedAt: '' },
          identitySummary: { inheritedFields: [], derivedFields: [], excludedFields: [], fingerprint: 'fp-test', parentFingerprint: 'fp-root', lineageRoot: 'root', generation: 1 },
          inheritanceScope: defaultScope,
          proposalId: 'p1', createdAt: new Date().toISOString(),
        }],
        ['rec-2', {
          id: 'rec-2', parentId: 'child-1', childId: 'child-2',
          spec: { name: 'c2', task: 't2', genesisPrompt: '', fundingCents: 50, parentId: 'child-1', proposalId: 'p2' },
          status: 'active' as ChildRuntimeStatus, fundingLease: { id: 'fl-2', childId: 'child-2', budgetCapCents: 50, spentCents: 0, status: 'active' as const, grantedAt: '' },
          identitySummary: { inheritedFields: [], derivedFields: [], excludedFields: [], fingerprint: 'fp-test', parentFingerprint: 'fp-root', lineageRoot: 'root', generation: 1 },
          inheritanceScope: defaultScope,
          proposalId: 'p2', createdAt: new Date().toISOString(),
        }],
        ['rec-3', {
          id: 'rec-3', parentId: 'child-2', childId: 'child-3',
          spec: { name: 'c3', task: 't3', genesisPrompt: '', fundingCents: 25, parentId: 'child-2', proposalId: 'p3' },
          status: 'active' as ChildRuntimeStatus, fundingLease: { id: 'fl-3', childId: 'child-3', budgetCapCents: 25, spentCents: 0, status: 'active' as const, grantedAt: '' },
          identitySummary: { inheritedFields: [], derivedFields: [], excludedFields: [], fingerprint: 'fp-test', parentFingerprint: 'fp-root', lineageRoot: 'root', generation: 1 },
          inheritanceScope: defaultScope,
          proposalId: 'p3', createdAt: new Date().toISOString(),
        }],
      ]);

      provider = {
        getRecord: (id) => records.get(id),
        getChildrenOf: (parentChildId) =>
          Array.from(records.values()).filter(r => r.parentId === parentChildId),
        updateStatus: (id, status, reason) => {
          const rec = records.get(id);
          if (rec) {
            rec.status = status;
            rec.statusReason = reason;
          }
        },
        getAllRecords: () => Array.from(records.values()),
      };

      branchControl = new LineageBranchControl(
        provider,
        { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as any,
      );
    });

    it('should quarantine parent and cascade to descendants', () => {
      const receipt = branchControl.quarantineBranch('rec-1', 'Security review');

      expect(receipt.action).toBe('quarantine');
      expect(receipt.targetRecordId).toBe('rec-1');
      // rec-1, rec-2, rec-3 should all be quarantined
      expect(records.get('rec-1')!.status).toBe('quarantined');
      expect(records.get('rec-2')!.status).toBe('quarantined');
      expect(records.get('rec-3')!.status).toBe('quarantined');
    });

    it('should mark branch as compromised', () => {
      const receipt = branchControl.markCompromised('rec-2', 'Unauthorized action detected');

      expect(receipt.action).toBe('compromise');
      expect(records.get('rec-2')!.status).toBe('compromised');
      expect(records.get('rec-3')!.status).toBe('compromised');
      // rec-1 (parent) should be unaffected
      expect(records.get('rec-1')!.status).toBe('active');
    });

    it('should restore quarantined branch', () => {
      branchControl.quarantineBranch('rec-1', 'Security review');
      const receipt = branchControl.restoreBranch('rec-1', 'Review passed');

      expect(receipt.action).toBe('restore');
      expect(records.get('rec-1')!.status).toBe('active');
      expect(records.get('rec-2')!.status).toBe('active');
      expect(records.get('rec-3')!.status).toBe('active');
    });

    it('should return correct branch status', () => {
      branchControl.quarantineBranch('rec-2', 'Review');

      const status = branchControl.getBranchStatus('rec-1');
      expect(status).toBeDefined();
      expect(status!.recordId).toBe('rec-1');
      expect(status!.descendantCount).toBe(2);
      expect(status!.quarantinedDescendants).toBe(2); // rec-2 and rec-3
    });

    it('should revoke branch and terminate all descendants', () => {
      const receipt = branchControl.revokeBranch('rec-1', 'Terminating branch');

      expect(receipt.action).toBe('revoke');
      expect(records.get('rec-1')!.status).toBe('terminated');
      expect(records.get('rec-2')!.status).toBe('terminated');
      expect(records.get('rec-3')!.status).toBe('terminated');
    });
  });

  // ── V10: control surface reflects truth ──
  describe('V10: Control surface', () => {
    it('should expose verdicts via allVerdicts and getVerdict', () => {
      const gov = createGovernanceService();

      const p1 = gov.propose({ actionKind: 'replication', target: 't1', justification: 'j1' });
      const p2 = gov.propose({ actionKind: 'selfmod', target: 't2', justification: 'j2' });

      gov.evaluate(p1.id);
      gov.evaluate(p2.id);

      const all = gov.allVerdicts();
      expect(all.length).toBe(2);

      const v1 = gov.getVerdict(p1.id);
      expect(v1).toBeDefined();
      expect(v1!.proposalId).toBe(p1.id);
    });

    it('should return diagnostics with verdict-aware counts', () => {
      const gov = createGovernanceService();

      const p1 = gov.propose({ actionKind: 'replication', target: 't1', justification: 'j1' });
      gov.evaluate(p1.id);

      const diag = gov.diagnostics();
      expect(diag.totalProposals).toBe(1);
      expect(diag.approvalRate).toBeGreaterThan(0);
    });
  });

  // ── Status transitions ──
  describe('Status transitions (quarantined/compromised)', () => {
    it('should allow active → quarantined transition', () => {
      expect(isValidChildTransition('active', 'quarantined')).toBe(true);
    });

    it('should allow quarantined → active (restore)', () => {
      expect(isValidChildTransition('quarantined', 'active')).toBe(true);
    });

    it('should allow quarantined → compromised (escalation)', () => {
      expect(isValidChildTransition('quarantined', 'compromised')).toBe(true);
    });

    it('should only allow compromised → terminated', () => {
      expect(isValidChildTransition('compromised', 'terminated')).toBe(true);
      expect(isValidChildTransition('compromised', 'active')).toBe(false);
    });
  });
});
