/**
 * Identity Lifecycle — Round 15.6 (Goal B)
 *
 * Formal identity state machine with versioned records and lifecycle transitions:
 *   - Active → Rotated (create new, link old)
 *   - Active → Revoked (permanent deactivation)
 *   - Revoked → Active (creator-authorized recovery)
 *
 * Each IdentityRecord is a versioned snapshot of identity state.
 * The system guarantees exactly one `active` record at any time.
 */
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';

// ── Types ─────────────────────────────────────────────────────────────

export type IdentityStatus = 'active' | 'rotated' | 'revoked';

/**
 * A versioned identity record.
 * Each record represents one "era" of identity, linked to its predecessor.
 */
export interface IdentityRecord {
  /** Unique record ID */
  id: string;
  /** Monotonically increasing version number */
  version: number;
  /** Current status */
  status: IdentityStatus;
  /** Link to the IdentityAnchor (genesis) */
  anchorId: string;
  /** Agent name at this version */
  name: string;
  /** Soul content hash at creation time */
  soulHash: string;
  /** Previous record ID (null for first record) */
  previousRecordId: string | null;
  /** When this record was created */
  createdAt: string;
  /** When this record was rotated or revoked (null if active) */
  retiredAt: string | null;
  /** Reason for retirement */
  retirementReason: string | null;
}

/** Result of a lifecycle transition */
export interface LifecycleTransitionResult {
  success: boolean;
  newRecord?: IdentityRecord;
  previousRecord?: IdentityRecord;
  reason: string;
}

// ── Pure lifecycle functions ────────────────────────────────────────────

/**
 * Create the initial identity record from an anchor.
 */
export function createGenesisRecord(
  anchorId: string,
  name: string,
  soulHash: string,
): IdentityRecord {
  return {
    id: randomUUID(),
    version: 1,
    status: 'active',
    anchorId,
    name,
    soulHash,
    previousRecordId: null,
    createdAt: new Date().toISOString(),
    retiredAt: null,
    retirementReason: null,
  };
}

/**
 * Rotate identity: create a new active record, mark old as rotated.
 *
 * @param current - The currently active record
 * @param newName - Updated name (or same)
 * @param newSoulHash - Updated soul hash
 * @param reason - Why rotation is happening
 * @returns Transition result with both old and new records
 */
export function rotateIdentity(
  current: IdentityRecord,
  newName: string,
  newSoulHash: string,
  reason: string,
): LifecycleTransitionResult {
  if (current.status !== 'active') {
    return {
      success: false,
      reason: `Cannot rotate: current record is ${current.status}, not active`,
    };
  }

  const now = new Date().toISOString();

  const retired: IdentityRecord = {
    ...current,
    status: 'rotated',
    retiredAt: now,
    retirementReason: reason,
  };

  const next: IdentityRecord = {
    id: randomUUID(),
    version: current.version + 1,
    status: 'active',
    anchorId: current.anchorId,
    name: newName,
    soulHash: newSoulHash,
    previousRecordId: current.id,
    createdAt: now,
    retiredAt: null,
    retirementReason: null,
  };

  return {
    success: true,
    newRecord: next,
    previousRecord: retired,
    reason: `Rotated from v${current.version} to v${next.version}: ${reason}`,
  };
}

/**
 * Revoke identity: permanently deactivate (can only be recovered by authority).
 */
export function revokeIdentity(
  current: IdentityRecord,
  reason: string,
): LifecycleTransitionResult {
  if (current.status !== 'active') {
    return {
      success: false,
      reason: `Cannot revoke: current record is ${current.status}, not active`,
    };
  }

  const revoked: IdentityRecord = {
    ...current,
    status: 'revoked',
    retiredAt: new Date().toISOString(),
    retirementReason: reason,
  };

  return {
    success: true,
    previousRecord: revoked,
    reason: `Revoked v${current.version}: ${reason}`,
  };
}

/**
 * Recover identity: re-activate a revoked record as a new version.
 * Only valid for revoked records (rotated records are immutable).
 */
export function recoverIdentity(
  revoked: IdentityRecord,
  newSoulHash: string,
  recoveryReason: string,
): LifecycleTransitionResult {
  if (revoked.status !== 'revoked') {
    return {
      success: false,
      reason: `Cannot recover: record is ${revoked.status}, not revoked`,
    };
  }

  const recovered: IdentityRecord = {
    id: randomUUID(),
    version: revoked.version + 1,
    status: 'active',
    anchorId: revoked.anchorId,
    name: revoked.name,
    soulHash: newSoulHash,
    previousRecordId: revoked.id,
    createdAt: new Date().toISOString(),
    retiredAt: null,
    retirementReason: null,
  };

  return {
    success: true,
    newRecord: recovered,
    previousRecord: revoked,
    reason: `Recovered from revoked v${revoked.version}: ${recoveryReason}`,
  };
}

/**
 * Resolve the active record from a list of records.
 * Returns null if no active record exists (identity is in revoked state).
 */
export function resolveActive(records: IdentityRecord[]): IdentityRecord | null {
  return records.find(r => r.status === 'active') ?? null;
}

/**
 * Validate a record chain: each record must link to its predecessor.
 */
export function validateRecordChain(records: IdentityRecord[]): {
  valid: boolean;
  issues: string[];
} {
  if (records.length === 0) {
    return { valid: false, issues: ['empty record chain'] };
  }

  const sorted = [...records].sort((a, b) => a.version - b.version);
  const issues: string[] = [];

  // First record must have no predecessor
  if (sorted[0]!.previousRecordId !== null) {
    issues.push(`genesis record v${sorted[0]!.version} has unexpected previousRecordId`);
  }

  // Each subsequent record must link to the previous
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const previous = sorted[i - 1]!;
    if (current.previousRecordId !== previous.id) {
      issues.push(
        `v${current.version} previousRecordId mismatch: expected ${previous.id}, got ${current.previousRecordId}`,
      );
    }
    if (current.version !== previous.version + 1) {
      issues.push(
        `version gap: v${previous.version} → v${current.version}`,
      );
    }
  }

  // Exactly one active record
  const activeCount = sorted.filter(r => r.status === 'active').length;
  if (activeCount > 1) {
    issues.push(`multiple active records: ${activeCount}`);
  }

  return { valid: issues.length === 0, issues };
}
