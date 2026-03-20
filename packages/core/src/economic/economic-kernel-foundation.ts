/**
 * Round 17.7 → 17.9: Economic Kernel Foundation (Factory)
 *
 * Option 2 architecture: wraps the existing EconomicKernel with a
 * governance envelope layer. The foundation enforces identity,
 * capability, mandate, and firewall checks BEFORE passing actions
 * to the underlying economic machinery.
 *
 * Round 17.8 additions:
 * - RewardRegistry + ClaimEngine integration
 * - generateTruthReport() for diagnosis-first reporting
 *
 * Round 17.9 additions:
 * - PaymentNegotiationEngine + ProviderSelector
 * - PaymentPreparationManager + PaymentNegotiationAuditLog
 * - negotiate() convenience wrapper
 *
 * Design invariants:
 * - Does NOT modify existing EconomicKernel
 * - All new governance components are initialized together
 * - Provides a unified evaluate() entry point
 * - Audit log captures every evaluation
 * - Payment negotiation CANNOT bypass firewall
 */

import { EconomicIdentityRegistry } from './economic-identity.js';
import type { EconomicIdentity } from './economic-identity.js';
import { CapabilityEnvelopeManager } from './capability-envelope.js';
import { MandateEngine } from './mandate-engine.js';
import { EconomicInstructionFirewall } from './economic-instruction-firewall.js';
import type { FirewallVerdict } from './economic-instruction-firewall.js';
import { EconomicAuditLog } from './economic-audit-event.js';
import type { CandidateEconomicAction } from './economic-action-classification.js';
import { RewardRegistry } from './reward-definition.js';
import { ClaimEngine } from './claim-lifecycle.js';
import type { ClaimResult } from './claim-lifecycle.js';
import { generateEconomicTruthReport } from './economic-truth-report.js';
import type { EconomicTruthReport, RewardClaimSummary } from './economic-truth-report.js';
import { PaymentNegotiationEngine } from './payment-negotiation.js';
import type { PaymentNegotiationResult, PaymentOffer } from './payment-negotiation.js';
import { ProviderSelector } from './provider-selection.js';
import { PaymentPreparationManager, PaymentNegotiationAuditLog } from './payment-preparation.js';
import { SettlementExecutionEngine } from './settlement-execution.js';
import { RevenueRealizationManager } from './revenue-realization.js';
import { CanonicalLedgerAdopter } from './canonical-ledger.js';
import { SettlementGovernanceLayer } from './settlement-governance.js';
import { CanonicalSettlementLedger } from './settlement-ledger.js';
import { SettlementFeedbackEngine } from './settlement-feedback.js';
import { SettlementRuntimeService } from './settlement-orchestrator.js';
import { SettlementSystemCoupling } from './settlement-system-coupling.js';

// ── Interface ────────────────────────────────────────────────────────

export interface EconomicKernelFoundation {
  readonly identityRegistry: EconomicIdentityRegistry;
  readonly envelopeManager: CapabilityEnvelopeManager;
  readonly mandateEngine: MandateEngine;
  readonly firewall: EconomicInstructionFirewall;
  readonly auditLog: EconomicAuditLog;
  /** Round 17.8: Reward definitions and registry */
  readonly rewardRegistry: RewardRegistry;
  /** Round 17.8: Claim lifecycle engine */
  readonly claimEngine: ClaimEngine;
  /** Round 17.9: Payment negotiation engine */
  readonly negotiationEngine: PaymentNegotiationEngine;
  /** Round 17.9: Provider selector/router */
  readonly providerSelector: ProviderSelector;
  /** Round 17.9: Payment preparation manager */
  readonly preparationManager: PaymentPreparationManager;
  /** Round 17.9: Negotiation audit log */
  readonly negotiationAuditLog: PaymentNegotiationAuditLog;
  /** Round 18.0: Settlement execution engine */
  readonly settlementExecutionEngine: SettlementExecutionEngine;
  /** Round 18.0: Revenue realization manager */
  readonly revenueRealizationManager: RevenueRealizationManager;
  /** Round 18.0: Canonical ledger adopter */
  readonly canonicalLedgerAdopter: CanonicalLedgerAdopter;
  /** Round 18.1: Settlement governance layer */
  readonly governanceLayer: SettlementGovernanceLayer;
  /** Round 18.1: Canonical settlement ledger */
  readonly settlementLedger: CanonicalSettlementLedger;
  /** Round 18.1: Settlement feedback engine */
  readonly feedbackEngine: SettlementFeedbackEngine;
  /** Round 18.2: Unified settlement runtime orchestrator (CANONICAL entry point) */
  readonly settlementRuntime: SettlementRuntimeService;
  /** Round 18.3: Settlement system coupling (writeback to economic runtime) */
  readonly settlementCoupling: SettlementSystemCoupling;

  /**
   * High-level entry point: evaluate a candidate economic action.
   * 1. Runs the firewall pipeline
   * 2. Records an audit event
   * 3. Returns the verdict
   */
  evaluate(
    candidate: CandidateEconomicAction,
    runtimeIdentityId: string,
  ): FirewallVerdict;

  /** Round 17.8: Generate diagnosis-first economic truth report. */
  generateTruthReport(): EconomicTruthReport;

  /** Round 17.8: Attempt a reward claim (convenience wrapper). */
  attemptClaim(rewardId: string, economicIdentityId: string): ClaimResult;

  /**
   * Round 17.9: Negotiate a payment requirement.
   * Convenience wrapper that runs the full decision pipeline
   * and records audit events.
   */
  negotiate(
    requirementId: string,
    economicIdentityId: string,
    runtimeIdentityId: string,
    offers: readonly PaymentOffer[],
  ): PaymentNegotiationResult;
}

// ── Factory ──────────────────────────────────────────────────────────

export function createEconomicKernelFoundation(): EconomicKernelFoundation {
  const identityRegistry = new EconomicIdentityRegistry();
  const envelopeManager = new CapabilityEnvelopeManager();
  const mandateEngine = new MandateEngine();
  const firewall = new EconomicInstructionFirewall(
    identityRegistry,
    envelopeManager,
    mandateEngine,
  );
  const auditLog = new EconomicAuditLog();
  const rewardRegistry = new RewardRegistry();
  const claimEngine = new ClaimEngine(rewardRegistry, identityRegistry, envelopeManager);
  const providerSelector = new ProviderSelector();
  const negotiationEngine = new PaymentNegotiationEngine(
    identityRegistry,
    envelopeManager,
    mandateEngine,
    firewall,
    providerSelector,
  );
  const preparationManager = new PaymentPreparationManager();
  const negotiationAuditLog = new PaymentNegotiationAuditLog();
  const settlementExecutionEngine = new SettlementExecutionEngine();
  const revenueRealizationManager = new RevenueRealizationManager();
  const canonicalLedgerAdopter = new CanonicalLedgerAdopter(settlementExecutionEngine);
  const governanceLayer = new SettlementGovernanceLayer();
  const settlementLedger = new CanonicalSettlementLedger();
  const feedbackEngine = new SettlementFeedbackEngine();
  const settlementCoupling = new SettlementSystemCoupling(null, null, null);
  const settlementRuntime = new SettlementRuntimeService(
    governanceLayer, settlementLedger, feedbackEngine, providerSelector, settlementCoupling,
  );

  function evaluate(
    candidate: CandidateEconomicAction,
    runtimeIdentityId: string,
  ): FirewallVerdict {
    const verdict = firewall.evaluate(candidate, runtimeIdentityId);

    // Resolve economic identity for audit
    const econIdentity: EconomicIdentity | undefined =
      identityRegistry.getByRuntimeId(runtimeIdentityId);

    // Record audit event
    auditLog.record({
      runtimeIdentityId,
      economicIdentityId: econIdentity?.economicIdentityId ?? null,
      actionClassification: candidate.actionKind,
      candidateId: candidate.id,
      candidateSource: candidate.source,
      amountCents: candidate.amountCents,
      firewallResult: verdict.finalDecision,
      mandateUsed: verdict.checks.mandateCheck.mandateId ?? null,
      mandateDenied: !verdict.checks.mandateCheck.passed,
      mandateDenialReason: verdict.checks.mandateCheck.reason ?? null,
      capabilityCheckPassed: verdict.checks.capabilityCheck.passed,
      sourceTrustPassed: verdict.checks.sourceTrustEvaluation.passed,
      rejectionReasons: verdict.rejectionReasons,
      finalDecision: verdict.finalDecision,
    });

    return verdict;
  }

  function getRewardClaimSummary(): RewardClaimSummary {
    const rStats = rewardRegistry.all();
    const cStats = claimEngine.stats();
    return {
      totalRewards: rStats.length,
      activeRewards: rStats.filter(r => r.status === 'active').length,
      totalClaims: cStats.totalAttempts,
      approvedClaims: cStats.approved + cStats.settled,
      rejectedClaims: cStats.rejected + cStats.ineligible,
      duplicateAttempts: cStats.duplicate,
    };
  }

  function generateTruthReportFn(): EconomicTruthReport {
    return generateEconomicTruthReport({
      identityRegistry,
      envelopeManager,
      mandateEngine,
      firewall,
      auditLog,
      rewardSummaryProvider: getRewardClaimSummary,
    });
  }

  function attemptClaim(rewardId: string, economicIdentityId: string): ClaimResult {
    return claimEngine.attemptClaim(rewardId, economicIdentityId);
  }

  function negotiate(
    requirementId: string,
    economicIdentityId: string,
    runtimeIdentityId: string,
    offers: readonly PaymentOffer[],
  ): PaymentNegotiationResult {
    // Record audit: requirement received
    negotiationAuditLog.record('pending', 'requirement_received', {
      requirementId,
      economicIdentityId,
      offerCount: offers.length,
    });

    // Run negotiation engine
    const result = negotiationEngine.negotiate({
      requirementId,
      economicIdentityId,
      runtimeIdentityId,
      offers,
    });

    // Record audit: decision
    const eventType = result.decision === 'reject' ? 'rejected' as const
      : result.decision === 'require_human_confirmation' ? 'human_confirmation_required' as const
      : 'route_selected' as const;

    negotiationAuditLog.record(result.negotiationId, eventType, {
      decision: result.decision,
      requirementId: result.requirementId,
      selectedProvider: result.selectedOffer?.providerId ?? null,
      rejectionReasons: result.rejectionReasons,
    });

    // Track provider selection
    if (result.selectedOffer) {
      negotiationAuditLog.recordProviderSelection(result.selectedOffer.providerId);
    }

    return result;
  }

  return {
    identityRegistry,
    envelopeManager,
    mandateEngine,
    firewall,
    auditLog,
    rewardRegistry,
    claimEngine,
    negotiationEngine,
    providerSelector,
    preparationManager,
    negotiationAuditLog,
    settlementExecutionEngine,
    revenueRealizationManager,
    canonicalLedgerAdopter,
    governanceLayer,
    settlementLedger,
    feedbackEngine,
    settlementRuntime,
    settlementCoupling,
    evaluate,
    generateTruthReport: generateTruthReportFn,
    attemptClaim,
    negotiate,
  };
}
