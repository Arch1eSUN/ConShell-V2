/**
 * Round 17.7 — G3: Capability Envelope
 *
 * Formal economic capability boundary.
 * Each EconomicIdentity is bound to exactly one CapabilityEnvelope
 * that declares which economic action scopes are granted or denied.
 *
 * Design invariants:
 * - Default envelope: receive_only (minimum privilege)
 * - explicit_transfer: denied by default, requires explicit grant
 * - Capability changes are auditable and reversible
 */

// ── Types ────────────────────────────────────────────────────────────

/** The four canonical capability scopes, aligned with EconomicActionKind. */
export type CapabilityScope =
  | 'receive_only'
  | 'claim_reward'
  | 'spend_within_mandate'
  | 'explicit_transfer';

/** All possible scopes for iteration. */
export const ALL_CAPABILITY_SCOPES: readonly CapabilityScope[] = [
  'receive_only',
  'claim_reward',
  'spend_within_mandate',
  'explicit_transfer',
];

export interface CapabilityEnvelope {
  readonly envelopeId: string;
  readonly economicIdentityId: string;
  readonly grantedScopes: ReadonlySet<CapabilityScope>;
  readonly deniedScopes: ReadonlySet<CapabilityScope>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Change record for audit trail. */
export interface CapabilityChangeEvent {
  readonly envelopeId: string;
  readonly action: 'grant' | 'revoke';
  readonly scope: CapabilityScope;
  readonly timestamp: string;
}

// ── Manager ──────────────────────────────────────────────────────────

export class CapabilityEnvelopeManager {
  private envelopes = new Map<string, CapabilityEnvelope>();
  private byEconomicId = new Map<string, string>(); // econId → envelopeId
  private changeLog: CapabilityChangeEvent[] = [];
  private idCounter = 0;

  /**
   * Create a default envelope: receive_only granted, everything else denied.
   * This is the minimum-privilege starting point.
   */
  createDefault(economicIdentityId: string): CapabilityEnvelope {
    return this.create(economicIdentityId, ['receive_only']);
  }

  /**
   * Create a custom envelope with specified granted scopes.
   * Unspecified scopes are denied.
   */
  create(economicIdentityId: string, scopes: CapabilityScope[]): CapabilityEnvelope {
    if (this.byEconomicId.has(economicIdentityId)) {
      throw new Error(
        `CapabilityEnvelope already exists for economicIdentityId: ${economicIdentityId}`,
      );
    }

    const now = new Date().toISOString();
    const envelopeId = `cap_env_${++this.idCounter}`;
    const granted = new Set<CapabilityScope>(scopes);
    const denied = new Set<CapabilityScope>(
      ALL_CAPABILITY_SCOPES.filter(s => !granted.has(s)),
    );

    const envelope: CapabilityEnvelope = {
      envelopeId,
      economicIdentityId,
      grantedScopes: granted,
      deniedScopes: denied,
      createdAt: now,
      updatedAt: now,
    };

    this.envelopes.set(envelopeId, envelope);
    this.byEconomicId.set(economicIdentityId, envelopeId);
    return envelope;
  }

  /** Get by envelopeId. */
  get(envelopeId: string): CapabilityEnvelope | undefined {
    return this.envelopes.get(envelopeId);
  }

  /** Get by economicIdentityId. */
  getByEconomicIdentity(economicIdentityId: string): CapabilityEnvelope | undefined {
    const envId = this.byEconomicId.get(economicIdentityId);
    return envId ? this.envelopes.get(envId) : undefined;
  }

  /** Check whether a specific scope is granted. */
  hasCapability(envelopeId: string, scope: CapabilityScope): boolean {
    const envelope = this.envelopes.get(envelopeId);
    if (!envelope) return false;
    return envelope.grantedScopes.has(scope);
  }

  /** Grant a scope. Returns false if already granted or envelope not found. */
  grantScope(envelopeId: string, scope: CapabilityScope): boolean {
    const envelope = this.envelopes.get(envelopeId);
    if (!envelope) return false;
    if (envelope.grantedScopes.has(scope)) return false;

    const newGranted = new Set(envelope.grantedScopes);
    newGranted.add(scope);
    const newDenied = new Set(envelope.deniedScopes);
    newDenied.delete(scope);

    const updated: CapabilityEnvelope = {
      ...envelope,
      grantedScopes: newGranted,
      deniedScopes: newDenied,
      updatedAt: new Date().toISOString(),
    };
    this.envelopes.set(envelopeId, updated);

    this.changeLog.push({
      envelopeId,
      action: 'grant',
      scope,
      timestamp: updated.updatedAt,
    });
    return true;
  }

  /** Revoke a scope. Returns false if already denied or envelope not found. */
  revokeScope(envelopeId: string, scope: CapabilityScope): boolean {
    const envelope = this.envelopes.get(envelopeId);
    if (!envelope) return false;
    if (envelope.deniedScopes.has(scope)) return false;

    const newGranted = new Set(envelope.grantedScopes);
    newGranted.delete(scope);
    const newDenied = new Set(envelope.deniedScopes);
    newDenied.add(scope);

    const updated: CapabilityEnvelope = {
      ...envelope,
      grantedScopes: newGranted,
      deniedScopes: newDenied,
      updatedAt: new Date().toISOString(),
    };
    this.envelopes.set(envelopeId, updated);

    this.changeLog.push({
      envelopeId,
      action: 'revoke',
      scope,
      timestamp: updated.updatedAt,
    });
    return true;
  }

  /** Get the change log for audit. */
  getChangeLog(): ReadonlyArray<CapabilityChangeEvent> {
    return [...this.changeLog];
  }
}
