/**
 * Round 18.0 — Revenue Realization
 *
 * Handles attributing a verified SettlementRecord to specific
 * economic identities and tracking taxation/platform fees.
 *
 * Design Invariants:
 * - A settlement MUST be 'verified' before realizing revenue.
 * - The sum of splits MUST exactly equal the settlement amount.
 * - Realization is immutable.
 */

import type { SettlementRecord } from './settlement-execution.js';

export interface RevenueSplit {
  readonly economicIdentityId: string;
  readonly amountCents: number;
  readonly reason: string;
  readonly type: 'principal' | 'tax' | 'platform_fee';
}

export interface RevenueRealization {
  readonly realizationId: string;
  readonly settlementId: string;
  readonly requirementId: string;
  readonly providerId: string;
  readonly totalRealizedCents: number;
  readonly splits: readonly RevenueSplit[];
  readonly realizedAt: string;
}

export class RevenueRealizationManager {
  private readonly realizationsBySettlement = new Map<string, RevenueRealization>();
  private realizationCounter = 0;

  /**
   * Translates a verified settlement into specific revenue distributions.
   */
  realizeSettlement(
    record: SettlementRecord,
    splits: readonly RevenueSplit[]
  ): RevenueRealization {
    if (record.status !== 'verified') {
      throw new Error(`Cannot realize settlement in status: ${record.status}`);
    }

    if (this.realizationsBySettlement.has(record.settlementId)) {
      throw new Error('Settlement has already been realized');
    }

    const totalSplit = splits.reduce((sum, s) => sum + s.amountCents, 0);
    if (totalSplit !== record.amountCents) {
      throw new Error(`Revenue split total (${totalSplit}) does not match settlement amount (${record.amountCents})`);
    }

    // Ensure all split amounts are positive integers
    for (const split of splits) {
      if (!Number.isInteger(split.amountCents) || split.amountCents < 0) {
        throw new Error('All revenue split amounts must be non-negative integers');
      }
    }

    const realizationId = `real_${++this.realizationCounter}`;
    const realization: RevenueRealization = {
      realizationId,
      settlementId: record.settlementId,
      requirementId: record.requirementId,
      providerId: record.providerId,
      totalRealizedCents: record.amountCents,
      splits: [...splits],
      realizedAt: new Date().toISOString(),
    };

    this.realizationsBySettlement.set(record.settlementId, realization);
    return realization;
  }

  getRealizationForSettlement(settlementId: string): RevenueRealization | undefined {
    return this.realizationsBySettlement.get(settlementId);
  }

  allRealizations(): readonly RevenueRealization[] {
    return Array.from(this.realizationsBySettlement.values());
  }
}
