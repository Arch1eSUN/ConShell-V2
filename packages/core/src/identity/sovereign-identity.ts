/**
 * Sovereign Identity Service — Round 16.2
 *
 * THE canonical identity owner for the ConShell runtime.
 * Upgraded from SelfModelService (Round 15.6) to become the single
 * source of truth for "who am I, what can I do, and what is my status?"
 *
 * Responsibilities:
 *   1. Resolve CanonicalSelf (retained from SelfModelService)
 *   2. Generate structured claims (stable / capability / operational)
 *   3. Manage identity lifecycle (rotate / recover / revoke)
 *   4. Emit identity change events for downstream consumers
 *   5. Provide layered claim surfaces (public / full)
 */
import { createHash } from 'node:crypto';
import type { IdentityAnchor, ContinuityRecord } from './anchor.js';
import type { ContinuityService, SelfState } from './continuity-service.js';
import type { SoulData } from '../soul/system.js';
import {
  rotateIdentity, revokeIdentity, recoverIdentity,
  createGenesisRecord, resolveActive,
  serializeRecords, restoreRecordsHardened,
  type IdentityRecord, type IdentityStatus, type IdentityRecordSnapshot,
} from './identity-lifecycle.js';
import type { ClaimRegistry } from './identity-claims.js';
import type {
  SovereignIdentityStatus, StableClaim, CapabilityClaim,
  OperationalClaim, IdentityClaimSet, PublicClaimSet,
  ClaimVerification, CapabilityEntry,
  IdentityRotationResult, IdentityRecoveryResult, IdentityRevocationResult,
  IdentityChangeEvent, IdentityChangeListener,
} from './sovereign-identity-contract.js';

// Re-export types from self-model for backward compatibility
export type {
  CanonicalSelf, SoulReference, WalletBinding,
  SelfVerification, ContinuitySnapshot,
} from './self-model.js';
export { computeSelfFingerprint } from './self-model.js';

// Import types we need internally
import type {
  CanonicalSelf, SoulReference, WalletBinding,
  SelfVerification, ContinuitySnapshot,
} from './self-model.js';

// ── Runtime Context (passed in for operational/capability claims) ──────

export interface RuntimeContext {
  runtimeMode: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  activeCommitmentCount: number;
  agendaActive: boolean;
  enabledSurfaces: string[];
  verifiedCapabilities: string[];
}

// ── SovereignIdentityService ──────────────────────────────────────────

export class SovereignIdentityService {
  private continuityService: ContinuityService;
  private walletBinding: WalletBinding | null;
  private cachedSelf: CanonicalSelf | null = null;
  private identityStatus: SovereignIdentityStatus = 'active';
  private identityRecords: IdentityRecord[] = [];
  private changeListeners: IdentityChangeListener[] = [];
  private claimRegistry: ClaimRegistry | null = null;

  constructor(
    continuityService: ContinuityService,
    wallet: { address: string; chainId: number } | null,
  ) {
    this.continuityService = continuityService;
    this.walletBinding = wallet
      ? { address: wallet.address, chainId: wallet.chainId, boundAt: new Date().toISOString() }
      : null;
  }

  // ── CanonicalSelf resolution (retained from SelfModelService) ──────

  /**
   * Resolve the canonical self from the current runtime state.
   */
  resolve(soul: SoulData): CanonicalSelf {
    const selfState = this.continuityService.getCurrentState();
    if (!selfState) {
      throw new Error('SovereignIdentityService.resolve(): ContinuityService not hydrated');
    }

    // Derive status from boot mode
    if (selfState.mode === 'degraded') {
      this.identityStatus = 'degraded';
    }

    // Init genesis identity record if needed
    if (this.identityRecords.length === 0) {
      const genesis = createGenesisRecord(
        selfState.anchor.id,
        selfState.anchor.name,
        selfState.anchor.soulHash,
      );
      this.identityRecords.push(genesis);
    }

    return this.buildCanonicalSelf(selfState, soul);
  }

  getCached(): CanonicalSelf | null {
    return this.cachedSelf;
  }

  invalidate(): void {
    this.cachedSelf = null;
  }

  isValid(): boolean {
    if (!this.cachedSelf) return false;
    return this.cachedSelf.verification.valid;
  }

  getFingerprint(): string | null {
    return this.cachedSelf?.selfFingerprint ?? null;
  }

  // ── Claims Surface ─────────────────────────────────────────────────

  /**
   * Get immutable identity facts.
   */
  getStableClaims(): StableClaim {
    const self = this.ensureCached();
    const now = new Date().toISOString();
    return {
      agentId: self.anchor.id,
      displayName: self.anchor.name,
      walletAddress: self.anchor.walletAddress,
      chainId: self.wallet?.chainId ?? null,
      lineageRoot: self.anchor.parentIdentityId,
      generation: self.anchor.generation,
      genesisSoulHash: self.anchor.soulHash,
      verification: {
        verified: self.verification.chainValid,
        method: self.verification.chainValid ? 'chain-validation' : 'anchor-only',
        timestamp: now,
      },
    };
  }

  /**
   * Get runtime capabilities with verified/asserted distinction.
   */
  getCapabilityClaims(ctx: RuntimeContext): CapabilityClaim {
    const now = new Date().toISOString();
    const capabilities: CapabilityEntry[] = [];

    // Always-present capabilities (asserted from config)
    const baseCaps = ['identity-resolution', 'policy-engine', 'soul-system'];
    for (const cap of baseCaps) {
      capabilities.push({ name: cap, verified: true, verificationMethod: 'runtime-present' });
    }

    // Dynamic capabilities — verified only if actually available
    for (const cap of ctx.verifiedCapabilities) {
      capabilities.push({ name: cap, verified: true, verificationMethod: 'runtime-probe' });
    }

    return {
      surfaces: ctx.enabledSurfaces,
      capabilities,
      economicModeSupported: ctx.verifiedCapabilities.includes('economic-memory'),
      agendaSupported: ctx.agendaActive,
      continuitySupported: this.continuityService.hydrated,
      verification: {
        verified: true,
        method: 'runtime-probe',
        timestamp: now,
      },
    };
  }

  /**
   * Get dynamic operational state.
   */
  getOperationalClaims(ctx: RuntimeContext): OperationalClaim {
    const self = this.ensureCached();
    const now = new Date().toISOString();
    return {
      runtimeMode: ctx.runtimeMode,
      health: ctx.health,
      continuityState: self.verification.chainValid
        ? 'chain-valid'
        : (self.verification.bootMode === 'genesis' ? 'fresh-genesis' : 'chain-broken'),
      continuityVersion: self.continuity.version,
      activeCommitmentCount: ctx.activeCommitmentCount,
      agendaActive: ctx.agendaActive,
      bootMode: self.verification.bootMode,
      verification: {
        verified: true,
        method: 'runtime-state',
        timestamp: now,
      },
    };
  }

  /**
   * Get complete claims — for authenticated /api/identity/full endpoint.
   */
  getFullClaims(ctx: RuntimeContext): IdentityClaimSet {
    return {
      stable: this.getStableClaims(),
      capability: this.getCapabilityClaims(ctx),
      operational: this.getOperationalClaims(ctx),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get public-safe claims — for /api/identity/public endpoint.
   */
  getPublicClaims(ctx: RuntimeContext): PublicClaimSet {
    const self = this.ensureCached();
    return {
      agentId: self.anchor.id,
      displayName: self.anchor.name,
      generation: self.anchor.generation,
      runtimeMode: ctx.runtimeMode,
      health: ctx.health,
      status: this.identityStatus,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Identity Status ────────────────────────────────────────────────

  /** Get the current sovereign identity status */
  status(): SovereignIdentityStatus {
    return this.identityStatus;
  }

  // ── Lifecycle Operations ───────────────────────────────────────────

  /**
   * Rotate identity — create new active version, mark current as rotated.
   */
  rotate(newName: string, newSoulHash: string, reason: string): IdentityRotationResult {
    if (this.identityStatus !== 'active' && this.identityStatus !== 'degraded') {
      return {
        success: false,
        previousStatus: this.identityStatus,
        newStatus: this.identityStatus,
        reason: `Cannot rotate: current status is '${this.identityStatus}'`,
      };
    }

    const current = resolveActive(this.identityRecords);
    if (!current) {
      return {
        success: false,
        previousStatus: this.identityStatus,
        newStatus: this.identityStatus,
        reason: 'Cannot rotate: no active identity record',
      };
    }

    const result = rotateIdentity(current, newName, newSoulHash, reason);
    if (!result.success) {
      return {
        success: false,
        previousStatus: this.identityStatus,
        newStatus: this.identityStatus,
        reason: result.reason,
      };
    }

    // Update records
    const idx = this.identityRecords.findIndex(r => r.id === current.id);
    if (idx >= 0) this.identityRecords[idx] = result.previousRecord!;
    this.identityRecords.push(result.newRecord!);

    const previousStatus = this.identityStatus;
    this.identityStatus = 'active';
    this.invalidate();

    this.emitChange(previousStatus, 'active', `Rotated: ${reason}`);

    // Round 17.5 (G5): capability claims inherit to new identity; service claims revoked
    if (this.claimRegistry && result.newRecord) {
      this.claimRegistry.reassignIssuer(current.id, result.newRecord.id, 'capability');
      // Service claims must be re-issued under the new identity
      for (const claim of this.claimRegistry.getByIssuer(current.id)) {
        if (claim.claimType === 'service' && !claim.revoked) {
          this.claimRegistry.revoke(claim.claimId);
        }
      }
    }

    return {
      success: true,
      previousStatus,
      newStatus: 'active',
      reason: result.reason,
      rotatedAt: new Date().toISOString(),
    };
  }

  /**
   * Bind a ClaimRegistry for lifecycle claim propagation (Round 17.5 G5).
   */
  bindClaimRegistry(registry: ClaimRegistry): void {
    this.claimRegistry = registry;
  }

  /**
   * Revoke identity — permanently deactivate.
   */
  revoke(reason: string): IdentityRevocationResult {
    if (this.identityStatus === 'revoked' || this.identityStatus === 'rotated') {
      return {
        success: false,
        previousStatus: this.identityStatus,
        newStatus: this.identityStatus,
        reason: `Cannot revoke: identity is already '${this.identityStatus}'`,
      };
    }

    const current = resolveActive(this.identityRecords);
    if (current) {
      const result = revokeIdentity(current, reason);
      if (result.success && result.previousRecord) {
        const idx = this.identityRecords.findIndex(r => r.id === current.id);
        if (idx >= 0) this.identityRecords[idx] = result.previousRecord;
      }
    }

    const previousStatus = this.identityStatus;
    this.identityStatus = 'revoked';
    this.invalidate();

    this.emitChange(previousStatus, 'revoked', `Revoked: ${reason}`);

    // Round 17.5 (G5): revoke all claims issued by this identity
    if (this.claimRegistry && current) {
      this.claimRegistry.revokeByIssuer(current.id);
    }

    return {
      success: true,
      previousStatus,
      newStatus: 'revoked',
      reason: `Identity revoked: ${reason}`,
      revokedAt: new Date().toISOString(),
    };
  }

  /**
   * Recover identity — re-activate from revoked state.
   */
  recover(newSoulHash: string, reason: string): IdentityRecoveryResult {
    if (this.identityStatus !== 'revoked') {
      return {
        success: false,
        previousStatus: this.identityStatus,
        newStatus: this.identityStatus,
        reason: `Cannot recover: identity is '${this.identityStatus}', not 'revoked'`,
      };
    }

    // Find the revoked record
    const revoked = this.identityRecords.find(r => r.status === 'revoked');
    if (revoked) {
      const result = recoverIdentity(revoked, newSoulHash, reason);
      if (result.success && result.newRecord) {
        this.identityRecords.push(result.newRecord);
      }
    }

    const previousStatus = this.identityStatus;
    this.identityStatus = 'recovering';
    this.invalidate();

    this.emitChange(previousStatus, 'recovering', `Recovery initiated: ${reason}`);

    // Transition to active after recovery
    this.identityStatus = 'active';
    this.emitChange('recovering', 'active', `Recovery complete: ${reason}`);

    return {
      success: true,
      previousStatus,
      newStatus: 'active',
      reason: `Identity recovered: ${reason}`,
      recoveredAt: new Date().toISOString(),
    };
  }

  // ── Event System ───────────────────────────────────────────────────

  /**
   * Register a listener for identity status changes.
   * Used by CommitmentStore for re-evaluation and PolicyEngine for rule checks.
   */
  onIdentityChange(listener: IdentityChangeListener): void {
    this.changeListeners.push(listener);
  }

  /** Remove a previously registered listener */
  removeIdentityChangeListener(listener: IdentityChangeListener): void {
    this.changeListeners = this.changeListeners.filter(l => l !== listener);
  }

  // ── Serialization (Round 17.4) ──────────────────────────────────────

  /**
   * Serialize identity state for checkpoint persistence.
   * Returns a JSON-safe snapshot of all identity records + status.
   */
  serialize(): { records: IdentityRecordSnapshot; status: SovereignIdentityStatus } {
    return {
      records: serializeRecords(this.identityRecords),
      status: this.identityStatus,
    };
  }

  /**
   * Restore identity state from a checkpoint snapshot.
   * Returns true if restoration succeeded.
   */
  restore(snapshot: { records: unknown; status?: string }): boolean {
    const result = restoreRecordsHardened(snapshot.records);
    if (!result.valid) return false;
    this.identityRecords = result.records;
    if (snapshot.status && ['active', 'degraded', 'recovering', 'rotated', 'revoked'].includes(snapshot.status)) {
      this.identityStatus = snapshot.status as SovereignIdentityStatus;
    }
    this.invalidate();
    return true;
  }

  // ── Identity History (Round 17.4) ──────────────────────────────────

  /**
   * Get the full identity history — version chain with status transitions.
   * Sorted by version ascending.
   */
  getIdentityHistory(): readonly IdentityRecord[] {
    return [...this.identityRecords].sort((a, b) => a.version - b.version);
  }

  /**
   * Get the currently active IdentityRecord.
   * Returns null if identity is in revoked state.
   */
  getActiveRecord(): IdentityRecord | null {
    return resolveActive(this.identityRecords);
  }

  /**
   * Get the self fingerprint for identity binding.
   * Requires resolve() to have been called.
   */
  selfFingerprint(): string {
    return this.ensureCached().selfFingerprint;
  }

  // ── Private ────────────────────────────────────────────────────────

  private emitChange(
    previousStatus: SovereignIdentityStatus,
    newStatus: SovereignIdentityStatus,
    reason: string,
  ): void {
    const event: IdentityChangeEvent = {
      previousStatus,
      newStatus,
      reason,
      timestamp: new Date().toISOString(),
    };
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch {
        // Listeners must not break the identity service
      }
    }
  }

  private ensureCached(): CanonicalSelf {
    if (!this.cachedSelf) {
      throw new Error('SovereignIdentityService: resolve() must be called before accessing claims');
    }
    return this.cachedSelf;
  }

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

    const fingerprint = createHash('sha256')
      .update(`${selfState.anchor.id}:${soulHash}:${continuity.version}`)
      .digest('hex');

    const canonical: CanonicalSelf = {
      anchor: selfState.anchor,
      continuity,
      soul: soulRef,
      wallet: this.walletBinding,
      verification,
      resolvedAt: new Date().toISOString(),
      selfFingerprint: fingerprint,
    };

    this.cachedSelf = canonical;
    return canonical;
  }
}
