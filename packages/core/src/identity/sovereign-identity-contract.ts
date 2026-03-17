/**
 * Sovereign Identity Contract — Round 16.2
 *
 * Core type definitions for the sovereign identity system.
 * Distinguishes three claim categories:
 *   - StableClaim: immutable identity facts
 *   - CapabilityClaim: runtime capabilities (verified vs asserted)
 *   - OperationalClaim: dynamic runtime state
 *
 * All claim types carry a `ClaimVerification` proving whether the
 * claim has been runtime-verified or merely asserted from config.
 */

// ── Claim Verification ─────────────────────────────────────────────────

/** Whether a claim has been verified at runtime or only asserted (e.g. from config) */
export interface ClaimVerification {
  /** true if verified through runtime check, false if merely declared */
  verified: boolean;
  /** How verification was performed (e.g. 'chain-validation', 'runtime-probe', 'config-read') */
  method: string;
  /** When verification was last performed (ISO 8601) */
  timestamp: string;
}

// ── Stable Claims ──────────────────────────────────────────────────────

/** Immutable identity facts that survive restarts and do not change unless rotated */
export interface StableClaim {
  /** The identity anchor UUID — the core "who am I" identifier */
  agentId: string;
  /** Human-readable agent name */
  displayName: string;
  /** Wallet address (null if walletless) */
  walletAddress: string | null;
  /** Chain ID for wallet binding */
  chainId: number | null;
  /** Lineage root — parent identity if this is a child agent */
  lineageRoot: string | null;
  /** Generation number (0 = original) */
  generation: number;
  /** SHA-256 of SOUL.md at genesis */
  genesisSoulHash: string;
  /** Verification status for these claims */
  verification: ClaimVerification;
}

// ── Capability Claims ──────────────────────────────────────────────────

/** A single capability that the runtime can perform */
export interface CapabilityEntry {
  /** Capability identifier (e.g. 'mcp-server', 'agenda', 'economic-memory') */
  name: string;
  /** Whether this capability has been runtime-verified (not just configured) */
  verified: boolean;
  /** How verification was performed */
  verificationMethod: string;
}

/** Runtime capabilities — what this agent can actually do */
export interface CapabilityClaim {
  /** Enabled interaction surfaces */
  surfaces: string[];
  /** Verified runtime capabilities */
  capabilities: CapabilityEntry[];
  /** Whether economic mode is supported */
  economicModeSupported: boolean;
  /** Whether agenda/commitment system is active */
  agendaSupported: boolean;
  /** Whether continuity chain is maintained */
  continuitySupported: boolean;
  /** Overall verification for capability claims */
  verification: ClaimVerification;
}

// ── Operational Claims ─────────────────────────────────────────────────

/** Dynamic runtime state — changes frequently during operation */
export interface OperationalClaim {
  /** Current runtime mode */
  runtimeMode: string;
  /** Health/readiness status */
  health: 'healthy' | 'degraded' | 'unhealthy';
  /** Identity continuity state */
  continuityState: 'chain-valid' | 'chain-broken' | 'fresh-genesis';
  /** Current continuity chain version */
  continuityVersion: number;
  /** Number of active commitments */
  activeCommitmentCount: number;
  /** Whether the agenda generator is active */
  agendaActive: boolean;
  /** Boot mode (genesis/restart/degraded) */
  bootMode: 'genesis' | 'restart' | 'degraded';
  /** Overall verification for operational claims */
  verification: ClaimVerification;
}

// ── Identity Status ────────────────────────────────────────────────────

/** The sovereign identity's lifecycle status */
export type SovereignIdentityStatus =
  | 'active'       // fully operational, all claims valid
  | 'degraded'     // operational but with reduced trust (broken chain, missing data)
  | 'recovering'   // in process of recovery from revocation or corruption
  | 'rotated'      // previous version — replaced by a new active identity
  | 'revoked';     // permanently deactivated

/** Valid status transitions */
export const IDENTITY_STATUS_TRANSITIONS: Record<SovereignIdentityStatus, readonly SovereignIdentityStatus[]> = {
  active:     ['degraded', 'rotated', 'revoked'],
  degraded:   ['active', 'revoked'],
  recovering: ['active', 'revoked'],
  rotated:    [],          // terminal for the old identity
  revoked:    ['recovering'],
};

export function isValidIdentityTransition(
  from: SovereignIdentityStatus,
  to: SovereignIdentityStatus,
): boolean {
  return IDENTITY_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Aggregated Claim Set ───────────────────────────────────────────────

/** Complete claims container — all three dimensions */
export interface IdentityClaimSet {
  /** Immutable identity facts */
  stable: StableClaim;
  /** Runtime capabilities */
  capability: CapabilityClaim;
  /** Dynamic operational state */
  operational: OperationalClaim;
  /** When this claim set was generated (ISO 8601) */
  generatedAt: string;
}

/** Public-safe subset of claims (no sensitive information) */
export interface PublicClaimSet {
  agentId: string;
  displayName: string;
  generation: number;
  runtimeMode: string;
  health: string;
  status: SovereignIdentityStatus;
  generatedAt: string;
}

// ── Lifecycle Result Types ─────────────────────────────────────────────

export interface IdentityRotationResult {
  success: boolean;
  previousStatus: SovereignIdentityStatus;
  newStatus: SovereignIdentityStatus;
  reason: string;
  rotatedAt?: string;
}

export interface IdentityRecoveryResult {
  success: boolean;
  previousStatus: SovereignIdentityStatus;
  newStatus: SovereignIdentityStatus;
  reason: string;
  recoveredAt?: string;
}

export interface IdentityRevocationResult {
  success: boolean;
  previousStatus: SovereignIdentityStatus;
  newStatus: SovereignIdentityStatus;
  reason: string;
  revokedAt?: string;
}

// ── Identity Change Event ──────────────────────────────────────────────

/** Emitted when identity status changes — consumed by CommitmentStore and PolicyEngine */
export interface IdentityChangeEvent {
  previousStatus: SovereignIdentityStatus;
  newStatus: SovereignIdentityStatus;
  reason: string;
  timestamp: string;
}

export type IdentityChangeListener = (event: IdentityChangeEvent) => void;
