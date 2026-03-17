/**
 * Round 15.9 — ValueEventRecorder
 *
 * Lightweight in-memory recorder for economic value events.
 * Ring buffer (default 500 entries), no persistence.
 * Designed to be injected into TaskQueue and other runtime components.
 */
import type { ValueEvent, RevenueEvent, ValueRealizationEvent, TaskCompletionEvent } from './value-events.js';

// ── Stats ─────────────────────────────────────────────────────────────

export interface ValueEventStats {
  readonly total: number;
  readonly revenue: number;
  readonly completions: number;
  readonly realizations: number;
  readonly totalRevenueCents: number;
  readonly totalCostCents: number;
  readonly avgNetValueCents: number;
}

// ── Recorder ──────────────────────────────────────────────────────────

export class ValueEventRecorder {
  private buffer: ValueEvent[] = [];
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  /** Record a value event */
  record(event: ValueEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  /** Get recent events (newest last) */
  recent(limit?: number): readonly ValueEvent[] {
    if (limit) return this.buffer.slice(-limit);
    return [...this.buffer];
  }

  /** Filter events by type */
  byType<T extends ValueEvent['type']>(type: T): readonly Extract<ValueEvent, { type: T }>[] {
    return this.buffer.filter((e): e is Extract<ValueEvent, { type: T }> => e.type === type);
  }

  /** Aggregate statistics */
  stats(): ValueEventStats {
    let revenue = 0, completions = 0, realizations = 0;
    let totalRevenueCents = 0, totalCostCents = 0, totalNetCents = 0;

    for (const event of this.buffer) {
      switch (event.type) {
        case 'revenue':
          revenue++;
          totalRevenueCents += event.amountCents;
          break;
        case 'task_completion':
          completions++;
          totalCostCents += event.actualCostCents;
          totalNetCents += event.netValueCents;
          break;
        case 'value_realization':
          realizations++;
          break;
      }
    }

    return {
      total: this.buffer.length,
      revenue,
      completions,
      realizations,
      totalRevenueCents,
      totalCostCents,
      avgNetValueCents: completions > 0 ? Math.round(totalNetCents / completions) : 0,
    };
  }

  /** Clear all events */
  clear(): void {
    this.buffer = [];
  }

  /** Current buffer size */
  get size(): number {
    return this.buffer.length;
  }
}
