/**
 * Commitment Model — the upper-level concept above QueuedTask.
 *
 * A Commitment represents a durable, long-term objective that can be
 * materialized into one or more QueuedTasks. It persists across restarts,
 * survives mode transitions, and is subject to agenda-level prioritization.
 *
 * Relationship: 1 Commitment → N QueuedTasks (via CommitmentMaterializer)
 *
 * Round 16.2: Identity coupling — each commitment carries an identity
 * context snapshot, enabling self-preservation awareness and identity-
 * change-triggered re-evaluation.
 */
import type { SovereignIdentityStatus } from '../identity/sovereign-identity-contract.js';

// ── Origin: where did this commitment come from? ─────────────────────

export type CommitmentOrigin = 'creator' | 'self' | 'system' | 'external';

// ── Status: lifecycle of a commitment ────────────────────────────────

export type CommitmentStatus =
  | 'planned'     // registered but not yet acted upon
  | 'active'      // currently being pursued
  | 'blocked'     // cannot proceed (dependency, resource, etc.)
  | 'completed'   // successfully fulfilled
  | 'abandoned'   // intentionally dropped
  | 'failed';     // exhausted retries / unrecoverable

/** Terminal statuses that should not be replayed on restart */
export const TERMINAL_STATUSES: readonly CommitmentStatus[] = [
  'completed', 'abandoned', 'failed',
];

// ── Kind: what category of work does this commitment represent? ──────

export type CommitmentKind =
  | 'revenue'       // expected to generate income
  | 'maintenance'   // infrastructure upkeep, health checks
  | 'memory'        // knowledge consolidation, learning
  | 'governance'    // policy, audit, compliance
  | 'identity'      // self-model, soul maintenance
  | 'user-facing'   // direct user service
  | 'delegation';   // delegated to a child agent (Round 16.5)

// ── Priority ─────────────────────────────────────────────────────────

export type CommitmentPriority = 'critical' | 'high' | 'normal' | 'low';

export const PRIORITY_WEIGHTS: Record<CommitmentPriority, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
};

// ── The Commitment interface ─────────────────────────────────────────

export interface Commitment {
  /** Unique identifier (UUID) */
  readonly id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  // ── Classification ──
  kind: CommitmentKind;
  origin: CommitmentOrigin;
  status: CommitmentStatus;
  priority: CommitmentPriority;

  // ── Scheduling ──
  /** ISO-8601 deadline (optional) */
  dueAt?: string;
  /** ISO-8601 last time agenda evaluated this commitment */
  lastEvaluatedAt?: string;
  /** ISO-8601 next scheduled review time */
  nextReviewAt?: string;

  // ── Economic attributes ──
  /** Expected revenue in cents (0 for non-revenue) */
  expectedValueCents: number;
  /** Estimated execution cost in cents */
  estimatedCostCents: number;
  /** If true, cannot be starved even under survival pressure */
  mustPreserve: boolean;
  /** If true, this commitment is expected to generate revenue */
  revenueBearing: boolean;

  // ── Task mapping ──
  /** Maps to QueuedTask.taskType for materialization */
  taskType: string;

  // ── Identity coupling (Round 16.2) ──
  /** Identity snapshot at commitment creation — who made this commitment */
  identityContext?: IdentityContext;

  // ── Delegation (Round 16.5) ──
  /** If delegated to a child, the child's agent ID */
  delegateChildId?: string;
  /** Delegation lifecycle status */
  delegationStatus?: 'pending' | 'active' | 'completed' | 'failed';

  // ── Failure/block tracking ──
  blockedReason?: string;
  failedReason?: string;

  // ── Recovery tracking (Round 18.6) ──
  /** True if this commitment was active during a crash/restart and recovered */
  recoveredFromCrash?: boolean;

  // ── Counters ──
  /** Number of QueuedTasks materialized from this commitment */
  materializedTaskCount: number;

  // ── Timestamps ──
  readonly createdAt: string;
  updatedAt: string;
}

// ── Valid status transitions ─────────────────────────────────────────

const VALID_TRANSITIONS: Record<CommitmentStatus, readonly CommitmentStatus[]> = {
  planned:   ['active', 'abandoned'],
  active:    ['blocked', 'completed', 'failed', 'abandoned'],
  blocked:   ['active', 'abandoned', 'failed'],
  completed: [],   // terminal
  abandoned: [],   // terminal
  failed:    [],   // terminal
};

/** Check if a status transition is valid */
export function isValidTransition(from: CommitmentStatus, to: CommitmentStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Identity Context ─────────────────────────────────────────────────

/** Identity snapshot attached to a commitment at creation time */
export interface IdentityContext {
  /** The identity anchor UUID */
  identityId: string;
  /** Deterministic self fingerprint at commitment creation */
  fingerprint: string;
  /** Identity status when commitment was created */
  status: SovereignIdentityStatus;
  /** Round 17.4: Parent identity ID for lineage tracking */
  parentIdentityId?: string;
  /** Round 17.4: Delegator identity if this commitment was delegated */
  delegatorIdentityId?: string;
}

/** Check if a commitment is self-preserving (identity/memory/governance by self) */
export function isSelfPreserving(c: Commitment): boolean {
  const selfKinds: CommitmentKind[] = ['identity', 'memory', 'governance'];
  return selfKinds.includes(c.kind) && (c.origin === 'self' || c.origin === 'system');
}

// ── Factory helper ───────────────────────────────────────────────────

let _idCounter = 0;
function generateId(): string {
  return `cmt-${Date.now()}-${++_idCounter}`;
}

export interface CreateCommitmentInput {
  name: string;
  description?: string;
  kind: CommitmentKind;
  origin: CommitmentOrigin;
  priority?: CommitmentPriority;
  dueAt?: string;
  nextReviewAt?: string;
  expectedValueCents?: number;
  estimatedCostCents?: number;
  mustPreserve?: boolean;
  revenueBearing?: boolean;
  taskType?: string;
  identityContext?: IdentityContext;
}

export function createCommitment(input: CreateCommitmentInput): Commitment {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: input.name,
    description: input.description,
    kind: input.kind,
    origin: input.origin,
    status: 'planned',
    priority: input.priority ?? 'normal',
    dueAt: input.dueAt,
    lastEvaluatedAt: undefined,
    nextReviewAt: input.nextReviewAt ?? now,
    expectedValueCents: input.expectedValueCents ?? 0,
    estimatedCostCents: input.estimatedCostCents ?? 0,
    mustPreserve: input.mustPreserve ?? false,
    revenueBearing: input.revenueBearing ?? false,
    taskType: input.taskType ?? 'general',
    identityContext: input.identityContext,
    blockedReason: undefined,
    failedReason: undefined,
    materializedTaskCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}
