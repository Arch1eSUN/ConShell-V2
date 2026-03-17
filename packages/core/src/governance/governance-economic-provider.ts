/**
 * GovernanceEconomicProvider — Round 17.0
 *
 * Lightweight interface for governance to consume survival/economic state
 * without coupling to the full EconomicStateService.
 *
 * Follows the same pattern as GovernanceIdentityProvider and
 * GovernancePolicyProvider from Round 16.3.
 */

import type { SurvivalTier } from '../types/common.js';

// ── Provider Interface ───────────────────────────────────────────────

export interface GovernanceEconomicProvider {
  /** Current survival tier */
  survivalTier(): SurvivalTier;

  /** Whether the system is in emergency mode */
  isEmergency(): boolean;

  /** Whether must-preserve policy is active */
  mustPreserveActive(): boolean;

  /** Current balance in cents */
  currentBalanceCents(): number;

  /**
   * Check if an action with given cost can proceed.
   * Returns structured allow/deny with reason.
   */
  canAcceptAction(costCents: number, isRevenue: boolean): GovernanceEconomicDecision;
}

export interface GovernanceEconomicDecision {
  readonly allowed: boolean;
  readonly reason: string;
  /** If constrained, suggested budget cap */
  readonly suggestedCapCents?: number;
}

// ── Null Provider (for environments without economic module) ─────────

export class NullEconomicProvider implements GovernanceEconomicProvider {
  survivalTier(): SurvivalTier { return 'normal' as SurvivalTier; }
  isEmergency(): boolean { return false; }
  mustPreserveActive(): boolean { return false; }
  currentBalanceCents(): number { return 100_00; }
  canAcceptAction(): GovernanceEconomicDecision {
    return { allowed: true, reason: 'No economic constraints configured' };
  }
}
