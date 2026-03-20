/**
 * ExecutionAuditTrail — Structured execution history for commitments.
 *
 * Records every execution attempt (success, failure, veto, dedup) to
 * provide a complete audit trail for the resume → execution → completion
 * closed loop.
 *
 * Round 19.2: P1 High-Trust Continuous Autonomy Final Closure
 */
import type { Logger } from '../types/common.js';

// ── Types ──────────────────────────────────────────────────────────────

export type ExecutionOutcome = 'completed' | 'failed' | 'vetoed' | 'deduplicated' | 'guard-denied';

export interface ExecutionRecord {
  /** The commitment that was executed (or attempted) */
  readonly commitmentId: string;
  /** What happened */
  readonly outcome: ExecutionOutcome;
  /** How long the execution took (0 for vetoed/deduplicated) */
  readonly durationMs: number;
  /** Human-readable reason (especially for non-success outcomes) */
  readonly reason?: string;
  /** ISO-8601 timestamp */
  readonly timestamp: string;
}

export interface AuditStats {
  readonly totalRecords: number;
  readonly completed: number;
  readonly failed: number;
  readonly vetoed: number;
  readonly deduplicated: number;
  readonly guardDenied: number;
}

// ── ExecutionAuditTrail ───────────────────────────────────────────────

export class ExecutionAuditTrail {
  private records: ExecutionRecord[] = [];
  private byCommitment = new Map<string, ExecutionRecord[]>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child('execution-audit');
  }

  /**
   * Record an execution attempt for a commitment.
   */
  record(
    commitmentId: string,
    outcome: ExecutionOutcome,
    durationMs: number,
    reason?: string,
  ): ExecutionRecord {
    const entry: ExecutionRecord = {
      commitmentId,
      outcome,
      durationMs,
      reason,
      timestamp: new Date().toISOString(),
    };

    this.records.push(entry);

    // Index by commitmentId
    const existing = this.byCommitment.get(commitmentId);
    if (existing) {
      existing.push(entry);
    } else {
      this.byCommitment.set(commitmentId, [entry]);
    }

    this.logger.debug('Execution recorded', {
      commitmentId,
      outcome,
      durationMs,
      reason,
    });

    return entry;
  }

  /**
   * Get all execution records for a specific commitment.
   */
  getHistory(commitmentId: string): readonly ExecutionRecord[] {
    return this.byCommitment.get(commitmentId) ?? [];
  }

  /**
   * Get all execution records (newest first).
   */
  getAll(limit?: number): readonly ExecutionRecord[] {
    const reversed = [...this.records].reverse();
    return limit ? reversed.slice(0, limit) : reversed;
  }

  /**
   * Get aggregate statistics.
   */
  stats(): AuditStats {
    const counts = { completed: 0, failed: 0, vetoed: 0, deduplicated: 0, guardDenied: 0 };
    for (const r of this.records) {
      switch (r.outcome) {
        case 'completed': counts.completed++; break;
        case 'failed': counts.failed++; break;
        case 'vetoed': counts.vetoed++; break;
        case 'deduplicated': counts.deduplicated++; break;
        case 'guard-denied': counts.guardDenied++; break;
      }
    }
    return {
      totalRecords: this.records.length,
      ...counts,
    };
  }

  /**
   * Clear all records (for testing or full restart).
   */
  clear(): void {
    this.records = [];
    this.byCommitment.clear();
  }
}
