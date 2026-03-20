/**
 * Round 17.7 — Economic Kernel Foundation Tests
 *
 * V1-V10 Verification Matrix:
 *
 * V1: Runtime identity ≠ Economic identity (formal distinction)
 * V2: Four-class action classification with correct risk baselines
 * V3: Capability envelope constrains receive-only / transfer-denied
 * V4: Mandate engine match / reject / expire / exhaust
 * V5: External text cannot directly form explicit_transfer
 * V6: Firewall 5-layer pipeline fully exercised
 * V7: Audit events record full decision chains
 * V8: API control surface routes return correct data
 * V9: No new auto-execute high-risk outbound paths
 * V10: Existing tests unaffected (run separately via full suite)
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { EconomicIdentityRegistry } from './economic-identity.js';
import {
  classifyAction,
  createCandidate,
  ACTION_RISK_DEFAULTS,
  EXTERNAL_SOURCES,
} from './economic-action-classification.js';
import type {
  EconomicActionKind,
  ActionSource,
  CandidateEconomicAction,
} from './economic-action-classification.js';
import { CapabilityEnvelopeManager, ALL_CAPABILITY_SCOPES } from './capability-envelope.js';
import type { CapabilityScope } from './capability-envelope.js';
import { MandateEngine } from './mandate-engine.js';
import { EconomicInstructionFirewall } from './economic-instruction-firewall.js';
import { EconomicAuditLog } from './economic-audit-event.js';
import { createEconomicKernelFoundation } from './economic-kernel-foundation.js';
import { createApiRoutes } from '../api/routes.js';

// ── Helpers ──────────────────────────────────────────────────────────

function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function pastDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function makeCandidate(overrides: Partial<CandidateEconomicAction> = {}): CandidateEconomicAction {
  return createCandidate({
    actionKind: 'receive',
    source: 'internal',
    sourceContext: 'test',
    amountCents: 100,
    asset: 'USDC',
    purpose: 'test action',
    ...overrides,
  });
}

// ══════════════════════════════════════════════════════════════════════
// V1: EconomicIdentity — Formal Distinction
// ══════════════════════════════════════════════════════════════════════

describe('V1: EconomicIdentity Registry (Round 17.7)', () => {
  let registry: EconomicIdentityRegistry;

  beforeEach(() => {
    registry = new EconomicIdentityRegistry();
  });

  it('creates economic identity for runtime identity', () => {
    const identity = registry.create({ runtimeIdentityId: 'rt_001' });
    expect(identity.economicIdentityId).toBeTruthy();
    expect(identity.runtimeIdentityId).toBe('rt_001');
    expect(identity.status).toBe('active');
  });

  it('runtime identity without economic identity is not eligible', () => {
    expect(registry.isEligibleForEconomicActions('rt_nonexistent')).toBe(false);
  });

  it('runtime identity with active economic identity is eligible', () => {
    registry.create({ runtimeIdentityId: 'rt_002' });
    expect(registry.isEligibleForEconomicActions('rt_002')).toBe(true);
  });

  it('prevents duplicate economic identity for same runtime identity', () => {
    registry.create({ runtimeIdentityId: 'rt_003' });
    expect(() => registry.create({ runtimeIdentityId: 'rt_003' })).toThrow();
  });

  it('suspended identity is not eligible', () => {
    const id = registry.create({ runtimeIdentityId: 'rt_004' });
    registry.suspend(id.economicIdentityId, 'test');
    expect(registry.isEligibleForEconomicActions('rt_004')).toBe(false);
  });

  it('revoked identity is not eligible', () => {
    const id = registry.create({ runtimeIdentityId: 'rt_005' });
    registry.revoke(id.economicIdentityId, 'test');
    expect(registry.isEligibleForEconomicActions('rt_005')).toBe(false);
  });

  it('getByRuntimeId returns undefined for no economic identity', () => {
    expect(registry.getByRuntimeId('rt_none')).toBeUndefined();
  });

  it('bindEnvelope updates the capabilityEnvelopeId', () => {
    const id = registry.create({ runtimeIdentityId: 'rt_006' });
    registry.bindEnvelope(id.economicIdentityId, 'cap_env_1');
    expect(registry.get(id.economicIdentityId)!.capabilityEnvelopeId).toBe('cap_env_1');
  });

  it('all() returns complete list', () => {
    registry.create({ runtimeIdentityId: 'rt_a' });
    registry.create({ runtimeIdentityId: 'rt_b' });
    expect(registry.all()).toHaveLength(2);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V2: Action Classification
// ══════════════════════════════════════════════════════════════════════

describe('V2: Economic Action Classification (Round 17.7)', () => {
  it('four action kinds have distinct risk levels', () => {
    const kinds: EconomicActionKind[] = ['receive', 'claim_reward', 'spend_within_mandate', 'explicit_transfer'];
    const risks = kinds.map(k => classifyAction(k).riskLevel);

    expect(risks[0]).toBe('low');           // receive
    expect(risks[1]).toBe('medium-low');    // claim_reward
    expect(risks[2]).toBe('medium');        // spend_within_mandate
    expect(risks[3]).toBe('critical');      // explicit_transfer
  });

  it('receive does not require mandate or human confirmation', () => {
    const c = classifyAction('receive');
    expect(c.requiresMandate).toBe(false);
    expect(c.requiresHumanConfirmation).toBe(false);
    expect(c.isAutoExecutable).toBe(true);
  });

  it('spend_within_mandate requires mandate', () => {
    const c = classifyAction('spend_within_mandate');
    expect(c.requiresMandate).toBe(true);
    expect(c.isAutoExecutable).toBe(false);
  });

  it('explicit_transfer requires mandate AND human confirmation', () => {
    const c = classifyAction('explicit_transfer');
    expect(c.requiresMandate).toBe(true);
    expect(c.requiresHumanConfirmation).toBe(true);
    expect(c.isAutoExecutable).toBe(false);
  });

  it('ACTION_RISK_DEFAULTS covers all action kinds', () => {
    expect(Object.keys(ACTION_RISK_DEFAULTS)).toHaveLength(4);
  });

  it('EXTERNAL_SOURCES contains untrusted origins', () => {
    expect(EXTERNAL_SOURCES.has('external_text')).toBe(true);
    expect(EXTERNAL_SOURCES.has('prompt_injection')).toBe(true);
    expect(EXTERNAL_SOURCES.has('internal')).toBe(false);
  });

  it('createCandidate assigns risk and ID automatically', () => {
    const c = createCandidate({
      actionKind: 'receive',
      source: 'internal',
      sourceContext: 'test',
      amountCents: 100,
      asset: 'USDC',
      purpose: 'test',
    });
    expect(c.id).toBeTruthy();
    expect(c.riskLevel).toBe('low');
    expect(c.createdAt).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════
// V3: Capability Envelope
// ══════════════════════════════════════════════════════════════════════

describe('V3: Capability Envelope (Round 17.7)', () => {
  let manager: CapabilityEnvelopeManager;

  beforeEach(() => {
    manager = new CapabilityEnvelopeManager();
  });

  it('createDefault grants only receive_only', () => {
    const env = manager.createDefault('econ_1');
    expect(env.grantedScopes.has('receive_only')).toBe(true);
    expect(env.deniedScopes.has('explicit_transfer')).toBe(true);
    expect(env.deniedScopes.has('spend_within_mandate')).toBe(true);
  });

  it('explicit_transfer is denied by default', () => {
    const env = manager.createDefault('econ_2');
    expect(manager.hasCapability(env.envelopeId, 'explicit_transfer')).toBe(false);
  });

  it('custom creation grants specified scopes', () => {
    const env = manager.create('econ_3', ['receive_only', 'claim_reward']);
    expect(env.grantedScopes.has('receive_only')).toBe(true);
    expect(env.grantedScopes.has('claim_reward')).toBe(true);
    expect(env.deniedScopes.has('spend_within_mandate')).toBe(true);
  });

  it('prevents duplicate envelope for same identity', () => {
    manager.create('econ_4', ['receive_only']);
    expect(() => manager.create('econ_4', ['receive_only'])).toThrow();
  });

  it('grantScope adds capability', () => {
    const env = manager.createDefault('econ_5');
    manager.grantScope(env.envelopeId, 'claim_reward');
    expect(manager.hasCapability(env.envelopeId, 'claim_reward')).toBe(true);
  });

  it('revokeScope removes capability', () => {
    const env = manager.create('econ_6', ['receive_only', 'claim_reward']);
    manager.revokeScope(env.envelopeId, 'claim_reward');
    expect(manager.hasCapability(env.envelopeId, 'claim_reward')).toBe(false);
  });

  it('getChangeLog records scope changes', () => {
    const env = manager.createDefault('econ_7');
    manager.grantScope(env.envelopeId, 'spend_within_mandate');
    manager.revokeScope(env.envelopeId, 'spend_within_mandate');
    const log = manager.getChangeLog();
    expect(log).toHaveLength(2);
    expect(log[0].action).toBe('grant');
    expect(log[1].action).toBe('revoke');
  });

  it('getByEconomicIdentity returns correct envelope', () => {
    manager.create('econ_8', ['receive_only']);
    const found = manager.getByEconomicIdentity('econ_8');
    expect(found).toBeDefined();
    expect(found!.economicIdentityId).toBe('econ_8');
  });
});

// ══════════════════════════════════════════════════════════════════════
// V4: Mandate Engine
// ══════════════════════════════════════════════════════════════════════

describe('V4: Mandate Engine (Round 17.7)', () => {
  let engine: MandateEngine;

  beforeEach(() => {
    engine = new MandateEngine();
  });

  it('creates mandate with valid parameters', () => {
    const mandate = engine.create({
      economicIdentityId: 'econ_1',
      purpose: 'inference costs',
      maxTotalAmount: 10000,
      maxPerTransactionAmount: 1000,
      validUntil: futureDate(30),
      allowedActionKinds: ['spend_within_mandate'],
      approvedBy: 'operator',
    });
    expect(mandate.mandateId).toBeTruthy();
    expect(mandate.status).toBe('active');
    expect(mandate.remainingBudget).toBe(10000);
  });

  it('matches candidate to valid mandate', () => {
    engine.create({
      economicIdentityId: 'econ_1',
      purpose: 'inference',
      maxTotalAmount: 5000,
      maxPerTransactionAmount: 1000,
      validUntil: futureDate(30),
      allowedActionKinds: ['spend_within_mandate'],
      approvedBy: 'operator',
    });

    const candidate = makeCandidate({
      actionKind: 'spend_within_mandate',
      amountCents: 500,
    });
    const result = engine.match(candidate, 'econ_1');
    expect(result.matched).toBe(true);
    expect(result.mandateId).toBeTruthy();
  });

  it('rejects when no mandates exist', () => {
    const candidate = makeCandidate({ actionKind: 'spend_within_mandate' });
    const result = engine.match(candidate, 'econ_no_mandates');
    expect(result.matched).toBe(false);
  });

  it('rejects when amount exceeds per-transaction limit', () => {
    engine.create({
      economicIdentityId: 'econ_2',
      purpose: 'test',
      maxTotalAmount: 10000,
      maxPerTransactionAmount: 100,
      validUntil: futureDate(30),
      allowedActionKinds: ['spend_within_mandate'],
      approvedBy: 'operator',
    });

    const candidate = makeCandidate({
      actionKind: 'spend_within_mandate',
      amountCents: 500,
    });
    const result = engine.match(candidate, 'econ_2');
    expect(result.matched).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('consumes budget correctly', () => {
    const mandate = engine.create({
      economicIdentityId: 'econ_3',
      purpose: 'test',
      maxTotalAmount: 1000,
      maxPerTransactionAmount: 500,
      validUntil: futureDate(30),
      allowedActionKinds: ['spend_within_mandate'],
      approvedBy: 'operator',
    });

    expect(engine.consume(mandate.mandateId, 300)).toBe(true);
    expect(engine.get(mandate.mandateId)!.remainingBudget).toBe(700);
  });

  it('exhausts mandate when budget reaches zero', () => {
    const mandate = engine.create({
      economicIdentityId: 'econ_4',
      purpose: 'test',
      maxTotalAmount: 500,
      maxPerTransactionAmount: 500,
      validUntil: futureDate(30),
      allowedActionKinds: ['spend_within_mandate'],
      approvedBy: 'operator',
    });

    engine.consume(mandate.mandateId, 500);
    expect(engine.get(mandate.mandateId)!.status).toBe('exhausted');
  });

  it('expired mandate does not match', () => {
    engine.create({
      economicIdentityId: 'econ_5',
      purpose: 'test',
      maxTotalAmount: 5000,
      maxPerTransactionAmount: 1000,
      validUntil: pastDate(1), // already expired
      allowedActionKinds: ['spend_within_mandate'],
      approvedBy: 'operator',
    });

    const candidate = makeCandidate({ actionKind: 'spend_within_mandate' });
    const result = engine.match(candidate, 'econ_5');
    expect(result.matched).toBe(false);
  });

  it('revoke prevents future matching', () => {
    const mandate = engine.create({
      economicIdentityId: 'econ_6',
      purpose: 'test',
      maxTotalAmount: 5000,
      maxPerTransactionAmount: 1000,
      validUntil: futureDate(30),
      allowedActionKinds: ['spend_within_mandate'],
      approvedBy: 'operator',
    });

    engine.revoke(mandate.mandateId, 'security concern');
    const candidate = makeCandidate({ actionKind: 'spend_within_mandate' });
    const result = engine.match(candidate, 'econ_6');
    expect(result.matched).toBe(false);
  });

  it('rejects invalid creation parameters', () => {
    expect(() => engine.create({
      economicIdentityId: 'econ_7',
      purpose: 'test',
      maxTotalAmount: -100,
      maxPerTransactionAmount: 50,
      validUntil: futureDate(30),
      allowedActionKinds: ['spend_within_mandate'],
      approvedBy: 'operator',
    })).toThrow();
  });

  it('getActiveMandates filters correctly', () => {
    engine.create({
      economicIdentityId: 'econ_8',
      purpose: 'active one',
      maxTotalAmount: 1000,
      maxPerTransactionAmount: 500,
      validUntil: futureDate(30),
      allowedActionKinds: ['spend_within_mandate'],
      approvedBy: 'operator',
    });
    const m2 = engine.create({
      economicIdentityId: 'econ_8',
      purpose: 'revoked one',
      maxTotalAmount: 2000,
      maxPerTransactionAmount: 1000,
      validUntil: futureDate(30),
      allowedActionKinds: ['spend_within_mandate'],
      approvedBy: 'operator',
    });
    engine.revoke(m2.mandateId, 'test');

    expect(engine.getActiveMandates('econ_8')).toHaveLength(1);
    expect(engine.all()).toHaveLength(2);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V5: External Text Cannot Form explicit_transfer
// ══════════════════════════════════════════════════════════════════════

describe('V5: External Source Blocking (Round 17.7)', () => {
  let firewall: EconomicInstructionFirewall;
  let idRegistry: EconomicIdentityRegistry;
  let envManager: CapabilityEnvelopeManager;

  beforeEach(() => {
    idRegistry = new EconomicIdentityRegistry();
    envManager = new CapabilityEnvelopeManager();
    const mandateEngine = new MandateEngine();
    firewall = new EconomicInstructionFirewall(idRegistry, envManager, mandateEngine);

    // Setup: active identity with all capabilities
    const id = idRegistry.create({ runtimeIdentityId: 'rt_v5' });
    const env = envManager.create(id.economicIdentityId, [
      'receive_only', 'claim_reward', 'spend_within_mandate', 'explicit_transfer',
    ]);
    idRegistry.bindEnvelope(id.economicIdentityId, env.envelopeId);
  });

  it('blocks external_text → explicit_transfer', () => {
    const candidate = makeCandidate({
      actionKind: 'explicit_transfer',
      source: 'external_text',
      amountCents: 1000,
    });
    const verdict = firewall.evaluate(candidate, 'rt_v5');
    expect(verdict.allowed).toBe(false);
    expect(verdict.rejectionReasons.some(r => r.includes('External source'))).toBe(true);
  });

  it('blocks webpage → explicit_transfer', () => {
    const candidate = makeCandidate({
      actionKind: 'explicit_transfer',
      source: 'webpage',
      amountCents: 500,
    });
    const verdict = firewall.evaluate(candidate, 'rt_v5');
    expect(verdict.allowed).toBe(false);
  });

  it('blocks prompt_injection → any action', () => {
    const candidate = makeCandidate({
      actionKind: 'receive',
      source: 'prompt_injection',
    });
    const verdict = firewall.evaluate(candidate, 'rt_v5');
    expect(verdict.allowed).toBe(false);
    expect(verdict.rejectionReasons.some(r => r.includes('blocked'))).toBe(true);
  });

  it('allows internal → explicit_transfer (with human confirmation pending)', () => {
    const candidate = makeCandidate({
      actionKind: 'explicit_transfer',
      source: 'internal',
      amountCents: 1000,
    });
    // Need a mandate for internal explicit_transfer
    const mandateEngine = new MandateEngine();
    const fw = new EconomicInstructionFirewall(idRegistry, envManager, mandateEngine);
    const econId = idRegistry.getByRuntimeId('rt_v5')!;
    mandateEngine.create({
      economicIdentityId: econId.economicIdentityId,
      purpose: 'transfer',
      maxTotalAmount: 5000,
      maxPerTransactionAmount: 2000,
      validUntil: futureDate(30),
      allowedActionKinds: ['explicit_transfer'],
      approvedBy: 'operator',
    });

    const verdict = fw.evaluate(candidate, 'rt_v5');
    // Should be pending human confirmation, not rejected
    expect(verdict.finalDecision).toBe('pending_human_confirmation');
  });

  it('allows internal → receive (auto-approved)', () => {
    const candidate = makeCandidate({
      actionKind: 'receive',
      source: 'internal',
    });
    const verdict = firewall.evaluate(candidate, 'rt_v5');
    expect(verdict.allowed).toBe(true);
    expect(verdict.finalDecision).toBe('approved');
  });
});

// ══════════════════════════════════════════════════════════════════════
// V6: Firewall 5-Layer Pipeline
// ══════════════════════════════════════════════════════════════════════

describe('V6: Firewall Pipeline (Round 17.7)', () => {
  it('all 5 check layers present in verdict', () => {
    const foundation = createEconomicKernelFoundation();
    const id = foundation.identityRegistry.create({ runtimeIdentityId: 'rt_v6' });
    const env = foundation.envelopeManager.createDefault(id.economicIdentityId);
    foundation.identityRegistry.bindEnvelope(id.economicIdentityId, env.envelopeId);

    const candidate = makeCandidate({ actionKind: 'receive', source: 'internal' });
    const verdict = foundation.evaluate(candidate, 'rt_v6');

    expect(verdict.checks).toBeDefined();
    expect(verdict.checks.sourceTrustEvaluation).toBeDefined();
    expect(verdict.checks.policyCheck).toBeDefined();
    expect(verdict.checks.riskScoring).toBeDefined();
    expect(verdict.checks.capabilityCheck).toBeDefined();
    expect(verdict.checks.mandateCheck).toBeDefined();
    expect(typeof verdict.checks.humanConfirmationRequired).toBe('boolean');
  });

  it('rejects when no economic identity exists', () => {
    const foundation = createEconomicKernelFoundation();
    const candidate = makeCandidate({ actionKind: 'receive', source: 'internal' });
    const verdict = foundation.evaluate(candidate, 'rt_no_econ_id');

    expect(verdict.allowed).toBe(false);
    expect(verdict.checks.capabilityCheck.passed).toBe(false);
  });

  it('rejects when capability not granted', () => {
    const foundation = createEconomicKernelFoundation();
    const id = foundation.identityRegistry.create({ runtimeIdentityId: 'rt_v6b' });
    const env = foundation.envelopeManager.createDefault(id.economicIdentityId); // receive_only
    foundation.identityRegistry.bindEnvelope(id.economicIdentityId, env.envelopeId);

    const candidate = makeCandidate({
      actionKind: 'spend_within_mandate',
      source: 'internal',
      amountCents: 100,
    });
    const verdict = foundation.evaluate(candidate, 'rt_v6b');

    expect(verdict.allowed).toBe(false);
    expect(verdict.checks.capabilityCheck.passed).toBe(false);
    expect(verdict.checks.capabilityCheck.missingScope).toBe('spend_within_mandate');
  });

  it('approved receive action passes all layers', () => {
    const foundation = createEconomicKernelFoundation();
    const id = foundation.identityRegistry.create({ runtimeIdentityId: 'rt_v6c' });
    const env = foundation.envelopeManager.createDefault(id.economicIdentityId);
    foundation.identityRegistry.bindEnvelope(id.economicIdentityId, env.envelopeId);

    const candidate = makeCandidate({ actionKind: 'receive', source: 'internal' });
    const verdict = foundation.evaluate(candidate, 'rt_v6c');

    expect(verdict.allowed).toBe(true);
    expect(verdict.checks.sourceTrustEvaluation.passed).toBe(true);
    expect(verdict.checks.policyCheck.passed).toBe(true);
    expect(verdict.checks.riskScoring.passed).toBe(true);
    expect(verdict.checks.capabilityCheck.passed).toBe(true);
    expect(verdict.checks.mandateCheck.passed).toBe(true);
  });

  it('spend with valid mandate passes', () => {
    const foundation = createEconomicKernelFoundation();
    const id = foundation.identityRegistry.create({ runtimeIdentityId: 'rt_v6d' });
    foundation.envelopeManager.create(id.economicIdentityId, [
      'receive_only', 'spend_within_mandate',
    ]);
    foundation.identityRegistry.bindEnvelope(
      id.economicIdentityId,
      foundation.envelopeManager.getByEconomicIdentity(id.economicIdentityId)!.envelopeId,
    );
    foundation.mandateEngine.create({
      economicIdentityId: id.economicIdentityId,
      purpose: 'inference',
      maxTotalAmount: 5000,
      maxPerTransactionAmount: 1000,
      validUntil: futureDate(30),
      allowedActionKinds: ['spend_within_mandate'],
      approvedBy: 'operator',
    });

    const candidate = makeCandidate({
      actionKind: 'spend_within_mandate',
      source: 'internal',
      amountCents: 500,
    });
    const verdict = foundation.evaluate(candidate, 'rt_v6d');
    expect(verdict.allowed).toBe(true);
    expect(verdict.checks.mandateCheck.passed).toBe(true);
    expect(verdict.checks.mandateCheck.mandateId).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════
// V7: Audit Events
// ══════════════════════════════════════════════════════════════════════

describe('V7: Economic Audit Log (Round 17.7)', () => {
  it('foundation.evaluate() produces audit event', () => {
    const foundation = createEconomicKernelFoundation();
    const id = foundation.identityRegistry.create({ runtimeIdentityId: 'rt_v7' });
    foundation.envelopeManager.createDefault(id.economicIdentityId);
    foundation.identityRegistry.bindEnvelope(
      id.economicIdentityId,
      foundation.envelopeManager.getByEconomicIdentity(id.economicIdentityId)!.envelopeId,
    );

    const candidate = makeCandidate({ actionKind: 'receive', source: 'internal' });
    foundation.evaluate(candidate, 'rt_v7');

    const events = foundation.auditLog.getRecent(10);
    expect(events).toHaveLength(1);
    expect(events[0].runtimeIdentityId).toBe('rt_v7');
    expect(events[0].actionClassification).toBe('receive');
    expect(events[0].firewallResult).toBe('approved');
    expect(events[0].eventId).toBeTruthy();
  });

  it('rejected action produces audit event with reasons', () => {
    const foundation = createEconomicKernelFoundation();
    // No economic identity → should be rejected
    const candidate = makeCandidate({ actionKind: 'receive', source: 'internal' });
    foundation.evaluate(candidate, 'rt_no_id');

    const events = foundation.auditLog.getRecent(10);
    expect(events).toHaveLength(1);
    expect(events[0].firewallResult).toBe('rejected');
    expect(events[0].rejectionReasons.length).toBeGreaterThan(0);
    expect(events[0].capabilityCheckPassed).toBe(false);
  });

  it('audit stats reflect evaluations', () => {
    const foundation = createEconomicKernelFoundation();
    const id = foundation.identityRegistry.create({ runtimeIdentityId: 'rt_v7b' });
    foundation.envelopeManager.createDefault(id.economicIdentityId);
    foundation.identityRegistry.bindEnvelope(
      id.economicIdentityId,
      foundation.envelopeManager.getByEconomicIdentity(id.economicIdentityId)!.envelopeId,
    );

    // One approved
    foundation.evaluate(makeCandidate({ actionKind: 'receive', source: 'internal' }), 'rt_v7b');
    // One rejected (no identity for this runtime id)
    foundation.evaluate(makeCandidate({ actionKind: 'receive', source: 'internal' }), 'rt_ghost');

    const stats = foundation.auditLog.stats();
    expect(stats.total).toBe(2);
    expect(stats.approved).toBe(1);
    expect(stats.rejected).toBe(1);
  });

  it('standalone EconomicAuditLog works independently', () => {
    const log = new EconomicAuditLog();
    log.record({
      runtimeIdentityId: 'rt_test',
      economicIdentityId: 'econ_1',
      actionClassification: 'receive',
      candidateId: 'c_1',
      candidateSource: 'internal',
      amountCents: 100,
      firewallResult: 'approved',
      mandateUsed: null,
      mandateDenied: false,
      mandateDenialReason: null,
      capabilityCheckPassed: true,
      sourceTrustPassed: true,
      rejectionReasons: [],
      finalDecision: 'approved',
    });

    expect(log.getRecent()).toHaveLength(1);
    expect(log.getByIdentity('econ_1')).toHaveLength(1);
    expect(log.stats().approved).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V8: API Control Surface Routes
// ══════════════════════════════════════════════════════════════════════

describe('V8: API Routes (Round 17.7)', () => {
  it('creates 4 new economic foundation routes', () => {
    const foundation = createEconomicKernelFoundation();
    const routes = createApiRoutes({
      economicKernelFoundation: foundation as any,
    });

    const foundationPaths = [
      '/api/economic/identity',
      '/api/economic/capabilities',
      '/api/economic/mandates',
      '/api/economic/firewall',
    ];

    for (const path of foundationPaths) {
      const route = routes.find(r => r.path === path);
      expect(route, `Route ${path} should exist`).toBeDefined();
      expect(route!.method).toBe('GET');
    }
  });

  it('/api/economic/identity returns identities', async () => {
    const foundation = createEconomicKernelFoundation();
    foundation.identityRegistry.create({ runtimeIdentityId: 'rt_api_test' });

    const routes = createApiRoutes({
      economicKernelFoundation: foundation as any,
    });
    const route = routes.find(r => r.path === '/api/economic/identity')!;
    const result = await route.handler() as any;
    expect(result.totalCount).toBe(1);
    expect(result.identities).toHaveLength(1);
  });

  it('/api/economic/firewall returns stats', async () => {
    const foundation = createEconomicKernelFoundation();
    const routes = createApiRoutes({
      economicKernelFoundation: foundation as any,
    });
    const route = routes.find(r => r.path === '/api/economic/firewall')!;
    const result = await route.handler() as any;
    expect(result.stats).toBeDefined();
    expect(result.auditStats).toBeDefined();
    expect(result.stats.totalEvaluated).toBe(0);
  });

  it('routes return error when foundation not configured', async () => {
    const routes = createApiRoutes({});
    const route = routes.find(r => r.path === '/api/economic/identity')!;
    const result = await route.handler() as any;
    expect(result.error).toContain('not configured');
  });
});

// ══════════════════════════════════════════════════════════════════════
// V9: No New Auto-Execute High-Risk Outbound Paths
// ══════════════════════════════════════════════════════════════════════

describe('V9: No Auto-Execute High-Risk Outbound (Round 17.7)', () => {
  it('explicit_transfer is never auto-executable', () => {
    const c = classifyAction('explicit_transfer');
    expect(c.isAutoExecutable).toBe(false);
    expect(c.requiresHumanConfirmation).toBe(true);
  });

  it('spend_within_mandate is never auto-executable', () => {
    const c = classifyAction('spend_within_mandate');
    expect(c.isAutoExecutable).toBe(false);
    expect(c.requiresMandate).toBe(true);
  });

  it('only receive and claim_reward are auto-executable', () => {
    const kinds: EconomicActionKind[] = ['receive', 'claim_reward', 'spend_within_mandate', 'explicit_transfer'];
    const autoExec = kinds.filter(k => classifyAction(k).isAutoExecutable);
    expect(autoExec).toEqual(['receive', 'claim_reward']);
  });

  it('internal explicit_transfer always requires human confirmation', () => {
    const foundation = createEconomicKernelFoundation();
    const id = foundation.identityRegistry.create({ runtimeIdentityId: 'rt_v9' });
    foundation.envelopeManager.create(id.economicIdentityId, [
      'receive_only', 'explicit_transfer',
    ]);
    foundation.identityRegistry.bindEnvelope(
      id.economicIdentityId,
      foundation.envelopeManager.getByEconomicIdentity(id.economicIdentityId)!.envelopeId,
    );
    foundation.mandateEngine.create({
      economicIdentityId: id.economicIdentityId,
      purpose: 'transfer',
      maxTotalAmount: 10000,
      maxPerTransactionAmount: 5000,
      validUntil: futureDate(30),
      allowedActionKinds: ['explicit_transfer'],
      approvedBy: 'operator',
    });

    const candidate = makeCandidate({
      actionKind: 'explicit_transfer',
      source: 'internal',
      amountCents: 1000,
    });
    const verdict = foundation.evaluate(candidate, 'rt_v9');

    // Even with all checks passing, explicit_transfer requires human confirmation
    expect(verdict.finalDecision).toBe('pending_human_confirmation');
    expect(verdict.allowed).toBe(false); // Not fully approved until human confirms
    expect(verdict.checks.humanConfirmationRequired).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Integration: EconomicKernelFoundation Factory
// ══════════════════════════════════════════════════════════════════════

describe('EconomicKernelFoundation Integration (Round 17.7)', () => {
  it('createEconomicKernelFoundation returns all components', () => {
    const foundation = createEconomicKernelFoundation();
    expect(foundation.identityRegistry).toBeDefined();
    expect(foundation.envelopeManager).toBeDefined();
    expect(foundation.mandateEngine).toBeDefined();
    expect(foundation.firewall).toBeDefined();
    expect(foundation.auditLog).toBeDefined();
    expect(typeof foundation.evaluate).toBe('function');
  });

  it('end-to-end: create identity → envelope → mandate → evaluate', () => {
    const foundation = createEconomicKernelFoundation();

    // 1. Create economic identity
    const econId = foundation.identityRegistry.create({
      runtimeIdentityId: 'rt_e2e',
    });

    // 2. Create capability envelope with spend permission
    const env = foundation.envelopeManager.create(econId.economicIdentityId, [
      'receive_only', 'spend_within_mandate',
    ]);
    foundation.identityRegistry.bindEnvelope(econId.economicIdentityId, env.envelopeId);

    // 3. Create mandate
    foundation.mandateEngine.create({
      economicIdentityId: econId.economicIdentityId,
      purpose: 'inference costs',
      maxTotalAmount: 5000,
      maxPerTransactionAmount: 1000,
      validUntil: futureDate(30),
      allowedActionKinds: ['spend_within_mandate'],
      approvedBy: 'operator',
    });

    // 4. Evaluate spend action → should be approved
    const spendCandidate = makeCandidate({
      actionKind: 'spend_within_mandate',
      source: 'internal',
      amountCents: 500,
    });
    const spendVerdict = foundation.evaluate(spendCandidate, 'rt_e2e');
    expect(spendVerdict.allowed).toBe(true);
    expect(spendVerdict.finalDecision).toBe('approved');

    // 5. Evaluate receive action → should be approved
    const receiveCandidate = makeCandidate({
      actionKind: 'receive',
      source: 'external_text',
      amountCents: 1000,
    });
    const receiveVerdict = foundation.evaluate(receiveCandidate, 'rt_e2e');
    expect(receiveVerdict.allowed).toBe(true);

    // 6. Evaluate external transfer → should be blocked
    const transferCandidate = makeCandidate({
      actionKind: 'explicit_transfer',
      source: 'external_text',
      amountCents: 1000,
    });
    const transferVerdict = foundation.evaluate(transferCandidate, 'rt_e2e');
    expect(transferVerdict.allowed).toBe(false);

    // 7. Verify audit log captured all 3 evaluations
    expect(foundation.auditLog.stats().total).toBe(3);

    // 8. Verify firewall stats
    const fwStats = foundation.firewall.stats();
    expect(fwStats.totalEvaluated).toBe(3);
    expect(fwStats.approved).toBe(2);      // receive + spend
    expect(fwStats.blockedExternal).toBe(1); // external transfer
  });
});
