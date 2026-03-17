/**
 * Round 17.3 — RevenueSeekingEngine
 *
 * Active scan-and-dispatch cycle for proactively discovering and
 * prioritizing revenue-generating work. Subject to governance
 * constraints and survival-tier modulation.
 *
 * Scan → Discover → Prioritize → Dispatch
 */
import type { RevenueSurfaceRegistry, PaymentProofContract } from './revenue-surface.js';
import type { Commitment } from '../agenda/commitment-model.js';
import type { EconomicProjection } from './economic-state-service.js';

// ── Revenue Opportunity ──────────────────────────────────────────────

export type OpportunityStatus = 'discovered' | 'queued' | 'in_progress' | 'completed' | 'abandoned';

export interface RevenueOpportunity {
  /** Unique opportunity ID */
  readonly id: string;
  /** Source revenue surface ID */
  readonly surfaceId: string;
  /** Human-readable description */
  readonly description: string;
  /** Estimated revenue in cents */
  readonly estimatedRevenueCents: number;
  /** Required action type */
  readonly requiredAction: string;
  /** Current status */
  status: OpportunityStatus;
  /** Associated payment proof ID (if from unfulfilled payment) */
  readonly proofId?: string;
  /** Associated commitment ID (if mapped) */
  commitmentId?: string;
  /** Discovery timestamp */
  readonly discoveredAt: string;
  /** Round 17.4: Identity that discovered/owns this opportunity */
  readonly issuerIdentityId?: string;
}

// ── Scan Result ──────────────────────────────────────────────────────

export interface ScanResult {
  /** All discovered opportunities */
  readonly opportunities: RevenueOpportunity[];
  /** Number of unfulfilled paid contracts found */
  readonly unfulfilledPayments: number;
  /** Number of active surfaces with capacity */
  readonly activeSurfacesWithCapacity: number;
  /** Whether survival mode is active (influences scan aggressiveness) */
  readonly survivalModeActive: boolean;
  /** Scan timestamp */
  readonly scannedAt: string;
}

// ── Engine ───────────────────────────────────────────────────────────

export class RevenueSeekingEngine {
  private opportunities = new Map<string, RevenueOpportunity>();
  private opportunityIdCounter = 0;

  /**
   * Scan for revenue opportunities.
   *
   * Sources:
   * 1. Unfulfilled verified payments (highest priority — already paid)
   * 2. Revenue-bearing commitments that are stalled
   * 3. Active surfaces with available capacity
   */
  scan(
    surfaces: RevenueSurfaceRegistry,
    commitments: readonly Commitment[],
    projection?: EconomicProjection,
  ): ScanResult {
    const discovered: RevenueOpportunity[] = [];
    const now = new Date().toISOString();
    const survivalModeActive = projection
      ? (projection.survivalTier === 'critical' || projection.survivalTier === 'terminal')
      : false;

    // 1. Unfulfilled payments — HIGHEST priority (money already received)
    const unfulfilled = surfaces.getUnfulfilledPayments();
    for (const payment of unfulfilled) {
      const existing = this.findByProofId(payment.id);
      if (!existing) {
        const opp = this.createOpportunity({
          surfaceId: payment.surfaceId,
          description: `Fulfill paid contract: ${payment.proof.txHash.substring(0, 16)}...`,
          estimatedRevenueCents: 0, // Already received
          requiredAction: 'fulfill_paid_contract',
          proofId: payment.id,
          discoveredAt: now,
        });
        discovered.push(opp);
      }
    }

    // 2. Stalled revenue-bearing commitments
    const stalledRevenue = commitments.filter(c =>
      c.revenueBearing &&
      c.status === 'active' &&
      c.expectedValueCents > 0,
    );
    for (const c of stalledRevenue) {
      const existing = this.findByCommitmentId(c.id);
      if (!existing) {
        const opp = this.createOpportunity({
          surfaceId: 'commitment',
          description: `Revenue commitment: ${c.name}`,
          estimatedRevenueCents: c.expectedValueCents,
          requiredAction: 'execute_revenue_commitment',
          discoveredAt: now,
        });
        opp.commitmentId = c.id;
        discovered.push(opp);
      }
    }

    // 3. Active surfaces with capacity (proactive scanning)
    const activeSurfaces = surfaces.active();
    let activeSurfacesWithCapacity = 0;
    for (const surface of activeSurfaces) {
      if (surface.isActive) {
        activeSurfacesWithCapacity++;
        // In survival mode, actively seek any payable work
        if (survivalModeActive) {
          const existing = [...this.opportunities.values()].find(
            o => o.surfaceId === surface.id && o.status === 'discovered',
          );
          if (!existing) {
            const opp = this.createOpportunity({
              surfaceId: surface.id,
              description: `Seek payable work on surface: ${surface.name}`,
              estimatedRevenueCents: surface.pricePolicy.basePriceCents,
              requiredAction: 'seek_payable_work',
              discoveredAt: now,
            });
            discovered.push(opp);
          }
        }
      }
    }

    return {
      opportunities: discovered,
      unfulfilledPayments: unfulfilled.length,
      activeSurfacesWithCapacity,
      survivalModeActive,
      scannedAt: now,
    };
  }

  /**
   * Get all discovered opportunities sorted by estimated revenue (descending).
   */
  getPrioritized(): RevenueOpportunity[] {
    return [...this.opportunities.values()]
      .filter(o => o.status === 'discovered' || o.status === 'queued')
      .sort((a, b) => {
        // Unfulfilled payments first (proofId present = already paid)
        if (a.proofId && !b.proofId) return -1;
        if (!a.proofId && b.proofId) return 1;
        // Then by estimated revenue
        return b.estimatedRevenueCents - a.estimatedRevenueCents;
      });
  }

  /**
   * Mark an opportunity as queued (accepted into scheduler).
   */
  markQueued(opportunityId: string, commitmentId?: string): boolean {
    const opp = this.opportunities.get(opportunityId);
    if (!opp || opp.status !== 'discovered') return false;
    opp.status = 'queued';
    if (commitmentId) opp.commitmentId = commitmentId;
    return true;
  }

  /**
   * Mark an opportunity as in-progress.
   */
  markInProgress(opportunityId: string): boolean {
    const opp = this.opportunities.get(opportunityId);
    if (!opp) return false;
    opp.status = 'in_progress';
    return true;
  }

  /**
   * Mark an opportunity as completed.
   */
  markCompleted(opportunityId: string): boolean {
    const opp = this.opportunities.get(opportunityId);
    if (!opp) return false;
    opp.status = 'completed';
    return true;
  }

  /**
   * Mark an opportunity as abandoned.
   */
  markAbandoned(opportunityId: string): boolean {
    const opp = this.opportunities.get(opportunityId);
    if (!opp) return false;
    opp.status = 'abandoned';
    return true;
  }

  /**
   * Get all opportunities.
   */
  all(): RevenueOpportunity[] {
    return [...this.opportunities.values()];
  }

  /**
   * Get opportunity by ID.
   */
  get(id: string): RevenueOpportunity | undefined {
    return this.opportunities.get(id);
  }

  // ── Internal ───────────────────────────────────────────────────────

  private createOpportunity(input: Omit<RevenueOpportunity, 'id' | 'status'>): RevenueOpportunity {
    const opp: RevenueOpportunity = {
      id: `revopp_${++this.opportunityIdCounter}`,
      ...input,
      status: 'discovered',
    };
    this.opportunities.set(opp.id, opp);
    return opp;
  }

  private findByProofId(proofId: string): RevenueOpportunity | undefined {
    return [...this.opportunities.values()].find(o => o.proofId === proofId);
  }

  private findByCommitmentId(commitmentId: string): RevenueOpportunity | undefined {
    return [...this.opportunities.values()].find(
      o => o.commitmentId === commitmentId && o.status !== 'completed' && o.status !== 'abandoned',
    );
  }
}
