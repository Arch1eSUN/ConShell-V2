/**
 * Round 15.7 — Hash-Chained Immutable Economic Ledger
 *
 * Append-only ledger where each entry contains a SHA-256 hash reference
 * to the previous entry, forming a tamper-evident chain. All entries are
 * frozen after creation. The ledger can be verified at any time to detect
 * corruption or tampering.
 */
import { createHash } from 'node:crypto';

// ── Ledger Entry ─────────────────────────────────────────────────────

export type LedgerEntryType = 'debit' | 'credit' | 'refund';

export interface LedgerEntry {
  /** Sequential ID (1-indexed) */
  readonly id: number;
  /** Entry type: debit (spend), credit (income), refund */
  readonly type: LedgerEntryType;
  /** Amount in cents (always positive; type determines direction) */
  readonly amountCents: number;
  /** Category (e.g., 'inference', 'x402_payment', 'api_access') */
  readonly category: string;
  /** Source identifier (e.g., provider name, revenue surface ID) */
  readonly source: string;
  /** Human-readable description */
  readonly description: string;
  /** ISO timestamp */
  readonly timestamp: string;
  /** SHA-256 hash of the previous entry (genesis = '0') */
  readonly prevHash: string;
  /** SHA-256 hash of this entry (computed from prevHash + content) */
  readonly hash: string;
}

// ── Verification Result ──────────────────────────────────────────────

export interface LedgerVerification {
  /** Whether the entire chain is valid */
  valid: boolean;
  /** Total number of entries verified */
  entriesChecked: number;
  /** If invalid, the index where the chain breaks */
  brokenAt?: number;
  /** Reason for failure */
  reason?: string;
}

// ── Ledger Snapshot ──────────────────────────────────────────────────

export interface LedgerSnapshot {
  /** Current running balance (credits - debits + refunds) */
  balanceCents: number;
  /** Total credits */
  totalCreditsCents: number;
  /** Total debits */
  totalDebitsCents: number;
  /** Total refunds */
  totalRefundsCents: number;
  /** Number of entries */
  entryCount: number;
  /** Hash of the latest entry */
  headHash: string;
}

// ── Genesis constant ─────────────────────────────────────────────────

const GENESIS_HASH = '0'.repeat(64);

// ── Hash computation ─────────────────────────────────────────────────

/**
 * Compute the SHA-256 hash of a ledger entry's content.
 * Hash = SHA256(prevHash | type | amountCents | category | source | timestamp)
 *
 * Deterministic: same inputs always produce the same hash.
 */
export function computeEntryHash(
  prevHash: string,
  type: LedgerEntryType,
  amountCents: number,
  category: string,
  source: string,
  timestamp: string,
): string {
  const payload = `${prevHash}|${type}|${amountCents}|${category}|${source}|${timestamp}`;
  return createHash('sha256').update(payload).digest('hex');
}

// ── Economic Ledger ──────────────────────────────────────────────────

export class EconomicLedger {
  private _entries: LedgerEntry[] = [];
  private _headHash: string = GENESIS_HASH;
  private _nextId = 1;

  // Running totals for O(1) snapshot
  private _totalCredits = 0;
  private _totalDebits = 0;
  private _totalRefunds = 0;

  /**
   * Append a new entry to the ledger.
   * The entry is hash-chained to the previous entry and frozen.
   * Returns the created entry.
   */
  append(
    type: LedgerEntryType,
    amountCents: number,
    category: string,
    source: string,
    description: string,
    timestamp?: string,
  ): LedgerEntry {
    if (amountCents < 0) {
      throw new Error('LedgerEntry amountCents must be non-negative');
    }

    const ts = timestamp ?? new Date().toISOString();
    const hash = computeEntryHash(this._headHash, type, amountCents, category, source, ts);

    const entry: LedgerEntry = Object.freeze({
      id: this._nextId++,
      type,
      amountCents,
      category,
      source,
      description,
      timestamp: ts,
      prevHash: this._headHash,
      hash,
    });

    this._entries.push(entry);
    this._headHash = hash;

    // Update running totals
    switch (type) {
      case 'credit':
        this._totalCredits += amountCents;
        break;
      case 'debit':
        this._totalDebits += amountCents;
        break;
      case 'refund':
        this._totalRefunds += amountCents;
        break;
    }

    return entry;
  }

  /**
   * Verify the entire hash chain.
   * Returns verification result with location of any break.
   */
  verify(): LedgerVerification {
    if (this._entries.length === 0) {
      return { valid: true, entriesChecked: 0 };
    }

    let prevHash = GENESIS_HASH;

    for (let i = 0; i < this._entries.length; i++) {
      const entry = this._entries[i];

      // Check prevHash linkage
      if (entry.prevHash !== prevHash) {
        return {
          valid: false,
          entriesChecked: i + 1,
          brokenAt: i,
          reason: `Entry ${entry.id} prevHash mismatch: expected ${prevHash.slice(0, 8)}..., got ${entry.prevHash.slice(0, 8)}...`,
        };
      }

      // Recompute hash and compare
      const expectedHash = computeEntryHash(
        entry.prevHash,
        entry.type,
        entry.amountCents,
        entry.category,
        entry.source,
        entry.timestamp,
      );

      if (entry.hash !== expectedHash) {
        return {
          valid: false,
          entriesChecked: i + 1,
          brokenAt: i,
          reason: `Entry ${entry.id} hash mismatch: content has been tampered`,
        };
      }

      prevHash = entry.hash;
    }

    return { valid: true, entriesChecked: this._entries.length };
  }

  /**
   * Get all entries (frozen, read-only).
   */
  entries(): ReadonlyArray<LedgerEntry> {
    return [...this._entries];
  }

  /**
   * Get a snapshot of the current ledger state.
   */
  snapshot(): LedgerSnapshot {
    return {
      balanceCents: this._totalCredits - this._totalDebits + this._totalRefunds,
      totalCreditsCents: this._totalCredits,
      totalDebitsCents: this._totalDebits,
      totalRefundsCents: this._totalRefunds,
      entryCount: this._entries.length,
      headHash: this._headHash,
    };
  }

  /**
   * Get entries within a time range.
   */
  getByRange(from: string, to: string): ReadonlyArray<LedgerEntry> {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    return this._entries.filter(e => {
      const ms = new Date(e.timestamp).getTime();
      return ms >= fromMs && ms <= toMs;
    });
  }

  /**
   * Get entries by type.
   */
  getByType(type: LedgerEntryType): ReadonlyArray<LedgerEntry> {
    return this._entries.filter(e => e.type === type);
  }

  /**
   * Get the current head hash (hash of the latest entry).
   */
  headHash(): string {
    return this._headHash;
  }

  /**
   * Get entry count.
   */
  size(): number {
    return this._entries.length;
  }
}
