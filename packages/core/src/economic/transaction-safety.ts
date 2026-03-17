/**
 * Round 15.7 — Transaction Safety
 *
 * Provides idempotency keys, duplicate detection, refund processing,
 * and failed transaction recovery. Ensures economic operations are
 * safe against retries, double-spending, and partial failures.
 */

// ── Idempotency Key ──────────────────────────────────────────────────

export type IdempotencyKey = string;

/**
 * Generate an idempotency key.
 * Format: {type}:{source}:{timestamp}:{nonce}
 */
export function generateIdempotencyKey(type: string, source: string): IdempotencyKey {
  const ts = Date.now();
  const nonce = Math.random().toString(36).slice(2, 10);
  return `${type}:${source}:${ts}:${nonce}`;
}

// ── Refund Types ─────────────────────────────────────────────────────

export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processed';

export interface RefundRequest {
  /** Unique refund ID */
  readonly id: string;
  /** Original ledger entry ID that is being refunded */
  readonly originalEntryId: number;
  /** Reason for refund */
  readonly reason: string;
  /** Current status */
  status: RefundStatus;
  /** Amount to refund in cents */
  readonly amountCents: number;
  /** ISO timestamp of request */
  readonly requestedAt: string;
  /** ISO timestamp of processing (if processed) */
  processedAt?: string;
}

// ── Transaction Record ───────────────────────────────────────────────

export type TransactionStatus = 'success' | 'failed' | 'pending' | 'retried';

export interface TransactionRecord {
  /** Idempotency key */
  readonly key: IdempotencyKey;
  /** Transaction type */
  readonly type: 'debit' | 'credit' | 'refund';
  /** Amount in cents */
  readonly amountCents: number;
  /** Source/target */
  readonly source: string;
  /** Status */
  status: TransactionStatus;
  /** Number of retry attempts */
  retryCount: number;
  /** Last error message (if failed) */
  lastError?: string;
  /** ISO timestamp */
  readonly createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
}

// ── Transaction Safety Manager ───────────────────────────────────────

export class TransactionSafetyManager {
  private processedKeys = new Map<IdempotencyKey, TransactionRecord>();
  private refundRequests: RefundRequest[] = [];
  private refundIdCounter = 0;

  /**
   * Generate an idempotency key.
   */
  generateKey(type: string, source: string): IdempotencyKey {
    return generateIdempotencyKey(type, source);
  }

  /**
   * Check if a transaction with this key has already been processed.
   */
  isDuplicate(key: IdempotencyKey): boolean {
    const record = this.processedKeys.get(key);
    return record !== undefined && record.status === 'success';
  }

  /**
   * Get an existing transaction record by key (for idempotent responses).
   */
  getExistingTransaction(key: IdempotencyKey): TransactionRecord | undefined {
    return this.processedKeys.get(key);
  }

  /**
   * Record a transaction (for deduplication tracking).
   * Returns false if the key is a duplicate (already succeeded).
   */
  recordTransaction(
    key: IdempotencyKey,
    type: 'debit' | 'credit' | 'refund',
    amountCents: number,
    source: string,
  ): { recorded: boolean; existing?: TransactionRecord } {
    if (this.isDuplicate(key)) {
      return { recorded: false, existing: this.processedKeys.get(key) };
    }

    const record: TransactionRecord = {
      key,
      type,
      amountCents,
      source,
      status: 'success',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.processedKeys.set(key, record);
    return { recorded: true };
  }

  /**
   * Record a failed transaction (for retry tracking).
   */
  recordFailure(
    key: IdempotencyKey,
    type: 'debit' | 'credit' | 'refund',
    amountCents: number,
    source: string,
    error: string,
  ): TransactionRecord {
    const existing = this.processedKeys.get(key);

    if (existing) {
      existing.status = 'failed';
      existing.lastError = error;
      existing.retryCount++;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }

    const record: TransactionRecord = {
      key,
      type,
      amountCents,
      source,
      status: 'failed',
      retryCount: 0,
      lastError: error,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.processedKeys.set(key, record);
    return record;
  }

  /**
   * Request a refund for a ledger entry.
   */
  requestRefund(originalEntryId: number, amountCents: number, reason: string): RefundRequest {
    const request: RefundRequest = {
      id: `refund_${++this.refundIdCounter}`,
      originalEntryId,
      reason,
      status: 'pending',
      amountCents,
      requestedAt: new Date().toISOString(),
    };

    this.refundRequests.push(request);
    return request;
  }

  /**
   * Approve a pending refund.
   */
  approveRefund(refundId: string): boolean {
    const req = this.refundRequests.find(r => r.id === refundId);
    if (!req || req.status !== 'pending') return false;
    req.status = 'approved';
    return true;
  }

  /**
   * Process an approved refund (mark as processed).
   * The caller is responsible for actually writing the refund entry to the ledger.
   * Returns the refund request, or null if not found/not approved.
   */
  processRefund(refundId: string): RefundRequest | null {
    const req = this.refundRequests.find(r => r.id === refundId);
    if (!req || req.status !== 'approved') return null;
    req.status = 'processed';
    req.processedAt = new Date().toISOString();
    return req;
  }

  /**
   * Reject a pending refund.
   */
  rejectRefund(refundId: string): boolean {
    const req = this.refundRequests.find(r => r.id === refundId);
    if (!req || req.status !== 'pending') return false;
    req.status = 'rejected';
    return true;
  }

  /**
   * Get all failed transactions (for retry).
   */
  getFailedTransactions(): TransactionRecord[] {
    return [...this.processedKeys.values()].filter(r => r.status === 'failed');
  }

  /**
   * Mark a failed transaction as retried.
   */
  markRetried(key: IdempotencyKey): boolean {
    const record = this.processedKeys.get(key);
    if (!record || record.status !== 'failed') return false;
    record.status = 'retried';
    record.retryCount++;
    record.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Mark a retried/failed transaction as succeeded.
   */
  markSuccess(key: IdempotencyKey): boolean {
    const record = this.processedKeys.get(key);
    if (!record) return false;
    record.status = 'success';
    record.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Get all refund requests.
   */
  getRefundRequests(status?: RefundStatus): RefundRequest[] {
    if (status) {
      return this.refundRequests.filter(r => r.status === status);
    }
    return [...this.refundRequests];
  }

  /**
   * Get transaction stats.
   */
  stats(): {
    totalTransactions: number;
    successCount: number;
    failedCount: number;
    pendingRefunds: number;
    processedRefunds: number;
  } {
    const records = [...this.processedKeys.values()];
    return {
      totalTransactions: records.length,
      successCount: records.filter(r => r.status === 'success').length,
      failedCount: records.filter(r => r.status === 'failed').length,
      pendingRefunds: this.refundRequests.filter(r => r.status === 'pending').length,
      processedRefunds: this.refundRequests.filter(r => r.status === 'processed').length,
    };
  }
}
