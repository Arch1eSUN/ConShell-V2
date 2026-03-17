/**
 * Canonical Self Model — Round 15.6 (Goal A)
 *
 * Defines the unified `CanonicalSelf` interface that converges:
 *   - IdentityAnchor (immutable genesis)
 *   - ContinuityRecord (chain position)
 *   - SoulData reference (personality/values/goals)
 *   - Wallet binding
 * into a single, restart-stable object.
 *
 * `SelfModelService` resolves the canonical self from ContinuityService,
 * making it the SOLE runtime source of truth for "who am I?".
 */
import { createHash } from 'node:crypto';
import type { IdentityAnchor, ContinuityRecord } from './anchor.js';
import type { ContinuityService, SelfState } from './continuity-service.js';
import type { SoulData } from '../soul/system.js';

// ── Types ─────────────────────────────────────────────────────────────

/** Minimal soul reference carried in the self model */
export interface SoulReference {
  name: string;
  contentHash: string;
  personality: readonly string[];
  values: readonly string[];
  goals: readonly string[];
}

/** Wallet binding — proves signing authority */
export interface WalletBinding {
  address: string;
  chainId: number;
  boundAt: string; // ISO timestamp
}

/** Verification verdict for the canonical self */
export interface SelfVerification {
  valid: boolean;
  chainValid: boolean;
  chainLength: number;
  bootMode: 'genesis' | 'restart' | 'degraded';
  issues: string[];
}

/**
 * The unified canonical self — answers "who am I?" at any point in time.
 *
 * Invariants:
 *   - `anchor` never changes after genesis
 *   - `soul` reflects the current SOUL.md content
 *   - `continuity` reflects the latest chain position
 *   - `verification.valid` is true iff the chain is intact
 */
export interface CanonicalSelf {
  /** Immutable genesis anchor (UUID, name, wallet, soulHash) */
  readonly anchor: IdentityAnchor;

  /** Latest continuity chain position */
  readonly continuity: ContinuitySnapshot;

  /** Current soul identity reference */
  readonly soul: SoulReference;

  /** Wallet signing authority (null if walletless) */
  readonly wallet: WalletBinding | null;

  /** Self-verification result */
  readonly verification: SelfVerification;

  /** ISO timestamp of when this self was resolved */
  readonly resolvedAt: string;

  /**
   * Deterministic fingerprint of the canonical self.
   * Hash of anchor.id + soul.contentHash + continuity.version.
   * Used by memory ownership and audit trails.
   */
  readonly selfFingerprint: string;
}

/** Snapshot of chain position (subset of full ContinuityRecord) */
export interface ContinuitySnapshot {
  version: number;
  hash: string;
  previousHash: string | null;
  sessionCount: number;
  memoryEpisodeCount: number;
  timestamp: string;
}

// ── Service ────────────────────────────────────────────────────────────

/**
 * SelfModelService — THE runtime source for canonical self resolution.
 *
 * Backed by ContinuityService (SQLite-persisted), this service:
 *   1. Resolves the current CanonicalSelf on demand
 *   2. Is restart-stable (backed by durable state)
 *   3. Validates chain integrity on every resolution
 *   4. Computes deterministic fingerprints for audit
 */
export class SelfModelService {
  private cached: CanonicalSelf | null = null;
  private continuityService: ContinuityService;
  private walletBinding: WalletBinding | null;

  constructor(
    continuityService: ContinuityService,
    wallet: { address: string; chainId: number } | null,
  ) {
    this.continuityService = continuityService;
    this.walletBinding = wallet
      ? { address: wallet.address, chainId: wallet.chainId, boundAt: new Date().toISOString() }
      : null;
  }

  /**
   * Resolve the canonical self from the current runtime state.
   *
   * This is the primary API — all consumers use this instead of
   * ad-hoc self lookups across identity/soul/continuity.
   *
   * @param soul Current SoulData (from SoulSystem)
   * @returns The resolved CanonicalSelf
   */
  resolve(soul: SoulData): CanonicalSelf {
    const selfState = this.continuityService.getCurrentState();
    if (!selfState) {
      throw new Error('SelfModelService.resolve(): ContinuityService not hydrated');
    }
    return this.buildCanonicalSelf(selfState, soul);
  }

  /**
   * Get the last resolved self without re-resolving.
   * Returns null if resolve() has never been called.
   */
  getCached(): CanonicalSelf | null {
    return this.cached;
  }

  /**
   * Force cache invalidation (e.g., after soul evolution or continuity advance).
   */
  invalidate(): void {
    this.cached = null;
  }

  /**
   * Check if the canonical self is in a valid state.
   * Convenience for quick health checks without full resolve.
   */
  isValid(): boolean {
    if (!this.cached) return false;
    return this.cached.verification.valid;
  }

  /**
   * Get the self fingerprint for memory ownership tagging.
   * Must have been resolved at least once.
   */
  getFingerprint(): string | null {
    return this.cached?.selfFingerprint ?? null;
  }

  // ── Private ──────────────────────────────────────────────────────────

  private buildCanonicalSelf(selfState: SelfState, soul: SoulData): CanonicalSelf {
    const soulHash = createHash('sha256').update(soul.raw).digest('hex');

    const soulRef: SoulReference = {
      name: soul.name,
      contentHash: soulHash,
      personality: Object.freeze([...soul.personality]),
      values: Object.freeze([...soul.values]),
      goals: Object.freeze([...soul.goals]),
    };

    const continuity: ContinuitySnapshot = selfState.latestRecord
      ? {
          version: selfState.latestRecord.version,
          hash: selfState.latestRecord.recordHash,
          previousHash: selfState.latestRecord.previousHash,
          sessionCount: selfState.latestRecord.sessionCount ?? 0,
          memoryEpisodeCount: selfState.latestRecord.memoryEpisodeCount ?? 0,
          timestamp: selfState.latestRecord.createdAt,
        }
      : {
          version: 0,
          hash: selfState.anchor.id,
          previousHash: null,
          sessionCount: 0,
          memoryEpisodeCount: 0,
          timestamp: new Date().toISOString(),
        };

    const issues: string[] = [];
    if (!selfState.chainValid) issues.push('continuity chain broken');
    if (selfState.mode === 'degraded') issues.push('booted in degraded mode');
    if (!soul.name || soul.name === '') issues.push('soul name is empty');
    if (soul.values.length === 0) issues.push('soul has no values');

    const verification: SelfVerification = {
      valid: selfState.chainValid && selfState.mode !== 'degraded' && issues.length === 0,
      chainValid: selfState.chainValid,
      chainLength: selfState.chainLength,
      bootMode: selfState.mode,
      issues,
    };

    const fingerprint = computeSelfFingerprint(
      selfState.anchor.id,
      soulHash,
      continuity.version,
    );

    const canonical: CanonicalSelf = {
      anchor: selfState.anchor,
      continuity,
      soul: soulRef,
      wallet: this.walletBinding,
      verification,
      resolvedAt: new Date().toISOString(),
      selfFingerprint: fingerprint,
    };

    this.cached = canonical;
    return canonical;
  }
}

// ── Pure helpers ─────────────────────────────────────────────────────────

/**
 * Deterministic fingerprint: sha256(anchorId + soulHash + version).
 * Exported for testing.
 */
export function computeSelfFingerprint(
  anchorId: string,
  soulContentHash: string,
  continuityVersion: number,
): string {
  return createHash('sha256')
    .update(`${anchorId}:${soulContentHash}:${continuityVersion}`)
    .digest('hex');
}
