/**
 * Round 20.1 — SpawnProposalContract
 *
 * Canonical contract for governance-gated agent replication.
 * Standardizes the spawn proposal payload, factory function, and
 * outcome tracking.
 *
 * This contract is used by GovernanceService when actionKind === 'replication'.
 */
import type { ProposalInput } from './governance-contract.js';

// ── Spawn Proposal Payload ──────────────────────────────────────────

export interface SpawnProposalPayload {
  /** Why this child agent is needed */
  readonly why: string;
  /** What work the child is expected to perform */
  readonly targetWork: string;
  /** Budget allocated to child (cents) */
  readonly budgetCents: number;
  /** Maximum duration for child operation (ms) */
  readonly maxDurationMs: number;
  /** Expected net utility from this spawn (cents) */
  readonly expectedUtilityCents: number;
  /** Role of the child agent */
  readonly childRole: 'worker' | 'specialist' | 'delegate' | 'explorer';
  /** Risk level of the child's work */
  readonly riskLevel: 'low' | 'medium' | 'high';
  /** Name for the child agent */
  readonly childName: string;
  /** Genesis prompt for the child */
  readonly genesisPrompt: string;
  /** Parent session/agent ID */
  readonly parentId: string;
  /** Whether the child can spawn its own children */
  readonly canSubSpawn: boolean;
  /** Resource constraints */
  readonly resourceConstraints?: {
    maxConcurrentTools?: number;
    maxMemoryMb?: number;
    allowedToolCategories?: string[];
  };
}

// ── Spawn Outcome ───────────────────────────────────────────────────

export type SpawnOutcomeStatus =
  | 'created'
  | 'running'
  | 'completed'
  | 'failed'
  | 'recalled'
  | 'expired';

export interface SpawnOutcome {
  /** Proposal ID that authorized this spawn */
  readonly proposalId: string;
  /** Child ID created by LineageService */
  readonly childId: string;
  /** Current status of the spawn */
  status: SpawnOutcomeStatus;
  /** Budget used so far (cents) */
  budgetUsedCents: number;
  /** Budget allocated (cents) */
  readonly budgetAllocatedCents: number;
  /** Result summary */
  resultSummary?: string;
  /** Error details if failed */
  errorDetails?: string;
  /** Whether the child produced revenue */
  revenueGeneratedCents: number;
  /** Timestamps */
  readonly createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// ── Factory Function ────────────────────────────────────────────────

/**
 * Create a standardized spawn proposal input for GovernanceService.propose().
 */
export function createSpawnProposal(payload: SpawnProposalPayload): ProposalInput {
  return {
    actionKind: 'replication',
    target: payload.childName,
    justification: payload.why,
    expectedCostCents: payload.budgetCents,
    payload: {
      name: payload.childName,
      task: payload.targetWork,
      genesisPrompt: payload.genesisPrompt,
      parentId: payload.parentId,
      // Typed spawn payload embedded for downstream consumers
      spawnPayload: payload,
    },
  };
}

/**
 * Create an initial SpawnOutcome after a child is instantiated.
 */
export function createSpawnOutcome(
  proposalId: string,
  childId: string,
  budgetCents: number,
): SpawnOutcome {
  return {
    proposalId,
    childId,
    status: 'created',
    budgetUsedCents: 0,
    budgetAllocatedCents: budgetCents,
    revenueGeneratedCents: 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Extract SpawnProposalPayload from a ProposalInput's payload.
 * Returns undefined if not a spawn proposal.
 */
export function extractSpawnPayload(
  payload: Record<string, unknown> | undefined,
): SpawnProposalPayload | undefined {
  if (!payload) return undefined;
  const sp = payload['spawnPayload'];
  if (sp && typeof sp === 'object' && 'childRole' in (sp as object)) {
    return sp as SpawnProposalPayload;
  }
  return undefined;
}

/**
 * Validate a SpawnProposalPayload. Returns errors if invalid.
 */
export function validateSpawnPayload(payload: SpawnProposalPayload): string[] {
  const errors: string[] = [];

  if (!payload.childName || payload.childName.trim().length === 0) {
    errors.push('childName is required');
  }
  if (!payload.why || payload.why.trim().length === 0) {
    errors.push('why (justification) is required');
  }
  if (!payload.targetWork || payload.targetWork.trim().length === 0) {
    errors.push('targetWork is required');
  }
  if (payload.budgetCents < 0) {
    errors.push('budgetCents must be non-negative');
  }
  if (payload.maxDurationMs <= 0) {
    errors.push('maxDurationMs must be positive');
  }
  if (!payload.genesisPrompt || payload.genesisPrompt.trim().length === 0) {
    errors.push('genesisPrompt is required');
  }
  if (!payload.parentId) {
    errors.push('parentId is required');
  }

  return errors;
}
