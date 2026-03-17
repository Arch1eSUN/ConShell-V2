/**
 * Round 15.8 — Value Event Types
 *
 * Distinguishes three types of events to prevent semantic confusion:
 * - RevenueEvent: payment received
 * - ValueRealizationEvent: system completed billable value delivery
 * - TaskCompletionEvent: task finished (may or may not generate revenue)
 *
 * These are NOT interchangeable and must be tracked separately.
 */

// ── Revenue Event (money in) ──────────────────────────────────────────

export interface RevenueEvent {
  readonly type: 'revenue';
  /** Revenue source: x402 payment, subscription, API fee, etc. */
  readonly source: string;
  /** Amount received in cents */
  readonly amountCents: number;
  /** Transaction reference (hash, ID, etc.) */
  readonly txRef: string;
  /** Timestamp */
  readonly timestamp: string;
  /** Payment protocol */
  readonly protocol: 'x402' | 'subscription' | 'api' | 'manual';
  /** Round 16.9: Revenue surface ID (if from a registered surface) */
  readonly surfaceId?: string;
  /** Round 16.9: Settlement status */
  readonly settlementStatus?: 'pending' | 'settled' | 'failed' | 'disputed' | 'refunded';
}

// ── Value Realization Event (value delivered) ─────────────────────────

export interface ValueRealizationEvent {
  readonly type: 'value_realization';
  /** Task ID that produced the value */
  readonly taskId: string;
  /** Type of value delivered */
  readonly valueType: 'api_response' | 'task_completion' | 'data_delivery' | 'service';
  /** Was this associated with a payment? */
  readonly revenueAssociated: boolean;
  /** Revenue event ref, if any */
  readonly revenueRef?: string;
  /** Timestamp */
  readonly timestamp: string;
}

// ── Task Completion Event (task done) ─────────────────────────────────

export interface TaskCompletionEvent {
  readonly type: 'task_completion';
  /** Task ID */
  readonly taskId: string;
  /** Task name */
  readonly taskName: string;
  /** Success or failure */
  readonly success: boolean;
  /** Actual cost incurred in cents */
  readonly actualCostCents: number;
  /** Whether revenue was generated */
  readonly revenueGenerated: boolean;
  /** Net value: revenue - cost (cents) */
  readonly netValueCents: number;
  /** Timestamp */
  readonly timestamp: string;
}

// ── Union type ────────────────────────────────────────────────────────

export type ValueEvent = RevenueEvent | ValueRealizationEvent | TaskCompletionEvent;
