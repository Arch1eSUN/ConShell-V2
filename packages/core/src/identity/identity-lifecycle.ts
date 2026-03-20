/**
 * Identity Lifecycle — Round 15.6 (Goal B) + Round 17.4 (Durable Registry)
 *
 * Formal identity state machine with versioned records and lifecycle transitions:
 *   - Active → Rotated (create new, link old)
 *   - Active → Revoked (permanent deactivation)
 *   - Revoked → Recovered → Active (creator-authorized recovery)
 *
 * Each IdentityRecord is a versioned snapshot of identity state.
 * The system guarantees exactly one `active` record at any time.
 *
 * Round 17.4 additions:
 *   - Extended IdentityRecord with wallet/claims/key fields
 *   - Added serialize/restore for checkpoint persistence
 *   - Added `recovered` status
 */
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';

// ── Types ─────────────────────────────────────────────────────────────

export type IdentityStatus = 'active' | 'rotated' | 'revoked' | 'recovered';

/**
 * A versioned identity record.
 * Each record represents one "era" of identity, linked to its predecessor.
 *
 * Round 17.4: Extended with wallet, claims, key, and successor fields
 * to support durable sovereign identity closure.
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
  /** Successor record ID (null if active / terminal) */
  successorRecordId: string | null;
  /** When this record was created */
  createdAt: string;
  /** When this record was rotated or revoked (null if active) */
  retiredAt: string | null;
  /** Reason for retirement */
  retirementReason: string | null;
  // ── Round 17.4 fields ──
  /** Wallet address linked to this identity epoch */
  walletAddress: string | null;
  /** SHA-256 hash of the public claims set at issuance time */
  publicClaimsHash: string | null;
  /** Key fingerprint / signing metadata for this epoch */
  keyFingerprint: string | null;
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
  opts?: { walletAddress?: string | null; keyFingerprint?: string | null },
): IdentityRecord {
  return {
    id: randomUUID(),
    version: 1,
    status: 'active',
    anchorId,
    name,
    soulHash,
    previousRecordId: null,
    successorRecordId: null,
    createdAt: new Date().toISOString(),
    retiredAt: null,
    retirementReason: null,
    walletAddress: opts?.walletAddress ?? null,
    publicClaimsHash: null,
    keyFingerprint: opts?.keyFingerprint ?? null,
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
  const nextId = randomUUID();

  const retired: IdentityRecord = {
    ...current,
    status: 'rotated',
    retiredAt: now,
    retirementReason: reason,
    successorRecordId: nextId,
  };

  const next: IdentityRecord = {
    id: nextId,
    version: current.version + 1,
    status: 'active',
    anchorId: current.anchorId,
    name: newName,
    soulHash: newSoulHash,
    previousRecordId: current.id,
    successorRecordId: null,
    createdAt: now,
    retiredAt: null,
    retirementReason: null,
    walletAddress: current.walletAddress,
    publicClaimsHash: null,
    keyFingerprint: current.keyFingerprint,
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

  const recoveredId = randomUUID();
  const now = new Date().toISOString();

  // Mark the revoked record with successor link
  const updatedRevoked: IdentityRecord = {
    ...revoked,
    successorRecordId: recoveredId,
  };

  const recovered: IdentityRecord = {
    id: recoveredId,
    version: revoked.version + 1,
    status: 'active',
    anchorId: revoked.anchorId,
    name: revoked.name,
    soulHash: newSoulHash,
    previousRecordId: revoked.id,
    successorRecordId: null,
    createdAt: now,
    retiredAt: null,
    retirementReason: null,
    walletAddress: revoked.walletAddress,
    publicClaimsHash: null,
    keyFingerprint: revoked.keyFingerprint,
  };

  return {
    success: true,
    newRecord: recovered,
    previousRecord: updatedRevoked,
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

// ── Serialization (Round 17.4) ──────────────────────────────────────────

/**
 * Snapshot of identity records for checkpoint persistence.
 */
export interface IdentityRecordSnapshot {
  version: 1;
  records: IdentityRecord[];
  snapshotAt: string;
}

/**
 * Serialize an array of IdentityRecords to a JSON-safe snapshot.
 * Used by CheckpointManager for durable persistence.
 */
export function serializeRecords(records: readonly IdentityRecord[]): IdentityRecordSnapshot {
  return {
    version: 1,
    records: records.map(r => ({ ...r })),
    snapshotAt: new Date().toISOString(),
  };
}

/** Result of a hardened restore operation (Round 17.5 G4) */
export interface RestoreResult {
  valid: boolean;
  records: IdentityRecord[];
  errors: string[];
}

/**
 * Hardened restore with full validation report.
 */
export function restoreRecordsHardened(snapshot: unknown): RestoreResult {
  const errors: string[] = [];

  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, records: [], errors: ['Invalid snapshot: not an object'] };
  }
  const s = snapshot as Record<string, unknown>;
  if (s.version !== 1 || !Array.isArray(s.records)) {
    return { valid: false, records: [], errors: ['Invalid snapshot version or missing records array'] };
  }

  const requiredFields = ['id', 'version', 'status', 'anchorId', 'name', 'soulHash', 'createdAt'];

  // Layer 1: Format validation
  for (let i = 0; i < s.records.length; i++) {
    const r = s.records[i];
    if (!r || typeof r !== 'object') {
      errors.push(`Record [${i}]: not an object`);
      continue;
    }
    const rec = r as Record<string, unknown>;
    for (const field of requiredFields) {
      if (rec[field] === undefined || rec[field] === null) {
        errors.push(`Record [${i}]: missing field '${field}'`);
      }
    }
    if (typeof rec.version !== 'number') {
      errors.push(`Record [${i}]: version must be a number`);
    }
    if (typeof rec.status !== 'string' || !['active', 'rotated', 'revoked', 'recovered'].includes(rec.status)) {
      errors.push(`Record [${i}]: invalid status '${rec.status}'`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, records: [], errors };
  }

  const records = (s.records as IdentityRecord[]).map(r => ({ ...r }));
  const sorted = [...records].sort((a, b) => a.version - b.version);

  // Layer 2: Chain integrity
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.version <= sorted[i - 1]!.version) {
      errors.push(`Chain break: record version ${sorted[i]!.version} not greater than ${sorted[i - 1]!.version}`);
    }
    if (sorted[i]!.previousRecordId && sorted[i]!.previousRecordId !== sorted[i - 1]!.id) {
      errors.push(`Chain break: record ${sorted[i]!.id} previousRecordId '${sorted[i]!.previousRecordId}' != expected '${sorted[i - 1]!.id}'`);
    }
  }

  // Layer 3: Status consistency — at most 1 active record
  const activeRecords = records.filter(r => r.status === 'active');
  if (activeRecords.length > 1) {
    errors.push(`Status inconsistency: ${activeRecords.length} active records found (expected ≤ 1)`);
  }

  return { valid: errors.length === 0, records, errors };
}
