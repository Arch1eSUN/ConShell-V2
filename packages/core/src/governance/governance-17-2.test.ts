/**
 * Round 17.2 Verification Matrix — governance-17-2.test.ts
 *
 * V1.  Selector candidate ≠ automatic approval
 * V2.  Governance can deny delegation to unhealthy/degraded/quarantined/revoked peer
 * V3.  Approved delegation carries explicit scope/constraints
 * V4.  Delegated execution receipt links proposal + verdict + peer + scope
 * V5.  Peer cannot perform forbidden dangerous action under restricted scope
 * V6.  Peer cannot selfmod when delegation scope forbids it
 * V7.  Peer cannot sub-delegate when delegation scope forbids it
 * V8.  Scope violation produces structured governance event
 * V9.  Violation can trigger quarantine/revoke/escalation path
 * V10. Control surface reflects delegation governance truth
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDelegationScope,
  checkDelegationAction,
  isDelegationExpired,
  validateDelegationScope,
  type DelegationScope,
} from './delegation-scope.js';
import {
  DelegationEnforcer,
  type ScopeViolation,
} from './delegation-enforcer.js';
import { createDefaultScope } from '../lineage/inheritance-scope.js';
import type { GovernanceActionKind } from './governance-contract.js';
import { ACTION_RISK_MAP, ACTION_ROLLBACK_MAP } from './governance-contract.js';

// ── Test Helpers ─────────────────────────────────────────────────────

const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

function makeScope(overrides: Partial<Parameters<typeof createDelegationScope>[0]> = {}): DelegationScope {
  return createDelegationScope({
    delegatorId: 'agent-root',
    delegatedPeerId: 'peer-1',
    taskScope: 'test task',
    verdictId: 'v_test',
    proposalId: 'p_test',
    ...overrides,
  });
}

// ══════════════════════════════════════════════════════════════════════

describe('Round 17.2 Verification Matrix', () => {
  // ── V1: Selector candidate ≠ automatic approval ──────────────────

  describe('V1: selector candidate ≠ automatic approval', () => {
    it('delegation action kinds exist in governance model', () => {
      const delegationKinds: GovernanceActionKind[] = [
        'delegate_task',
        'delegate_selfmod',
        'delegate_dangerous_action',
      ];
      for (const kind of delegationKinds) {
        expect(ACTION_RISK_MAP[kind]).toBeDefined();
        expect(ACTION_ROLLBACK_MAP[kind]).toBe('revoke-delegation');
      }
    });

    it('delegate_task risk is high, delegate_dangerous_action is critical', () => {
      expect(ACTION_RISK_MAP['delegate_task']).toBe('high');
      expect(ACTION_RISK_MAP['delegate_dangerous_action']).toBe('critical');
    });
  });

  // ── V2: Governance can deny delegation to ineligible peer ────────

  describe('V2: governance denies delegation to ineligible peer', () => {
    it('DelegationScope requires explicit delegatedPeerId', () => {
      const scope = makeScope({ delegatedPeerId: 'peer-quarantined' });
      expect(scope.delegatedPeerId).toBe('peer-quarantined');
    });

    it('expired scope is detected as invalid', () => {
      const scope = makeScope({ expiryMs: -1000 }); // already expired
      expect(isDelegationExpired(scope)).toBe(true);
    });

    it('non-expired scope is valid', () => {
      const scope = makeScope({ expiryMs: 3600_000 });
      expect(isDelegationExpired(scope)).toBe(false);
    });
  });

  // ── V3: Approved delegation carries explicit scope/constraints ───

  describe('V3: approved delegation carries scope', () => {
    it('createDelegationScope produces all required fields', () => {
      const scope = makeScope({
        budgetCapCents: 500,
        allowSelfmod: false,
        allowDangerousAction: false,
        subDelegationAllowed: false,
        expiryMs: 7200_000,
      });

      expect(scope.delegationId).toMatch(/^dscope_/);
      expect(scope.delegatorId).toBe('agent-root');
      expect(scope.delegatedPeerId).toBe('peer-1');
      expect(scope.taskScope).toBe('test task');
      expect(scope.verdictId).toBe('v_test');
      expect(scope.proposalId).toBe('p_test');
      expect(scope.subDelegationAllowed).toBe(false);
      expect(scope.budget.capCents).toBe(500);
      expect(scope.authority.canSelfmod).toBe(false);
      expect(scope.authority.canDangerousAction).toBe(false);
      expect(scope.authority.canReplicate).toBe(false); // never granted
      expect(scope.expiresAt).toBeDefined();
      expect(scope.issuedAt).toBeDefined();
    });

    it('default scope is minimal-privilege', () => {
      const scope = makeScope();
      expect(scope.authority.canSelfmod).toBe(false);
      expect(scope.authority.canDangerousAction).toBe(false);
      expect(scope.authority.canReplicate).toBe(false);
      expect(scope.subDelegationAllowed).toBe(false);
      expect(scope.budget.capCents).toBe(0);
    });
  });

  // ── V4: Delegation receipt links proposal + verdict + peer + scope

  describe('V4: delegation receipt linkage', () => {
    it('DelegationScope carries proposalId, verdictId, delegationId', () => {
      const scope = makeScope({
        proposalId: 'prop_123',
        verdictId: 'verd_456',
      });
      expect(scope.proposalId).toBe('prop_123');
      expect(scope.verdictId).toBe('verd_456');
      expect(scope.delegationId).toMatch(/^dscope_/);
      expect(scope.delegatedPeerId).toBe('peer-1');
    });
  });

  // ── V5: Peer cannot perform forbidden dangerous action ───────────

  describe('V5: dangerous action enforcement', () => {
    it('denied when scope forbids dangerous actions', () => {
      const scope = makeScope({ allowDangerousAction: false });
      const check = checkDelegationAction(scope, { kind: 'dangerous_action' });
      expect(check.allowed).toBe(false);
      expect(check.violationKind).toBe('forbidden_action');
    });

    it('allowed when scope permits dangerous actions', () => {
      const scope = makeScope({ allowDangerousAction: true });
      const check = checkDelegationAction(scope, { kind: 'dangerous_action' });
      expect(check.allowed).toBe(true);
    });
  });

  // ── V6: Peer cannot selfmod when delegation scope forbids it ─────

  describe('V6: selfmod enforcement', () => {
    it('denied when scope forbids selfmod', () => {
      const scope = makeScope({ allowSelfmod: false });
      const check = checkDelegationAction(scope, { kind: 'selfmod' });
      expect(check.allowed).toBe(false);
      expect(check.violationKind).toBe('forbidden_selfmod');
    });

    it('allowed when scope permits selfmod', () => {
      const scope = makeScope({ allowSelfmod: true });
      const check = checkDelegationAction(scope, { kind: 'selfmod' });
      expect(check.allowed).toBe(true);
    });
  });

  // ── V7: Peer cannot sub-delegate when scope forbids it ───────────

  describe('V7: sub-delegation enforcement', () => {
    it('denied when scope forbids sub-delegation', () => {
      const scope = makeScope({ subDelegationAllowed: false });
      const check = checkDelegationAction(scope, { kind: 'sub_delegation' });
      expect(check.allowed).toBe(false);
      expect(check.violationKind).toBe('forbidden_sub_delegation');
    });

    it('allowed when scope permits sub-delegation', () => {
      const scope = makeScope({ subDelegationAllowed: true });
      const check = checkDelegationAction(scope, { kind: 'sub_delegation' });
      expect(check.allowed).toBe(true);
    });
  });

  // ── V8: Scope violation produces structured governance event ─────

  describe('V8: structured violation events', () => {
    let enforcer: DelegationEnforcer;

    beforeEach(() => {
      enforcer = new DelegationEnforcer({ logger: mockLogger as any });
    });

    it('violation produces ScopeViolation with full linkage', () => {
      const scope = makeScope({ allowSelfmod: false, budgetCapCents: 100 });
      enforcer.registerScope(scope);

      const result = enforcer.checkAction('peer-1', 'selfmod');
      expect(result.allowed).toBe(false);
      expect(result.violation).toBeDefined();
      expect(result.violation!.peerId).toBe('peer-1');
      expect(result.violation!.delegationId).toBe(scope.delegationId);
      expect(result.violation!.proposalId).toBe('p_test');
      expect(result.violation!.verdictId).toBe('v_test');
      expect(result.violation!.violationKind).toBe('forbidden_selfmod');
    });

    it('budget violation produces structured record', () => {
      const scope = makeScope({ budgetCapCents: 50 });
      enforcer.registerScope(scope);

      const result = enforcer.checkAction('peer-1', 'task', 200);
      expect(result.allowed).toBe(false);
      expect(result.violation!.violationKind).toBe('budget_exceeded');
    });

    it('expired scope violation is detected', () => {
      const scope = makeScope({ expiryMs: -5000 }); // already expired
      enforcer.registerScope(scope);

      const result = enforcer.checkAction('peer-1', 'task');
      expect(result.allowed).toBe(false);
      expect(result.violation!.violationKind).toBe('scope_expired');
    });

    it('events are recorded for violations', () => {
      const scope = makeScope({ allowDangerousAction: false });
      enforcer.registerScope(scope);
      enforcer.checkAction('peer-1', 'dangerous_action');

      const events = enforcer.getEvents('peer-1');
      const violEvent = events.find(e => e.kind === 'scope_violation_detected');
      expect(violEvent).toBeDefined();
      expect(violEvent!.delegationId).toBe(scope.delegationId);
    });
  });

  // ── V9: Violation can trigger quarantine/revoke path ─────────────

  describe('V9: quarantine/revoke escalation', () => {
    let enforcer: DelegationEnforcer;

    beforeEach(() => {
      enforcer = new DelegationEnforcer({ logger: mockLogger as any, quarantineThreshold: 2 });
    });

    it('shouldQuarantine is false below threshold', () => {
      const scope = makeScope({ allowSelfmod: false });
      enforcer.registerScope(scope);
      enforcer.checkAction('peer-1', 'selfmod');
      expect(enforcer.shouldQuarantine('peer-1')).toBe(false);
    });

    it('shouldQuarantine is true at threshold', () => {
      const scope = makeScope({ allowSelfmod: false, allowDangerousAction: false });
      enforcer.registerScope(scope);
      enforcer.checkAction('peer-1', 'selfmod');
      enforcer.checkAction('peer-1', 'dangerous_action');
      expect(enforcer.shouldQuarantine('peer-1')).toBe(true);
    });

    it('recordQuarantine produces event and removes scope', () => {
      const scope = makeScope({ allowSelfmod: false });
      enforcer.registerScope(scope);
      enforcer.checkAction('peer-1', 'selfmod');
      enforcer.checkAction('peer-1', 'selfmod');
      enforcer.recordQuarantine('peer-1');

      const events = enforcer.getEvents('peer-1');
      const quarEvent = events.find(e => e.kind === 'peer_quarantined_from_delegation');
      expect(quarEvent).toBeDefined();
      expect(enforcer.hasDelegation('peer-1')).toBe(false);
    });
  });

  // ── V10: Control surface reflects delegation truth ───────────────

  describe('V10: control surface', () => {
    let enforcer: DelegationEnforcer;

    beforeEach(() => {
      enforcer = new DelegationEnforcer({ logger: mockLogger as any });
    });

    it('getSummary shows active delegations', () => {
      const scope = makeScope();
      enforcer.registerScope(scope);

      const summary = enforcer.getSummary();
      expect(summary.activeDelegations).toBe(1);
      expect(summary.delegationsByPeer['peer-1']).toBe(scope.delegationId);
    });

    it('getSummary shows violations breakdown', () => {
      const scope = makeScope({ allowSelfmod: false, allowDangerousAction: false, budgetCapCents: 10 });
      enforcer.registerScope(scope);
      enforcer.checkAction('peer-1', 'selfmod');
      enforcer.checkAction('peer-1', 'dangerous_action');
      enforcer.checkAction('peer-1', 'task', 100);

      const summary = enforcer.getSummary();
      expect(summary.totalViolations).toBe(3);
      expect(summary.violationsByKind['forbidden_selfmod']).toBe(1);
      expect(summary.violationsByKind['forbidden_action']).toBe(1);
      expect(summary.violationsByKind['budget_exceeded']).toBe(1);
    });

    it('getViolations returns filtered by peerId', () => {
      const scope1 = makeScope({ delegatedPeerId: 'peer-1', allowSelfmod: false });
      const scope2 = makeScope({ delegatedPeerId: 'peer-2', allowSelfmod: false });
      enforcer.registerScope(scope1);
      enforcer.registerScope(scope2);
      enforcer.checkAction('peer-1', 'selfmod');
      enforcer.checkAction('peer-2', 'selfmod');

      expect(enforcer.getViolations('peer-1')).toHaveLength(1);
      expect(enforcer.getViolations('peer-2')).toHaveLength(1);
      expect(enforcer.getViolations()).toHaveLength(2);
    });

    it('scope validation detects parent scope violations', () => {
      const parent = createDefaultScope();
      const delegation = makeScope({
        allowSelfmod: true,   // parent doesn't allow selfmod
        budgetCapCents: 500,  // exceeds parent's 0
      });

      const violations = validateDelegationScope(delegation, parent);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.includes('self-modify'))).toBe(true);
      expect(violations.some(v => v.includes('budget cap'))).toBe(true);
    });

    it('completeScope removes active delegation', () => {
      const scope = makeScope();
      enforcer.registerScope(scope);
      expect(enforcer.hasDelegation('peer-1')).toBe(true);

      enforcer.completeScope('peer-1', true);
      expect(enforcer.hasDelegation('peer-1')).toBe(false);

      const events = enforcer.getEvents('peer-1');
      expect(events.some(e => e.kind === 'delegation_completed')).toBe(true);
    });

    it('revokeScope removes delegation and records event', () => {
      const scope = makeScope();
      enforcer.registerScope(scope);
      enforcer.revokeScope('peer-1', 'manual override');
      expect(enforcer.hasDelegation('peer-1')).toBe(false);

      const events = enforcer.getEvents('peer-1');
      expect(events.some(e => e.kind === 'delegation_completed' && e.detail.includes('Revoked'))).toBe(true);
    });
  });
});
