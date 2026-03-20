/**
 * Round 18.0 — Canonical Ledger Adopter
 *
 * Final boundary where verified, realized settlements are permanently
 * merged into the agent's internal canonical ledger.
 *
 * Design Invariants:
 * - Adoptions are irreversible.
 * - Double-adoption is strictly prevented.
 * - Can only adopt 'verified' settlements.
 */

import type { RevenueRealization } from './revenue-realization.js';
import type { SettlementExecutionEngine } from './settlement-execution.js';

export interface LedgerAdoptionResult {
  readonly success: boolean;
  readonly realizationId: string;
  readonly reason: string | null;
}

export class CanonicalLedgerAdopter {
  private readonly executionEngine: SettlementExecutionEngine;
  private readonly adoptedRealizations = new Set<string>();

  constructor(executionEngine: SettlementExecutionEngine) {
    this.executionEngine = executionEngine;
  }

  /**
   * Finalizes the revenue realization into the canonical ledger.
   * This is the point where external capital impacts internal state permanently.
   */
  adoptRealization(realization: RevenueRealization): LedgerAdoptionResult {
    // 1. Double-adoption prevention
    if (this.adoptedRealizations.has(realization.realizationId)) {
      return {
        success: false,
        realizationId: realization.realizationId,
        reason: 'Realization has already been adopted',
      };
    }

    // 2. Verify settlement status
    const settlement = this.executionEngine.getSettlement(realization.settlementId);
    if (!settlement) {
      return {
        success: false,
        realizationId: realization.realizationId,
        reason: `Cannot adopt: Settlement ${realization.settlementId} not found`,
      };
    }
    if (settlement.status === 'adopted') {
      return {
        success: false,
        realizationId: realization.realizationId,
        reason: `Cannot adopt: Settlement ${realization.settlementId} already adopted in execution engine`,
      };
    }
    if (settlement.status !== 'verified') {
      return {
        success: false,
        realizationId: realization.realizationId,
        reason: `Cannot adopt: Settlement ${realization.settlementId} must be verified, is currently ${settlement.status}`,
      };
    }

    // 3. Mark settlement as adopted to prevent replay via engine
    const marked = this.executionEngine.markAsAdopted(realization.settlementId);
    if (!marked) {
      return {
        success: false,
        realizationId: realization.realizationId,
        reason: `Failed to mark settlement ${realization.settlementId} as adopted in execution engine`,
      };
    }

    // 4. Record as adopted
    this.adoptedRealizations.add(realization.realizationId);

    // Note: In a fully wired system, this is where we'd emit value events or update DB balances.
    
    return {
      success: true,
      realizationId: realization.realizationId,
      reason: null,
    };
  }

  isAdopted(realizationId: string): boolean {
    return this.adoptedRealizations.has(realizationId);
  }
}
