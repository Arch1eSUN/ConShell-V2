/**
 * Identity Anchor & Continuity Record — the agent's "self-record"
 *
 * IdentityAnchor: stable self-record binding soul + wallet + name.
 * ContinuityRecord: hash-chained versioned self-history (tamper-evident).
 *
 * This module establishes the minimum viable "I am me" foundation:
 * - IdentityAnchor is created once at genesis and persists across restarts
 * - ContinuityRecords form a chain; each hashes its predecessor
 * - The chain proves identity/memory mutations are linearly ordered
 */
import { randomUUID, createHash } from 'node:crypto';

// ── Types ──────────────────────────────────────────────────────────────

/**
 * The foundational self-record. Created once, immutable after genesis.
 * This is what makes *this* agent *this* agent.
 */
export interface IdentityAnchor {
  /** Stable UUID — survives restarts, never changes */
  id: string;
  /** Agent name (from SOUL at genesis) */
  name: string;
  /** Wallet address — cryptographic identity */
  walletAddress: string | null;
  /** SHA-256 of SOUL.md at genesis */
  soulHash: string;
  /** Genesis timestamp (ISO 8601) */
  createdAt: string;
  /** Parent identity ID for lineage tracking (null for genesis agents) */
  parentIdentityId: string | null;
  /** Generation number (0 = original, 1 = first child, etc.) */
  generation: number;
}

/**
 * A versioned snapshot of the agent's coherent self-state.
 * Each record hashes its predecessor, forming a tamper-evident chain.
 */
export interface ContinuityRecord {
  /** Monotonically increasing version number (1-indexed) */
  version: number;
  /** FK → IdentityAnchor.id */
  identityId: string;
  /** SHA-256 of current SOUL.md content */
  soulHash: string;
  /** Soul evolution count at this point */
  soulVersion: number;
  /** Total sessions attributed to this identity */
  sessionCount: number;
  /** Total episodic memories attributed */
  memoryEpisodeCount: number;
  /** Most recent session ID */
  lastSessionId: string | null;
  /** SHA-256 of the previous ContinuityRecord (null for genesis) */
  previousHash: string | null;
  /** SHA-256 of this record's canonical content */
  recordHash: string;
  /** When this record was created */
  createdAt: string;
}

/**
 * Result of verifying a continuity chain.
 */
export interface ChainVerificationResult {
  /** Whether the entire chain is valid */
  valid: boolean;
  /** Total records in chain */
  length: number;
  /** Index of first broken link (-1 if valid) */
  brokenAtVersion: number;
  /** Human-readable reason if broken */
  reason?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** SHA-256 hex of a string */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Compute the canonical hash of a ContinuityRecord.
 * Excludes `recordHash` itself (it is the output of this function).
 */
export function computeRecordHash(record: Omit<ContinuityRecord, 'recordHash'>): string {
  const canonical = JSON.stringify({
    version: record.version,
    identityId: record.identityId,
    soulHash: record.soulHash,
    soulVersion: record.soulVersion,
    sessionCount: record.sessionCount,
    memoryEpisodeCount: record.memoryEpisodeCount,
    lastSessionId: record.lastSessionId,
    previousHash: record.previousHash,
    createdAt: record.createdAt,
  });
  return sha256(canonical);
}

// ── Factory Functions ──────────────────────────────────────────────────

/**
 * Create the genesis IdentityAnchor from soul content and wallet address.
 */
export function createIdentityAnchor(params: {
  name: string;
  soulContent: string;
  walletAddress?: string | null;
  parentIdentityId?: string | null;
  generation?: number;
}): IdentityAnchor {
  return {
    id: randomUUID(),
    name: params.name,
    walletAddress: params.walletAddress ?? null,
    soulHash: sha256(params.soulContent),
    createdAt: new Date().toISOString(),
    parentIdentityId: params.parentIdentityId ?? null,
    generation: params.generation ?? 0,
  };
}

/**
 * Create the first ContinuityRecord (version 1, no predecessor).
 */
export function createContinuityRecord(params: {
  anchor: IdentityAnchor;
  soulContent: string;
  soulVersion?: number;
  sessionCount?: number;
  memoryEpisodeCount?: number;
  lastSessionId?: string | null;
}): ContinuityRecord {
  const partial: Omit<ContinuityRecord, 'recordHash'> = {
    version: 1,
    identityId: params.anchor.id,
    soulHash: sha256(params.soulContent),
    soulVersion: params.soulVersion ?? 0,
    sessionCount: params.sessionCount ?? 0,
    memoryEpisodeCount: params.memoryEpisodeCount ?? 0,
    lastSessionId: params.lastSessionId ?? null,
    previousHash: null,
    createdAt: new Date().toISOString(),
  };

  return { ...partial, recordHash: computeRecordHash(partial) };
}

/**
 * Advance the continuity chain by creating the next record.
 * Links to the previous record via hash.
 */
export function advanceContinuityRecord(params: {
  previous: ContinuityRecord;
  soulContent: string;
  soulVersion?: number;
  sessionCount?: number;
  memoryEpisodeCount?: number;
  lastSessionId?: string | null;
}): ContinuityRecord {
  const partial: Omit<ContinuityRecord, 'recordHash'> = {
    version: params.previous.version + 1,
    identityId: params.previous.identityId,
    soulHash: sha256(params.soulContent),
    soulVersion: params.soulVersion ?? params.previous.soulVersion,
    sessionCount: params.sessionCount ?? params.previous.sessionCount,
    memoryEpisodeCount: params.memoryEpisodeCount ?? params.previous.memoryEpisodeCount,
    lastSessionId: params.lastSessionId ?? params.previous.lastSessionId,
    previousHash: params.previous.recordHash,
    createdAt: new Date().toISOString(),
  };

  return { ...partial, recordHash: computeRecordHash(partial) };
}

// ── Chain Verification ─────────────────────────────────────────────────

/**
 * Verify a continuity chain is unbroken and tamper-free.
 * Records must be provided in ascending version order.
 */
export function verifyContinuityChain(records: ContinuityRecord[]): ChainVerificationResult {
  if (records.length === 0) {
    return { valid: true, length: 0, brokenAtVersion: -1 };
  }

  // First record must have no predecessor
  const first = records[0]!;
  if (first.previousHash !== null) {
    return {
      valid: false,
      length: records.length,
      brokenAtVersion: first.version,
      reason: `Genesis record (v${first.version}) has non-null previousHash`,
    };
  }

  // Verify first record's self-hash
  const firstExpected = computeRecordHash(first);
  if (first.recordHash !== firstExpected) {
    return {
      valid: false,
      length: records.length,
      brokenAtVersion: first.version,
      reason: `Genesis record (v${first.version}) self-hash mismatch`,
    };
  }

  // Walk the chain
  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1]!;
    const curr = records[i]!;

    // Version must be sequential
    if (curr.version !== prev.version + 1) {
      return {
        valid: false,
        length: records.length,
        brokenAtVersion: curr.version,
        reason: `Version gap: expected ${prev.version + 1}, got ${curr.version}`,
      };
    }

    // Previous hash must match
    if (curr.previousHash !== prev.recordHash) {
      return {
        valid: false,
        length: records.length,
        brokenAtVersion: curr.version,
        reason: `Chain break at v${curr.version}: previousHash does not match v${prev.version} recordHash`,
      };
    }

    // Self-hash must be valid
    const expected = computeRecordHash(curr);
    if (curr.recordHash !== expected) {
      return {
        valid: false,
        length: records.length,
        brokenAtVersion: curr.version,
        reason: `Self-hash mismatch at v${curr.version}`,
      };
    }

    // Identity must be consistent
    if (curr.identityId !== prev.identityId) {
      return {
        valid: false,
        length: records.length,
        brokenAtVersion: curr.version,
        reason: `Identity mismatch at v${curr.version}: different identityId from v${prev.version}`,
      };
    }
  }

  return { valid: true, length: records.length, brokenAtVersion: -1 };
}
