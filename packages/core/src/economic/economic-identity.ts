/**
 * Round 17.7 — G1: Economic Identity Layer
 *
 * Formal distinction between RuntimeIdentity and EconomicIdentity.
 * A runtime identity may exist without an economic identity — in that
 * case the subject is in economic read-only / no-permission state.
 *
 * Design invariants:
 * - Session identity ≠ wallet permission
 * - Runtime existence ≠ automatic payment capability
 * - Active identity ≠ automatic economic action eligibility
 */

// ── Types ────────────────────────────────────────────────────────────

export type EconomicIdentityStatus = 'active' | 'suspended' | 'revoked';

export interface EconomicIdentity {
  readonly economicIdentityId: string;
  readonly runtimeIdentityId: string;
  readonly walletRef: string | null;
  readonly settlementProfile: string | null;
  readonly status: EconomicIdentityStatus;
  readonly capabilityEnvelopeId: string;
  readonly restrictions: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EconomicIdentityCreateInput {
  readonly runtimeIdentityId: string;
  readonly walletRef?: string;
  readonly settlementProfile?: string;
  readonly capabilityEnvelopeId?: string;
  readonly restrictions?: readonly string[];
}

// ── Registry ─────────────────────────────────────────────────────────

export class EconomicIdentityRegistry {
  private identities = new Map<string, EconomicIdentity>();
  private byRuntimeId = new Map<string, string>(); // runtimeId → economicId
  private idCounter = 0;

  /**
   * Create a new EconomicIdentity for a given runtimeIdentityId.
   * This is an explicit action — economic identities are never auto-created.
   */
  create(input: EconomicIdentityCreateInput): EconomicIdentity {
    // Prevent duplicate economic identity for same runtime identity
    if (this.byRuntimeId.has(input.runtimeIdentityId)) {
      throw new Error(
        `EconomicIdentity already exists for runtimeIdentityId: ${input.runtimeIdentityId}`,
      );
    }

    const now = new Date().toISOString();
    const economicIdentityId = `econ_id_${++this.idCounter}`;

    const identity: EconomicIdentity = {
      economicIdentityId,
      runtimeIdentityId: input.runtimeIdentityId,
      walletRef: input.walletRef ?? null,
      settlementProfile: input.settlementProfile ?? null,
      status: 'active',
      capabilityEnvelopeId: input.capabilityEnvelopeId ?? '',
      restrictions: input.restrictions ?? [],
      createdAt: now,
      updatedAt: now,
    };

    this.identities.set(economicIdentityId, identity);
    this.byRuntimeId.set(input.runtimeIdentityId, economicIdentityId);
    return identity;
  }

  /** Get by economicIdentityId. */
  get(economicIdentityId: string): EconomicIdentity | undefined {
    return this.identities.get(economicIdentityId);
  }

  /** Get by runtimeIdentityId — may return undefined (= economic read-only). */
  getByRuntimeId(runtimeIdentityId: string): EconomicIdentity | undefined {
    const econId = this.byRuntimeId.get(runtimeIdentityId);
    return econId ? this.identities.get(econId) : undefined;
  }

  /**
   * Check whether a runtimeIdentityId is eligible for economic actions.
   * Returns true only if an active EconomicIdentity exists.
   */
  isEligibleForEconomicActions(runtimeIdentityId: string): boolean {
    const identity = this.getByRuntimeId(runtimeIdentityId);
    return identity !== undefined && identity.status === 'active';
  }

  /** Suspend an economic identity. */
  suspend(economicIdentityId: string, _reason: string): boolean {
    const identity = this.identities.get(economicIdentityId);
    if (!identity || identity.status !== 'active') return false;

    const updated: EconomicIdentity = {
      ...identity,
      status: 'suspended',
      updatedAt: new Date().toISOString(),
    };
    this.identities.set(economicIdentityId, updated);
    return true;
  }

  /** Revoke an economic identity permanently. */
  revoke(economicIdentityId: string, _reason: string): boolean {
    const identity = this.identities.get(economicIdentityId);
    if (!identity || identity.status === 'revoked') return false;

    const updated: EconomicIdentity = {
      ...identity,
      status: 'revoked',
      updatedAt: new Date().toISOString(),
    };
    this.identities.set(economicIdentityId, updated);
    return true;
  }

  /**
   * Update the capabilityEnvelopeId binding.
   * Used when a CapabilityEnvelope is created and needs to be linked.
   */
  bindEnvelope(economicIdentityId: string, envelopeId: string): boolean {
    const identity = this.identities.get(economicIdentityId);
    if (!identity) return false;

    const updated: EconomicIdentity = {
      ...identity,
      capabilityEnvelopeId: envelopeId,
      updatedAt: new Date().toISOString(),
    };
    this.identities.set(economicIdentityId, updated);
    return true;
  }

  /** List all economic identities. */
  all(): ReadonlyArray<EconomicIdentity> {
    return [...this.identities.values()];
  }
}
