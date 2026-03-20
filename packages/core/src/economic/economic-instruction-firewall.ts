/**
 * Round 17.7 — G5: Economic Instruction Firewall
 *
 * The central gatekeeper for all candidate economic actions entering
 * the ConShell economic runtime. Every action — internal or external —
 * passes through a 5-layer evaluation pipeline:
 *
 *   1. Source Trust Evaluation
 *   2. Policy Check (action classification)
 *   3. Risk Scoring
 *   4. Capability Check (envelope)
 *   5. Mandate Check (authorization)
 *
 * Design invariants:
 * - External text can NEVER directly produce explicit_transfer
 * - spend_within_mandate ONLY executes with a matching mandate
 * - All evaluations produce auditable verdicts
 * - No new auto-execute high-risk outbound paths are created
 */

import type {
  CandidateEconomicAction,
  EconomicActionKind,
  EconomicRiskLevel,
  ActionSource,
} from './economic-action-classification.js';
import { classifyAction, EXTERNAL_SOURCES } from './economic-action-classification.js';
import type { EconomicIdentityRegistry } from './economic-identity.js';
import type { CapabilityEnvelopeManager, CapabilityScope } from './capability-envelope.js';
import type { MandateEngine } from './mandate-engine.js';

// ── Firewall Configuration ───────────────────────────────────────────

/** Action kinds that external sources can NEVER directly produce. */
const BLOCKED_EXTERNAL_ACTIONS: ReadonlySet<EconomicActionKind> = new Set([
  'explicit_transfer',
]);

/** Map from EconomicActionKind to required CapabilityScope. */
const ACTION_TO_SCOPE: Readonly<Record<EconomicActionKind, CapabilityScope>> = {
  receive: 'receive_only',
  claim_reward: 'claim_reward',
  spend_within_mandate: 'spend_within_mandate',
  explicit_transfer: 'explicit_transfer',
};

// ── Trust Levels ─────────────────────────────────────────────────────

const SOURCE_TRUST: Readonly<Record<ActionSource, string>> = {
  internal: 'high',
  skill_output: 'medium',
  tool_return: 'medium',
  webhook: 'low',
  external_text: 'untrusted',
  document: 'untrusted',
  webpage: 'untrusted',
  red_packet: 'untrusted',
  prompt_injection: 'blocked',
};

// ── Verdict Types ────────────────────────────────────────────────────

export type FirewallDecision = 'approved' | 'rejected' | 'pending_human_confirmation';

export interface SourceTrustCheck {
  readonly passed: boolean;
  readonly trustLevel: string;
}

export interface PolicyCheckResult {
  readonly passed: boolean;
  readonly reason: string;
}

export interface RiskScoringResult {
  readonly passed: boolean;
  readonly score: EconomicRiskLevel;
}

export interface CapabilityCheckResult {
  readonly passed: boolean;
  readonly missingScope?: CapabilityScope;
}

export interface MandateCheckResult {
  readonly passed: boolean;
  readonly mandateId?: string;
  readonly reason?: string;
}

export interface FirewallChecks {
  readonly sourceTrustEvaluation: SourceTrustCheck;
  readonly policyCheck: PolicyCheckResult;
  readonly riskScoring: RiskScoringResult;
  readonly capabilityCheck: CapabilityCheckResult;
  readonly mandateCheck: MandateCheckResult;
  readonly humanConfirmationRequired: boolean;
}

export interface FirewallVerdict {
  readonly allowed: boolean;
  readonly candidateId: string;
  readonly actionKind: EconomicActionKind;
  readonly checks: FirewallChecks;
  readonly finalDecision: FirewallDecision;
  readonly rejectionReasons: readonly string[];
  readonly timestamp: string;
}

export interface FirewallStats {
  readonly totalEvaluated: number;
  readonly approved: number;
  readonly rejected: number;
  readonly pendingHuman: number;
  readonly blockedExternal: number;
}

// ── Firewall ─────────────────────────────────────────────────────────

export class EconomicInstructionFirewall {
  private verdicts: FirewallVerdict[] = [];
  private statsCounters = { evaluated: 0, approved: 0, rejected: 0, pendingHuman: 0, blockedExternal: 0 };

  constructor(
    private readonly identityRegistry: EconomicIdentityRegistry,
    private readonly envelopeManager: CapabilityEnvelopeManager,
    private readonly mandateEngine: MandateEngine,
  ) {}

  /**
   * Evaluate a candidate economic action through the 5-layer pipeline.
   * Returns a comprehensive verdict with per-check results.
   */
  evaluate(
    candidate: CandidateEconomicAction,
    runtimeIdentityId: string,
  ): FirewallVerdict {
    this.statsCounters.evaluated++;
    const rejectionReasons: string[] = [];

    // ── Layer 1: Source Trust Evaluation ──────────────────────────────
    const trustLevel = SOURCE_TRUST[candidate.source] ?? 'untrusted';
    const isExternalSource = EXTERNAL_SOURCES.has(candidate.source);
    const sourceBlocked =
      trustLevel === 'blocked' ||
      (isExternalSource && BLOCKED_EXTERNAL_ACTIONS.has(candidate.actionKind));

    const sourceTrustEvaluation: SourceTrustCheck = {
      passed: !sourceBlocked,
      trustLevel,
    };

    if (sourceBlocked) {
      if (trustLevel === 'blocked') {
        rejectionReasons.push(`Source '${candidate.source}' is blocked (suspected injection)`);
        this.statsCounters.blockedExternal++;
      } else {
        rejectionReasons.push(
          `External source '${candidate.source}' cannot produce '${candidate.actionKind}' actions`,
        );
        this.statsCounters.blockedExternal++;
      }
    }

    // ── Layer 2: Policy Check (action classification) ────────────────
    const classification = classifyAction(candidate.actionKind);
    const policyCheck: PolicyCheckResult = {
      passed: true, // classification itself always passes; decisions flow downstream
      reason: `Action '${candidate.actionKind}' classified at risk level '${classification.riskLevel}'`,
    };

    // ── Layer 3: Risk Scoring ────────────────────────────────────────
    const riskScoring: RiskScoringResult = {
      passed: candidate.riskLevel !== 'critical' || candidate.source === 'internal',
      score: candidate.riskLevel,
    };
    if (!riskScoring.passed) {
      rejectionReasons.push(`Critical risk action from non-internal source`);
    }

    // ── Layer 4: Capability Check ────────────────────────────────────
    let capabilityCheck: CapabilityCheckResult = { passed: false, missingScope: undefined };

    const econIdentity = this.identityRegistry.getByRuntimeId(runtimeIdentityId);
    if (!econIdentity) {
      capabilityCheck = { passed: false, missingScope: undefined };
      rejectionReasons.push(`No economic identity for runtimeId '${runtimeIdentityId}'`);
    } else if (econIdentity.status !== 'active') {
      capabilityCheck = { passed: false, missingScope: undefined };
      rejectionReasons.push(`Economic identity is '${econIdentity.status}', not active`);
    } else {
      const requiredScope = ACTION_TO_SCOPE[candidate.actionKind];
      const envelope = this.envelopeManager.getByEconomicIdentity(econIdentity.economicIdentityId);
      if (!envelope) {
        capabilityCheck = { passed: false, missingScope: requiredScope };
        rejectionReasons.push(`No capability envelope for economic identity`);
      } else if (!envelope.grantedScopes.has(requiredScope)) {
        capabilityCheck = { passed: false, missingScope: requiredScope };
        rejectionReasons.push(
          `Capability '${requiredScope}' not granted (required for '${candidate.actionKind}')`,
        );
      } else {
        capabilityCheck = { passed: true };
      }
    }

    // ── Layer 5: Mandate Check ───────────────────────────────────────
    let mandateCheck: MandateCheckResult = { passed: true };

    if (classification.requiresMandate && econIdentity && econIdentity.status === 'active') {
      const matchResult = this.mandateEngine.match(candidate, econIdentity.economicIdentityId);
      if (!matchResult.matched) {
        mandateCheck = {
          passed: false,
          reason: matchResult.rejectionReason ?? 'No matching mandate',
        };
        rejectionReasons.push(
          `No matching mandate: ${matchResult.rejectionReason ?? 'unknown reason'}`,
        );
      } else {
        mandateCheck = { passed: true, mandateId: matchResult.mandateId! };
      }
    } else if (classification.requiresMandate && (!econIdentity || econIdentity.status !== 'active')) {
      // Already rejected in capability layer — mark mandate as not passed too
      mandateCheck = { passed: false, reason: 'No active economic identity' };
    }

    // ── Final Decision ───────────────────────────────────────────────
    const humanConfirmationRequired = classification.requiresHumanConfirmation;
    const allChecks =
      sourceTrustEvaluation.passed &&
      policyCheck.passed &&
      riskScoring.passed &&
      capabilityCheck.passed &&
      mandateCheck.passed;

    let finalDecision: FirewallDecision;
    if (!allChecks) {
      finalDecision = 'rejected';
      this.statsCounters.rejected++;
    } else if (humanConfirmationRequired) {
      finalDecision = 'pending_human_confirmation';
      this.statsCounters.pendingHuman++;
    } else {
      finalDecision = 'approved';
      this.statsCounters.approved++;
    }

    const verdict: FirewallVerdict = {
      allowed: finalDecision === 'approved',
      candidateId: candidate.id,
      actionKind: candidate.actionKind,
      checks: {
        sourceTrustEvaluation,
        policyCheck,
        riskScoring,
        capabilityCheck,
        mandateCheck,
        humanConfirmationRequired,
      },
      finalDecision,
      rejectionReasons,
      timestamp: new Date().toISOString(),
    };

    this.verdicts.push(verdict);
    return verdict;
  }

  /** Get firewall statistics. */
  stats(): FirewallStats {
    return {
      totalEvaluated: this.statsCounters.evaluated,
      approved: this.statsCounters.approved,
      rejected: this.statsCounters.rejected,
      pendingHuman: this.statsCounters.pendingHuman,
      blockedExternal: this.statsCounters.blockedExternal,
    };
  }

  /** Get recent blocked verdicts. */
  recentBlocks(limit = 10): ReadonlyArray<FirewallVerdict> {
    return this.verdicts
      .filter(v => v.finalDecision === 'rejected')
      .slice(-limit);
  }

  /** Get all verdicts. */
  allVerdicts(): ReadonlyArray<FirewallVerdict> {
    return [...this.verdicts];
  }
}
