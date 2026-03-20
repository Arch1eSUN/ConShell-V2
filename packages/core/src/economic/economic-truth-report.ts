/**
 * Round 17.8 — G1-G3: Economic Truth Report
 *
 * Diagnosis-first aggregated view of the entire Economic Kernel Foundation.
 * Outputs "conclusions + evidence", NOT raw lists.
 *
 * Aggregates:
 * - Identity summary (active/suspended/revoked)
 * - Capability summary (receive-only/claim/spend/transfer-capable)
 * - Mandate summary (active/expired/revoked/exhausted + budget + expiring soon)
 * - Firewall summary (blocks, sources, reasons, pending confirmations)
 * - Audit summary
 * - Reward/claim summary
 * - Warnings (system risk alerts)
 * - Derived facts (capability assertions)
 */

import type { EconomicIdentityRegistry } from './economic-identity.js';
import type { CapabilityEnvelopeManager, CapabilityScope } from './capability-envelope.js';
import type { MandateEngine } from './mandate-engine.js';
import type { EconomicInstructionFirewall, FirewallVerdict } from './economic-instruction-firewall.js';
import type { EconomicAuditLog, AuditStats } from './economic-audit-event.js';

// ── Report Types ─────────────────────────────────────────────────────

export interface IdentityDiagnostics {
  readonly totalCount: number;
  readonly activeCount: number;
  readonly suspendedCount: number;
  readonly revokedCount: number;
  readonly unlinkedRuntimeIds: readonly string[];
}

export interface CapabilityDiagnostics {
  readonly receiveOnlyCount: number;
  readonly claimCapableCount: number;
  readonly mandateSpendCapableCount: number;
  readonly explicitTransferCapableCount: number;
  readonly capabilityDistribution: Readonly<Record<string, number>>;
}

export interface MandateDiagnostics {
  readonly activeCount: number;
  readonly expiredCount: number;
  readonly revokedCount: number;
  readonly exhaustedCount: number;
  readonly totalRemainingBudget: number;
  readonly expiringSoon: ReadonlyArray<{
    readonly mandateId: string;
    readonly purpose: string;
    readonly validUntil: string;
    readonly remainingBudget: number;
  }>;
  readonly recentDenials: readonly string[];
}

export interface FirewallDiagnostics {
  readonly totalEvaluated: number;
  readonly approved: number;
  readonly rejected: number;
  readonly pendingHuman: number;
  readonly blockedExternal: number;
  readonly sourceDistribution: Readonly<Record<string, number>>;
  readonly rejectionReasonDistribution: Readonly<Record<string, number>>;
  readonly pendingHumanActions: ReadonlyArray<{
    readonly candidateId: string;
    readonly actionKind: string;
    readonly timestamp: string;
  }>;
  readonly recentBlocks: ReadonlyArray<{
    readonly candidateId: string;
    readonly actionKind: string;
    readonly reasons: readonly string[];
    readonly timestamp: string;
  }>;
}

export interface RewardClaimSummary {
  readonly totalRewards: number;
  readonly activeRewards: number;
  readonly totalClaims: number;
  readonly approvedClaims: number;
  readonly rejectedClaims: number;
  readonly duplicateAttempts: number;
}

export type WarningLevel = 'info' | 'warning' | 'critical';

export interface EconomicWarning {
  readonly level: WarningLevel;
  readonly category: string;
  readonly message: string;
  readonly evidence: string;
}

export interface DerivedFact {
  readonly factId: string;
  readonly assertion: string;
  readonly evidence: string;
}

export interface EconomicTruthReport {
  readonly generatedAt: string;
  readonly identitySummary: IdentityDiagnostics;
  readonly capabilitySummary: CapabilityDiagnostics;
  readonly mandateSummary: MandateDiagnostics;
  readonly firewallSummary: FirewallDiagnostics;
  readonly auditSummary: AuditStats;
  readonly rewardSummary: RewardClaimSummary;
  readonly warnings: readonly EconomicWarning[];
  readonly derivedFacts: readonly DerivedFact[];
}

// ── Generator ────────────────────────────────────────────────────────

const EXPIRING_SOON_DAYS = 7;

export interface TruthReportDependencies {
  identityRegistry: EconomicIdentityRegistry;
  envelopeManager: CapabilityEnvelopeManager;
  mandateEngine: MandateEngine;
  firewall: EconomicInstructionFirewall;
  auditLog: EconomicAuditLog;
  rewardSummaryProvider?: () => RewardClaimSummary;
}

/**
 * Generate a comprehensive, diagnosis-first economic truth report.
 * Outputs conclusions + evidence, not raw data dumps.
 */
export function generateEconomicTruthReport(
  deps: TruthReportDependencies,
): EconomicTruthReport {
  const warnings: EconomicWarning[] = [];
  const derivedFacts: DerivedFact[] = [];

  // ── Identity Diagnostics ──────────────────────────────────────────
  const allIdentities = deps.identityRegistry.all();
  let activeCount = 0;
  let suspendedCount = 0;
  let revokedCount = 0;

  for (const id of allIdentities) {
    switch (id.status) {
      case 'active': activeCount++; break;
      case 'suspended': suspendedCount++; break;
      case 'revoked': revokedCount++; break;
    }
  }

  const identitySummary: IdentityDiagnostics = {
    totalCount: allIdentities.length,
    activeCount,
    suspendedCount,
    revokedCount,
    unlinkedRuntimeIds: [], // populated by caller if runtime IDs available
  };

  if (suspendedCount > 0) {
    warnings.push({
      level: 'warning',
      category: 'identity',
      message: `${suspendedCount} economic identity(ies) suspended`,
      evidence: `Suspended identities cannot perform economic actions`,
    });
  }

  // ── Capability Diagnostics ────────────────────────────────────────
  let receiveOnlyCount = 0;
  let claimCapableCount = 0;
  let mandateSpendCapableCount = 0;
  let explicitTransferCapableCount = 0;
  const capDist: Record<string, number> = {};

  for (const id of allIdentities) {
    if (id.status !== 'active') continue;
    const env = deps.envelopeManager.getByEconomicIdentity(id.economicIdentityId);
    if (!env) continue;

    const scopes = env.grantedScopes;
    let hasOnlyReceive = true;

    for (const scope of scopes) {
      capDist[scope] = (capDist[scope] ?? 0) + 1;
      if (scope !== 'receive_only') hasOnlyReceive = false;
    }

    if (hasOnlyReceive) receiveOnlyCount++;
    if (scopes.has('claim_reward')) claimCapableCount++;
    if (scopes.has('spend_within_mandate')) mandateSpendCapableCount++;
    if (scopes.has('explicit_transfer')) explicitTransferCapableCount++;
  }

  const capabilitySummary: CapabilityDiagnostics = {
    receiveOnlyCount,
    claimCapableCount,
    mandateSpendCapableCount,
    explicitTransferCapableCount,
    capabilityDistribution: capDist,
  };

  // Derived fact: current system capability mode
  if (explicitTransferCapableCount > 0) {
    derivedFacts.push({
      factId: 'capability_mode',
      assertion: 'System has explicit_transfer-capable identities',
      evidence: `${explicitTransferCapableCount} identity(ies) with explicit_transfer scope`,
    });
  } else if (mandateSpendCapableCount > 0) {
    derivedFacts.push({
      factId: 'capability_mode',
      assertion: 'System is in spend-within-mandate mode',
      evidence: `${mandateSpendCapableCount} identity(ies) with spend_within_mandate scope, 0 with explicit_transfer`,
    });
  } else {
    derivedFacts.push({
      factId: 'capability_mode',
      assertion: 'System is in receive-only mode',
      evidence: `No identities with spend or transfer capabilities`,
    });
  }

  // ── Mandate Diagnostics ───────────────────────────────────────────
  const allMandates = deps.mandateEngine.all();
  let mandateActive = 0;
  let mandateExpired = 0;
  let mandateRevoked = 0;
  let mandateExhausted = 0;
  let totalRemainingBudget = 0;
  const expiringSoon: MandateDiagnostics['expiringSoon'] extends ReadonlyArray<infer T> ? T[] : never = [];
  const now = new Date();
  const soonThreshold = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);

  for (const m of allMandates) {
    switch (m.status) {
      case 'active':
        mandateActive++;
        totalRemainingBudget += m.remainingBudget;
        if (new Date(m.validUntil) <= soonThreshold) {
          expiringSoon.push({
            mandateId: m.mandateId,
            purpose: m.purpose,
            validUntil: m.validUntil,
            remainingBudget: m.remainingBudget,
          });
        }
        break;
      case 'expired': mandateExpired++; break;
      case 'revoked': mandateRevoked++; break;
      case 'exhausted': mandateExhausted++; break;
    }
  }

  // Gather recent denial reasons from audit log
  const recentAudit = deps.auditLog.getRecent(50);
  const recentDenials: string[] = [];
  for (const e of recentAudit) {
    if (e.mandateDenied && e.mandateDenialReason) {
      recentDenials.push(e.mandateDenialReason);
    }
  }

  const mandateSummary: MandateDiagnostics = {
    activeCount: mandateActive,
    expiredCount: mandateExpired,
    revokedCount: mandateRevoked,
    exhaustedCount: mandateExhausted,
    totalRemainingBudget,
    expiringSoon,
    recentDenials: recentDenials.slice(-10),
  };

  if (expiringSoon.length > 0) {
    warnings.push({
      level: 'warning',
      category: 'mandate',
      message: `${expiringSoon.length} mandate(s) expiring within ${EXPIRING_SOON_DAYS} days`,
      evidence: expiringSoon.map(m => `${m.mandateId}: ${m.purpose} (expires ${m.validUntil})`).join('; '),
    });
  }

  if (mandateActive === 0 && mandateSpendCapableCount > 0) {
    warnings.push({
      level: 'critical',
      category: 'mandate',
      message: 'Spend-capable identities exist but no active mandates',
      evidence: `${mandateSpendCapableCount} spend-capable identity(ies), 0 active mandates`,
    });
  }

  // ── Firewall Diagnostics ──────────────────────────────────────────
  const fwStats = deps.firewall.stats();
  const recentBlocks = deps.firewall.recentBlocks(10);
  const allVerdicts = deps.firewall.allVerdicts();

  // Source distribution
  const sourceDist: Record<string, number> = {};
  const rejectionReasonDist: Record<string, number> = {};
  const pendingHumanActions: FirewallDiagnostics['pendingHumanActions'] extends ReadonlyArray<infer T> ? T[] : never = [];

  for (const v of allVerdicts) {
    sourceDist[v.actionKind] = (sourceDist[v.actionKind] ?? 0) + 1;
    if (v.finalDecision === 'rejected') {
      for (const reason of v.rejectionReasons) {
        rejectionReasonDist[reason] = (rejectionReasonDist[reason] ?? 0) + 1;
      }
    }
    if (v.finalDecision === 'pending_human_confirmation') {
      pendingHumanActions.push({
        candidateId: v.candidateId,
        actionKind: v.actionKind,
        timestamp: v.timestamp,
      });
    }
  }

  const firewallSummary: FirewallDiagnostics = {
    ...fwStats,
    sourceDistribution: sourceDist,
    rejectionReasonDistribution: rejectionReasonDist,
    pendingHumanActions,
    recentBlocks: recentBlocks.map(v => ({
      candidateId: v.candidateId,
      actionKind: v.actionKind,
      reasons: v.rejectionReasons,
      timestamp: v.timestamp,
    })),
  };

  if (fwStats.blockedExternal > 0) {
    warnings.push({
      level: 'warning',
      category: 'firewall',
      message: `${fwStats.blockedExternal} external economic injection attempt(s) blocked`,
      evidence: `Firewall blocked ${fwStats.blockedExternal} actions from external sources`,
    });
  }

  if (pendingHumanActions.length > 0) {
    warnings.push({
      level: 'info',
      category: 'firewall',
      message: `${pendingHumanActions.length} action(s) pending human confirmation`,
      evidence: pendingHumanActions.map(a => `${a.candidateId}: ${a.actionKind}`).join('; '),
    });
  }

  // ── Audit Summary ─────────────────────────────────────────────────
  const auditSummary = deps.auditLog.stats();

  // ── Reward Summary ────────────────────────────────────────────────
  const rewardSummary: RewardClaimSummary = deps.rewardSummaryProvider
    ? deps.rewardSummaryProvider()
    : {
        totalRewards: 0,
        activeRewards: 0,
        totalClaims: 0,
        approvedClaims: 0,
        rejectedClaims: 0,
        duplicateAttempts: 0,
      };

  // ── Derived Facts ─────────────────────────────────────────────────
  derivedFacts.push({
    factId: 'identity_coverage',
    assertion: `${activeCount} of ${allIdentities.length} identities are economically active`,
    evidence: `active=${activeCount}, suspended=${suspendedCount}, revoked=${revokedCount}`,
  });

  derivedFacts.push({
    factId: 'firewall_approval_rate',
    assertion: fwStats.totalEvaluated > 0
      ? `Firewall approval rate: ${Math.round((fwStats.approved / fwStats.totalEvaluated) * 100)}%`
      : 'No economic actions evaluated yet',
    evidence: `approved=${fwStats.approved}, rejected=${fwStats.rejected}, pending=${fwStats.pendingHuman}, total=${fwStats.totalEvaluated}`,
  });

  return {
    generatedAt: new Date().toISOString(),
    identitySummary,
    capabilitySummary,
    mandateSummary,
    firewallSummary,
    auditSummary,
    rewardSummary,
    warnings,
    derivedFacts,
  };
}
