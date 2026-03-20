import type { Logger } from '../types/common.js';
import type { CommitmentStore } from '../agenda/index.js';
import type { AgentLoop } from './agent-loop.js';
import type { ToolExecutor } from './tool-executor.js';
import type { Commitment } from '../agenda/commitment-model.js';
import type { QueuedTask } from './task-queue.js';
import type { ScheduledTask } from '../scheduler/index.js';
import type { ExecutionGuard } from './execution-guard.js';
import type { ExecutionAuditTrail } from './execution-audit.js';
import type { ExecutionEconomicGate } from './execution-economic-gate.js';
import type { ConflictReasoner } from './conflict-reasoner.js';

/**
 * Translates a durable Commitment into a volatile QueuedTask.
 * Encapsulates Just-In-Time re-evaluation, execution guard, and fault discipline.
 *
 * Round 19.0: Initial implementation
 * Round 19.2: Integrated ExecutionGuard (re-entry suppression) and
 *             ExecutionAuditTrail (closed-loop feedback)
 */
export class CommitmentMaterializer {
  private guard?: ExecutionGuard;
  private audit?: ExecutionAuditTrail;
  private economicGate?: ExecutionEconomicGate;
  private conflictReasoner?: ConflictReasoner;

  constructor(
    private logger: Logger,
    private agenda: CommitmentStore,
    private agentLoop: AgentLoop,
    private toolExecutor: ToolExecutor
  ) {}

  /**
   * Wire the ExecutionGuard for re-entry suppression.
   * Must be called before materialize() to enable guard protection.
   */
  setGuard(guard: ExecutionGuard): void {
    this.guard = guard;
  }

  /**
   * Wire the ExecutionAuditTrail for closed-loop feedback.
   */
  setAuditTrail(audit: ExecutionAuditTrail): void {
    this.audit = audit;
  }

  /**
   * Wire the ExecutionEconomicGate for execution-time economic enforcement.
   * Round 19.3: Three-layer check (survival → profitability → mandate).
   */
  setEconomicGate(gate: ExecutionEconomicGate): void {
    this.economicGate = gate;
  }

  /**
   * Wire the ConflictReasoner for execution-time conflict detection.
   * Round 19.2 G1: Stale/duplicate/drift/partial/superseded detection.
   */
  setConflictReasoner(reasoner: ConflictReasoner): void {
    this.conflictReasoner = reasoner;
  }

  /**
   * Maps a Commitment to a dispatchable QueuedTask closure, enforcing
   * execution ownership, identity constraints, and economic priorities.
   *
   * The generated execute() closure performs:
   * 1. Guard acquisition (re-entry suppression)
   * 2. JIT eligibility re-evaluation (with drift detection)
   * 3. Business logic execution (via AgentLoop or ToolExecutor)
   * 4. Fault discipline (success/failure → agenda + audit)
   * 5. Guard release (with terminal blacklisting if appropriate)
   */
  materialize(commitment: Commitment, scheduledTask?: ScheduledTask): QueuedTask {
    const isRevenueBearing = commitment.mustPreserve;
    const baseType = commitment.taskType === 'tool_call' ? 'tool_call' : 'inference';
    // Capture snapshotUpdatedAt at materialization time for drift detection
    const snapshotUpdatedAt = commitment.updatedAt;

    return {
      id: `mat-${commitment.id}-${Date.now()}`,
      name: `Execute: ${commitment.name}`,
      commitmentId: commitment.id,
      isRevenueBearing,
      taskType: baseType,
      complexity: commitment.priority === 'high' ? 8 : 5,
      execute: async () => {
        const startTime = Date.now();

        // 1. ExecutionGuard — Re-entry suppression
        if (this.guard) {
          const acquire = this.guard.tryAcquire(commitment.id);
          if (!acquire.allowed) {
            this.logger.info(`Guard denied execution for ${commitment.id}`, { reason: acquire.reason });
            this.audit?.record(commitment.id, 'guard-denied', 0, acquire.reason);
            return { status: 'guard-denied', reason: acquire.reason };
          }
        }

        // 1.5 ConflictReasoner — execution-time conflict detection (G1)
        if (this.conflictReasoner) {
          const conflict = this.conflictReasoner.evaluate(commitment);
          if (conflict.resolution === 'abandon' || conflict.resolution === 'skip') {
            this.logger.info(`Conflict reasoner ${conflict.resolution}: ${commitment.id}`, {
              conflicts: conflict.conflicts.length,
            });
            this.audit?.record(commitment.id, 'vetoed', 0, `conflict:${conflict.resolution}`);
            if (this.guard) this.guard.release(commitment.id, conflict.resolution === 'abandon');
            return { status: `conflict-${conflict.resolution}`, conflicts: conflict.conflicts };
          }
        }

        try {
          // 2. JIT Re-evaluation — Final check with drift detection
          const eligibility = this.agenda.isExecutionEligible(commitment.id, snapshotUpdatedAt);
          if (!eligibility.eligible) {
            this.logger.info(`Commitment ${commitment.id} is no longer eligible. Vetoing.`, {
              status: commitment.status,
              reason: eligibility.reason,
            });
            this.audit?.record(commitment.id, 'vetoed', Date.now() - startTime, eligibility.reason);
            return { status: 'vetoed', reason: eligibility.reason || 'ineligible_at_execution_time' };
          }

          // 2.5 Economic Gate — execution-time economic enforcement (Round 19.3)
          if (this.economicGate) {
            const econ = this.economicGate.checkAdmission(commitment);
            if (econ.admission === 'reject') {
              this.logger.info(`Economic gate rejected ${commitment.id}`, { reason: econ.reason, layer: econ.decidingLayer });
              this.audit?.record(commitment.id, 'vetoed', Date.now() - startTime, `economic:${econ.reason}`);
              return { status: 'economic-rejected', reason: econ.reason, layer: econ.decidingLayer };
            }
            if (econ.admission === 'defer') {
              this.logger.info(`Economic gate deferred ${commitment.id}`, { reason: econ.reason, layer: econ.decidingLayer });
              this.audit?.record(commitment.id, 'vetoed', Date.now() - startTime, `economic-defer:${econ.reason}`);
              return { status: 'economic-deferred', reason: econ.reason, layer: econ.decidingLayer };
            }
            this.logger.debug(`Economic gate admitted ${commitment.id}`, { layer: econ.decidingLayer });
          }

          this.logger.debug(`Executing commitment ${commitment.id}`, { taskType: commitment.taskType });

          // 3. Execution Pathing
          let result;
          switch (commitment.taskType) {
            case 'cognitive':
              result = await this.agentLoop.processMessage(commitment.description || commitment.name);
              break;
            case 'tool_call':
              result = await this.toolExecutor.executeOne({
                id: `tc-${Date.now()}`,
                name: commitment.name,
                arguments: commitment.description || '{}',
              });
              if (result.isError) {
                throw new Error(result.content);
              }
              break;
            default:
              throw new Error(`Unsupported taskType: ${commitment.taskType} for execution.`);
          }

          // 4. Fault Discipline (Success)
          this.agenda.markCompleted(commitment.id);
          const duration = Date.now() - startTime;
          this.audit?.record(commitment.id, 'completed', duration);
          this.logger.info(`Commitment ${commitment.id} execution completed successfully.`, { durationMs: duration });
          return { status: 'completed', result };
        } catch (error) {
          // 4. Fault Discipline (Failure)
          const reason = error instanceof Error ? error.message : String(error);
          this.agenda.markFailed(commitment.id, reason);
          const duration = Date.now() - startTime;
          this.audit?.record(commitment.id, 'failed', duration, reason);
          this.logger.error(`Commitment ${commitment.id} execution failed.`, { reason, durationMs: duration });
          return { status: 'failed', reason };
        } finally {
          // 5. Guard Release — always release, blacklist if terminal
          if (this.guard) {
            const current = this.agenda.get(commitment.id);
            const isTerminal = !current ||
              current.status === 'completed' ||
              current.status === 'failed' ||
              current.status === 'abandoned';
            this.guard.release(commitment.id, isTerminal);
          }
        }
      },
    };
  }
}
