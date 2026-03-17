/**
 * Round 16.9 — RevenueService (Independent Revenue Write Path)
 *
 * Owns revenue event recording completely separate from SpendTracker.
 * Writes credit entries directly into EconomicLedger.
 * Maintains independent revenue totals and history.
 *
 * This is NOT a wrapper over SpendTracker — revenue and spend are
 * modeled independently and unified only at the projection layer.
 */
import { type EconomicLedger } from './economic-ledger.js';
import type { RevenueEvent } from './value-events.js';

// ── Revenue Stats ────────────────────────────────────────────────────

export interface RevenueStats {
  totalRevenueCents: number;
  eventCount: number;
  bySource: Record<string, number>;
  byProtocol: Record<string, number>;
}

// ── RevenueService ───────────────────────────────────────────────────

export class RevenueService {
  private ledger: EconomicLedger;
  private events: RevenueEvent[] = [];
  private _totalRevenueCents = 0;
  private _bySource: Record<string, number> = {};
  private _byProtocol: Record<string, number> = {};
  private callbacks: Array<(event: RevenueEvent) => void> = [];

  constructor(ledger: EconomicLedger) {
    this.ledger = ledger;
  }

  /**
   * Record a revenue event. Writes a `credit` entry to EconomicLedger
   * and updates internal revenue totals.
   *
   * This is the ONLY revenue write path — all revenue enters the
   * system through this method.
   */
  recordRevenueEvent(event: RevenueEvent): void {
    if (event.amountCents < 0) {
      throw new Error('Revenue amountCents must be non-negative');
    }
    if (event.amountCents === 0) return; // no-op for zero revenue

    // Write credit entry to the hash-chained ledger
    this.ledger.append(
      'credit',
      event.amountCents,
      `revenue:${event.source}`,
      event.source,
      `Revenue from ${event.source} via ${event.protocol}${event.txRef ? ` (ref: ${event.txRef})` : ''}`,
      event.timestamp,
    );

    // Update internal tracking
    this.events.push(event);
    this._totalRevenueCents += event.amountCents;
    this._bySource[event.source] = (this._bySource[event.source] ?? 0) + event.amountCents;
    this._byProtocol[event.protocol] = (this._byProtocol[event.protocol] ?? 0) + event.amountCents;

    // Notify listeners
    for (const cb of this.callbacks) {
      cb(event);
    }
  }

  /**
   * Subscribe to revenue events.
   */
  onRevenue(cb: (event: RevenueEvent) => void): () => void {
    this.callbacks.push(cb);
    return () => {
      const idx = this.callbacks.indexOf(cb);
      if (idx >= 0) this.callbacks.splice(idx, 1);
    };
  }

  /**
   * Total revenue recorded in cents.
   */
  totalRevenueCents(): number {
    return this._totalRevenueCents;
  }

  /**
   * Get revenue history (most recent first).
   */
  revenueHistory(limit?: number): readonly RevenueEvent[] {
    const reversed = [...this.events].reverse();
    if (limit) return reversed.slice(0, limit);
    return reversed;
  }

  /**
   * Revenue breakdown by source.
   */
  revenueBySource(): Record<string, number> {
    return { ...this._bySource };
  }

  /**
   * Revenue breakdown by protocol.
   */
  revenueByProtocol(): Record<string, number> {
    return { ...this._byProtocol };
  }

  /**
   * Get aggregate stats.
   */
  stats(): RevenueStats {
    return {
      totalRevenueCents: this._totalRevenueCents,
      eventCount: this.events.length,
      bySource: { ...this._bySource },
      byProtocol: { ...this._byProtocol },
    };
  }
}
