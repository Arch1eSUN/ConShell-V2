/**
 * ConflictReasoner — Round 19.2 G1
 *
 * Execution-time conflict detection and resolution for the high-trust
 * autonomy closure. Detects:
 *
 * 1. STALE — commitment's data has drifted from current agenda state
 * 2. DUPLICATE — another commitment covers the same objective
 * 3. LIVE_DRIFT — execution context has changed since materialization
 * 4. PARTIAL_RESTORE — commitment was partially executed before crash/restart
 * 5. SUPERSEDED — a newer commitment obsoletes this one
 *
 * Integrates with ExecutionGuard to form the complete pre-execution
 * validation pipeline: Guard → ConflictReasoner → EconomicGate → Execute.
 *
 * "Before you execute, you must be sure you are not fighting ghosts."
 */
import type { Commitment, CommitmentStatus } from '../agenda/commitment-model.js';
import type { Logger } from '../types/common.js';

// ── Conflict Types ──────────────────────────────────────────────────

export type ConflictKind =
  | 'stale'
  | 'duplicate'
  | 'live_drift'
  | 'partial_restore'
  | 'superseded';

export type ConflictSeverity = 'info' | 'warning' | 'blocking';

export type ConflictResolution =
  | 'proceed'       // safe to execute
  | 'skip'          // skip this execution cycle, try again later
  | 'abandon'       // permanently abandon commitment
  | 'merge'         // merge with conflicting commitment
  | 'revalidate';   // force re-evaluation through agenda

export interface ConflictReport {
  readonly commitmentId: string;
  readonly conflicts: ConflictEntry[];
  readonly resolution: ConflictResolution;
  readonly resolvedAt: string;
}

export interface ConflictEntry {
  readonly kind: ConflictKind;
  readonly severity: ConflictSeverity;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

// ── Provider Interfaces ──────────────────────────────────────────────

export interface AgendaStateProvider {
  /** Get the current canonical state of a commitment */
  getCommitment(id: string): Commitment | undefined;
  /** Find commitments with the same objective (task type + name overlap) */
  findSimilar(commitment: Commitment): Commitment[];
}

export interface ExecutionContextProvider {
  /** Get the identity fingerprint at evaluation time */
  currentFingerprint(): string;
  /** Get the current survival tier */
  currentSurvivalTier(): string;
}

// ── ConflictReasoner ─────────────────────────────────────────────────

export class ConflictReasoner {
  private history: ConflictReport[] = [];
  private maxHistory = 100;
  private logger: Logger;

  constructor(
    private agenda: AgendaStateProvider,
    private context: ExecutionContextProvider,
    logger: Logger,
  ) {
    this.logger = logger;
  }

  /**
   * Evaluate a commitment for conflicts before execution.
   * Returns a ConflictReport with resolution recommendation.
   */
  evaluate(commitment: Commitment): ConflictReport {
    const conflicts: ConflictEntry[] = [];

    // ── 1. Stale Check ────────────────────────────────────────────
    this.checkStale(commitment, conflicts);

    // ── 2. Duplicate Check ────────────────────────────────────────
    this.checkDuplicate(commitment, conflicts);

    // ── 3. Live Drift Check ───────────────────────────────────────
    this.checkLiveDrift(commitment, conflicts);

    // ── 4. Partial Restore Check ──────────────────────────────────
    this.checkPartialRestore(commitment, conflicts);

    // ── 5. Superseded Check ───────────────────────────────────────
    this.checkSuperseded(commitment, conflicts);

    const resolution = this.resolveConflicts(conflicts);

    const report: ConflictReport = {
      commitmentId: commitment.id,
      conflicts,
      resolution,
      resolvedAt: new Date().toISOString(),
    };

    this.history.push(report);
    if (this.history.length > this.maxHistory) this.history.shift();

    if (conflicts.length > 0) {
      this.logger.info('Conflicts detected', {
        commitmentId: commitment.id,
        count: conflicts.length,
        resolution,
      });
    }

    return report;
  }

  /**
   * Get conflict evaluation history.
   */
  getHistory(): readonly ConflictReport[] {
    return this.history;
  }

  stats() {
    let blocked = 0, skipped = 0, proceeded = 0;
    for (const r of this.history) {
      if (r.resolution === 'proceed') proceeded++;
      else if (r.resolution === 'skip') skipped++;
      else blocked++;
    }
    return { total: this.history.length, proceeded, skipped, blocked };
  }

  // ── Individual Checks ──────────────────────────────────────────────

  private checkStale(c: Commitment, out: ConflictEntry[]): void {
    const current = this.agenda.getCommitment(c.id);
    if (!current) {
      out.push({
        kind: 'stale',
        severity: 'blocking',
        message: `Commitment ${c.id} no longer exists in agenda`,
      });
      return;
    }

    // Status divergence — materialized copy says 'active' but agenda says 'blocked'
    if (current.status !== c.status) {
      out.push({
        kind: 'stale',
        severity: current.status === 'abandoned' || current.status === 'failed' ? 'blocking' : 'warning',
        message: `Status divergence: expected '${c.status}', agenda says '${current.status}'`,
        details: { expected: c.status, actual: current.status },
      });
    }

    // Data staleness — commitment updated after our copy    
    if (current.updatedAt > c.updatedAt) {
      out.push({
        kind: 'stale',
        severity: 'warning',
        message: `Commitment updated since materialization`,
        details: { materializedAt: c.updatedAt, currentAt: current.updatedAt },
      });
    }
  }

  private checkDuplicate(c: Commitment, out: ConflictEntry[]): void {
    const similar = this.agenda.findSimilar(c);
    // Filter out self and lower-priority duplicates
    const activeDupes = similar.filter(s =>
      s.id !== c.id &&
      s.status === 'active' &&
      s.taskType === c.taskType,
    );

    if (activeDupes.length > 0) {
      out.push({
        kind: 'duplicate',
        severity: 'warning',
        message: `${activeDupes.length} active commitment(s) with same taskType '${c.taskType}'`,
        details: { duplicateIds: activeDupes.map(d => d.id) },
      });
    }
  }

  private checkLiveDrift(c: Commitment, out: ConflictEntry[]): void {
    if (!c.identityContext) return;

    const currentFp = this.context.currentFingerprint();
    if (c.identityContext.fingerprint !== currentFp) {
      out.push({
        kind: 'live_drift',
        severity: 'warning',
        message: `Identity drifted since commitment creation`,
        details: {
          commitmentFp: c.identityContext.fingerprint,
          currentFp,
        },
      });
    }
  }

  private checkPartialRestore(c: Commitment, out: ConflictEntry[]): void {
    if (!c.recoveredFromCrash) return;

    if (c.materializedTaskCount > 0) {
      out.push({
        kind: 'partial_restore',
        severity: 'warning',
        message: `Commitment recovered from crash with ${c.materializedTaskCount} prior materializations`,
        details: { priorTaskCount: c.materializedTaskCount },
      });
    }
  }

  private checkSuperseded(c: Commitment, out: ConflictEntry[]): void {
    const similar = this.agenda.findSimilar(c);
    const newer = similar.filter(s =>
      s.id !== c.id &&
      s.status === 'active' &&
      s.createdAt > c.createdAt &&
      s.taskType === c.taskType,
    );

    if (newer.length > 0) {
      out.push({
        kind: 'superseded',
        severity: 'blocking',
        message: `Superseded by ${newer.length} newer commitment(s)`,
        details: { supersedingIds: newer.map(n => n.id) },
      });
    }
  }

  // ── Resolution Logic ──────────────────────────────────────────────

  private resolveConflicts(conflicts: ConflictEntry[]): ConflictResolution {
    if (conflicts.length === 0) return 'proceed';

    // Any blocking conflict → strongest resolution
    const hasBlocking = conflicts.some(c => c.severity === 'blocking');
    if (hasBlocking) {
      const hasSuperseded = conflicts.some(c => c.kind === 'superseded');
      if (hasSuperseded) return 'abandon';

      const hasStaleGone = conflicts.some(c =>
        c.kind === 'stale' && c.message.includes('no longer exists'),
      );
      if (hasStaleGone) return 'abandon';

      return 'skip';
    }

    // All warnings → revalidate if many, proceed if few
    const warningCount = conflicts.filter(c => c.severity === 'warning').length;
    if (warningCount >= 3) return 'revalidate';

    return 'proceed';
  }
}
