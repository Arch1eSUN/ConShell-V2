/**
 * Agenda module — Commitment Model, Store, Generator, and Materializer.
 *
 * This module provides the autonomous agenda system for ConShell:
 * - Commitment: durable long-term objective (upper concept above QueuedTask)
 * - CommitmentStore: runtime cache with SQLite backing
 * - AgendaGenerator: multi-factor scoring for prioritization
 * - CommitmentMaterializer: converts commitments into executable tasks
 */

// ── Commitment Model ──────────────────────────────────────────────────
export {
  type Commitment,
  type CommitmentOrigin,
  type CommitmentStatus,
  type CommitmentKind,
  type CommitmentPriority,
  type CreateCommitmentInput,
  PRIORITY_WEIGHTS,
  TERMINAL_STATUSES,
  isValidTransition,
  createCommitment,
} from './commitment-model.js';

// ── Commitment Store ──────────────────────────────────────────────────
export {
  CommitmentStore,
  type CommitmentStoreFilter,
} from './commitment-store.js';

// ── Agenda Generator ──────────────────────────────────────────────────
export {
  AgendaGenerator,
  type AgendaItem,
  type AgendaResult,
  type AgendaInput,
  type DeferredItem,
  type RuntimeMode,
  type SurvivalTier,
} from './agenda-generator.js';

// ── Commitment Materializer ───────────────────────────────────────────
export {
  CommitmentMaterializer,
  type MaterializedTask,
  type TaskResult,
} from './commitment-materializer.js';

// ── Agenda Posture Provider (Round 19.8) ──────────────────────────────
export {
  DefaultAgendaPostureProvider,
} from './agenda-posture-provider.js';
