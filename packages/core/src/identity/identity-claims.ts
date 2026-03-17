/**
 * Identity Claims — Round 17.4 (Goal G2)
 *
 * Formal capability and service claim contracts with identity binding.
 * Each claim carries:
 *   - issuerIdentityId: who issued this claim
 *   - integrityHash: SHA-256 of canonical claim content (placeholder for future signatures)
 *   - scope/constraints: what the claim permits
 *   - expiry: when the claim becomes invalid
 *
 * ClaimIssuer: issues claims with revocation guard (D4 守门人)
 * ClaimRegistry: stores, queries, and revokes claims with serialize/restore
 */
import { createHash, randomUUID } from 'node:crypto';

// ── Claim Types ─────────────────────────────────────────────────────────

export type ClaimType = 'capability' | 'service';

/**
 * A formal capability claim — what this agent can do.
 */
export interface FormalCapabilityClaim {
  claimId: string;
  claimType: 'capability';
  issuerIdentityId: string;
  /** The capability being claimed (e.g. 'mcp-server', 'economic-memory') */
  subject: string;
  /** Scope of the capability (e.g. 'runtime', 'api-surface') */
  scope: string;
  /** Constraints/conditions (free-form key-value) */
  constraints: Record<string, string>;
  /** ISO 8601 issuance time */
  issuedAt: string;
  /** ISO 8601 expiry (null = no expiry) */
  expiresAt: string | null;
  /** Whether this claim has been revoked */
  revoked: boolean;
  /** SHA-256 integrity hash of canonical claim content */
  integrityHash: string;
}

/**
 * A formal service claim — what service this agent offers externally.
 */
export interface ServiceClaim {
  claimId: string;
  claimType: 'service';
  issuerIdentityId: string;
  /** Service name (e.g. 'text-generation', 'code-review', 'data-analysis') */
  subject: string;
  /** Service scope (e.g. 'public', 'authenticated', 'delegated') */
  scope: string;
  /** Service endpoint or description */
  endpoint: string;
  /** Pricing hint (e.g. 'free', '0.01 USDC/request') */
  pricingHint: string | null;
  /** Constraints/conditions */
  constraints: Record<string, string>;
  /** ISO 8601 issuance time */
  issuedAt: string;
  /** ISO 8601 expiry (null = no expiry) */
  expiresAt: string | null;
  /** Whether this claim has been revoked */
  revoked: boolean;
  /** SHA-256 integrity hash of canonical claim content */
  integrityHash: string;
}

/** Union of all claim types */
export type IdentityClaim = FormalCapabilityClaim | ServiceClaim;

// ── Integrity Hash ──────────────────────────────────────────────────────

/**
 * Compute the integrity hash of a claim's canonical content.
 * Excludes `claimId`, `revoked`, and `integrityHash` from the hash input.
 */
export function computeClaimIntegrity(claim: Omit<IdentityClaim, 'claimId' | 'revoked' | 'integrityHash'>): string {
  const canonical = JSON.stringify({
    claimType: claim.claimType,
    issuerIdentityId: claim.issuerIdentityId,
    subject: claim.subject,
    scope: claim.scope,
    constraints: claim.constraints,
    issuedAt: claim.issuedAt,
    expiresAt: claim.expiresAt,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

// ── Claim Issuer (D4 守门人) ────────────────────────────────────────────

export interface IdentityStatusProvider {
  status(): string;
  getActiveRecord(): { id: string } | null;
}

/**
 * ClaimIssuer — issues claims with identity revocation guard.
 *
 * Follows D4 (守门人模式): claims cannot be issued if the
 * issuer identity is in 'revoked' state.
 */
export class ClaimIssuer {
  constructor(private readonly identityProvider: IdentityStatusProvider) {}

  /**
   * Issue a capability claim.
   * Throws if the issuer identity is revoked.
   */
  issueCapabilityClaim(params: {
    subject: string;
    scope: string;
    constraints?: Record<string, string>;
    expiresAt?: string | null;
  }): FormalCapabilityClaim {
    this.guardRevoked();
    const activeRecord = this.identityProvider.getActiveRecord();
    if (!activeRecord) throw new Error('ClaimIssuer: no active identity record');

    const now = new Date().toISOString();
    const partial = {
      claimType: 'capability' as const,
      issuerIdentityId: activeRecord.id,
      subject: params.subject,
      scope: params.scope,
      constraints: params.constraints ?? {},
      issuedAt: now,
      expiresAt: params.expiresAt ?? null,
    };

    return {
      claimId: randomUUID(),
      ...partial,
      revoked: false,
      integrityHash: computeClaimIntegrity(partial),
    };
  }

  /**
   * Issue a service claim.
   * Throws if the issuer identity is revoked.
   */
  issueServiceClaim(params: {
    subject: string;
    scope: string;
    endpoint: string;
    pricingHint?: string | null;
    constraints?: Record<string, string>;
    expiresAt?: string | null;
  }): ServiceClaim {
    this.guardRevoked();
    const activeRecord = this.identityProvider.getActiveRecord();
    if (!activeRecord) throw new Error('ClaimIssuer: no active identity record');

    const now = new Date().toISOString();
    const partial = {
      claimType: 'service' as const,
      issuerIdentityId: activeRecord.id,
      subject: params.subject,
      scope: params.scope,
      constraints: params.constraints ?? {},
      issuedAt: now,
      expiresAt: params.expiresAt ?? null,
    };

    return {
      claimId: randomUUID(),
      ...partial,
      endpoint: params.endpoint,
      pricingHint: params.pricingHint ?? null,
      revoked: false,
      integrityHash: computeClaimIntegrity(partial),
    };
  }

  private guardRevoked(): void {
    const status = this.identityProvider.status();
    if (status === 'revoked') {
      throw new Error('ClaimIssuer: cannot issue claims — identity is revoked');
    }
  }
}

// ── Claim Registry ──────────────────────────────────────────────────────

export interface ClaimRegistrySnapshot {
  version: 1;
  claims: IdentityClaim[];
  snapshotAt: string;
}

/**
 * ClaimRegistry — stores, queries, and revokes identity claims.
 * Supports serialize/restore for checkpoint persistence.
 */
export class ClaimRegistry {
  private claims: IdentityClaim[] = [];

  /** Add a claim to the registry */
  register(claim: IdentityClaim): void {
    this.claims.push(claim);
  }

  /** Get all active (non-revoked, non-expired) claims */
  getActiveClaims(): readonly IdentityClaim[] {
    const now = new Date().toISOString();
    return this.claims.filter(c => !c.revoked && (!c.expiresAt || c.expiresAt > now));
  }

  /** Get claims by type */
  getByType(type: ClaimType): readonly IdentityClaim[] {
    return this.claims.filter(c => c.claimType === type && !c.revoked);
  }

  /** Get claims by issuer identity */
  getByIssuer(issuerIdentityId: string): readonly IdentityClaim[] {
    return this.claims.filter(c => c.issuerIdentityId === issuerIdentityId);
  }

  /** Revoke a claim by ID */
  revoke(claimId: string): boolean {
    const claim = this.claims.find(c => c.claimId === claimId);
    if (!claim) return false;
    claim.revoked = true;
    return true;
  }

  /** Revoke all claims issued by a specific identity */
  revokeByIssuer(issuerIdentityId: string): number {
    let count = 0;
    for (const claim of this.claims) {
      if (claim.issuerIdentityId === issuerIdentityId && !claim.revoked) {
        claim.revoked = true;
        count++;
      }
    }
    return count;
  }

  /**
   * Round 17.5 (G5): Reassign claim issuer during identity rotation.
   * Capability claims are inheritable; service claims must be re-issued.
   * Returns count of reassigned claims.
   */
  reassignIssuer(fromId: string, toId: string, claimType?: ClaimType): number {
    let count = 0;
    for (const claim of this.claims) {
      if (claim.issuerIdentityId === fromId && !claim.revoked) {
        if (claimType && claim.claimType !== claimType) continue;
        claim.issuerIdentityId = toId;
        count++;
      }
    }
    return count;
  }

  /** Verify claim integrity hash */
  verifyIntegrity(claimId: string): boolean {
    const claim = this.claims.find(c => c.claimId === claimId);
    if (!claim) return false;
    const { claimId: _id, revoked: _r, integrityHash: _h, ...rest } = claim;
    const expected = computeClaimIntegrity(rest as Omit<IdentityClaim, 'claimId' | 'revoked' | 'integrityHash'>);
    return claim.integrityHash === expected;
  }

  /** Serialize for checkpoint persistence */
  serialize(): ClaimRegistrySnapshot {
    return {
      version: 1,
      claims: this.claims.map(c => ({ ...c })),
      snapshotAt: new Date().toISOString(),
    };
  }

  /** Restore from checkpoint snapshot */
  restore(snapshot: unknown): boolean {
    if (!snapshot || typeof snapshot !== 'object') return false;
    const s = snapshot as Record<string, unknown>;
    if (s.version !== 1 || !Array.isArray(s.claims)) return false;
    this.claims = (s.claims as IdentityClaim[]).map(c => ({ ...c }));
    return true;
  }
}
