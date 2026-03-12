/**
 * SpendTracker — 推理成本追踪
 */
import type { Cents } from '../types/common.js';
import { Cents as toCents } from '../types/common.js';

export interface SpendBreakdown {
  provider: string;
  requests: number;
  costCents: Cents;
}

export interface SpendAggregates {
  totalCents: Cents;
  dailyCents: Cents;
  breakdown: SpendBreakdown[];
}

export class SpendTracker {
  private records: { provider: string; costCents: number; timestamp: number }[] = [];

  record(provider: string, costCents: number): void {
    this.records.push({ provider, costCents, timestamp: Date.now() });
  }

  aggregates(): SpendAggregates {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const byProvider = new Map<string, { requests: number; costCents: number }>();
    let total = 0, daily = 0;

    for (const r of this.records) {
      total += r.costCents;
      if (r.timestamp >= dayStart.getTime()) daily += r.costCents;
      const existing = byProvider.get(r.provider) ?? { requests: 0, costCents: 0 };
      existing.requests++;
      existing.costCents += r.costCents;
      byProvider.set(r.provider, existing);
    }

    return {
      totalCents: toCents(total),
      dailyCents: toCents(daily),
      breakdown: Array.from(byProvider.entries()).map(([provider, data]) => ({
        provider,
        requests: data.requests,
        costCents: toCents(data.costCents),
      })),
    };
  }
}
